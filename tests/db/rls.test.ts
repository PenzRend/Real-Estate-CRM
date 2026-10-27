// Tenant-isolation tests for the SQL migrations.
//
// Runs every migration in an in-memory Postgres (PGlite) with a minimal
// stand-in for Supabase's `auth` schema and roles, then acts as two users in
// two different workspaces. This needs no Docker or network, but it is an
// approximation of Supabase: re-check against a real project before launch.

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(__dirname, "../../supabase/migrations");
const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";

let db: PGlite;
let orgA: string;
let orgB: string;

type Result = { ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string };

async function asUser(userId: string, sql: string): Promise<Result> {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`,
  );
  try {
    return { ok: true, rows: (await db.query<Record<string, unknown>>(sql)).rows };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    await db.exec("reset role");
  }
}

async function rowsAs(userId: string, sql: string) {
  const r = await asUser(userId, sql);
  if (!r.ok) throw new Error(r.error);
  return r.rows;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm, unaccent } });
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema extensions; create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public, extensions to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${USER_A}', 'anna@example.test', '{"full_name": "Teszt Anna"}'),
      ('${USER_B}', 'bela@example.test', '{}');
  `);
  orgA = (await rowsAs(USER_A, "select id from organizations"))[0].id as string;
  orgB = (await rowsAs(USER_B, "select id from organizations"))[0].id as string;
});

async function createClientAsA(name = "Teszt Péter") {
  const rows = await rowsAs(
    USER_A,
    `insert into clients (organization_id, full_name) values ('${orgA}', '${name}') returning id`,
  );
  return rows[0].id as string;
}

describe("sign-up", () => {
  it("creates a profile, a personal workspace and an owner membership", async () => {
    const profile = await rowsAs(USER_A, `select full_name, email, timezone from profiles where id = '${USER_A}'`);
    expect(profile).toEqual([{ full_name: "Teszt Anna", email: "anna@example.test", timezone: "Europe/Budapest" }]);
    const membership = await rowsAs(USER_A, "select role from organization_members");
    expect(membership).toEqual([{ role: "owner" }]);
    expect(orgA).not.toEqual(orgB);
  });
});

describe("tenant isolation", () => {
  it("users see only their own organization", async () => {
    expect(await rowsAs(USER_A, "select id from organizations")).toEqual([{ id: orgA }]);
  });

  it("another organization cannot read, update or delete records", async () => {
    const clientId = await createClientAsA();
    expect(await rowsAs(USER_B, `select id from clients where id = '${clientId}'`)).toEqual([]);
    expect(await rowsAs(USER_B, `update clients set full_name = 'x' where id = '${clientId}' returning id`)).toEqual([]);
    expect(await rowsAs(USER_B, `delete from clients where id = '${clientId}' returning id`)).toEqual([]);
    expect(await rowsAs(USER_A, `select full_name from clients where id = '${clientId}'`)).toEqual([
      { full_name: "Teszt Péter" },
    ]);
  });

  it("cannot insert into another organization", async () => {
    const r = await asUser(USER_B, `insert into clients (organization_id, full_name) values ('${orgA}', 'x')`);
    expect(r.ok).toBe(false);
  });

  it("cannot reference another organization's client by id", async () => {
    const clientId = await createClientAsA();
    const r = await asUser(
      USER_B,
      `insert into interactions (organization_id, client_id, interaction_type) values ('${orgB}', '${clientId}', 'call')`,
    );
    expect(r.ok).toBe(false);
  });

  it("cannot move a record to another organization", async () => {
    const clientId = await createClientAsA();
    const r = await asUser(USER_A, `update clients set organization_id = '${orgB}' where id = '${clientId}'`);
    expect(r.ok).toBe(false);
  });

  it("cannot assign a record to a non-member or spoof created_by", async () => {
    const assign = await asUser(
      USER_A,
      `insert into clients (organization_id, full_name, assigned_to) values ('${orgA}', 'x', '${USER_B}')`,
    );
    expect(assign.ok).toBe(false);
    const spoof = await asUser(
      USER_A,
      `insert into clients (organization_id, full_name, created_by) values ('${orgA}', 'x', '${USER_B}')`,
    );
    expect(spoof.ok).toBe(false);
  });

  it("cannot read another user's profile or change own email", async () => {
    expect(await rowsAs(USER_B, `select id from profiles where id = '${USER_A}'`)).toEqual([]);
    expect((await asUser(USER_A, `update profiles set email = 'x@example.test' where id = '${USER_A}'`)).ok).toBe(false);
  });

  it("anonymous role has no table access", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from clients")).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("workflow", () => {
  it("links an interaction and a follow-up task to a client", async () => {
    const clientId = await createClientAsA();
    const [interaction] = await rowsAs(
      USER_A,
      `insert into interactions (organization_id, client_id, interaction_type, summary)
       values ('${orgA}', '${clientId}', 'call', 'Hívás') returning id`,
    );
    const r = await asUser(
      USER_A,
      `insert into tasks (organization_id, client_id, interaction_id, title, due_at)
       values ('${orgA}', '${clientId}', '${interaction.id}', 'Visszahívni', now())`,
    );
    expect(r.ok).toBe(true);
  });

  it("owner can hard-delete; dependent interactions go with the client", async () => {
    const clientId = await createClientAsA();
    await rowsAs(
      USER_A,
      `insert into interactions (organization_id, client_id, interaction_type) values ('${orgA}', '${clientId}', 'note')`,
    );
    expect(await rowsAs(USER_A, `delete from clients where id = '${clientId}' returning id`)).toHaveLength(1);
    expect(await rowsAs(USER_A, `select id from interactions where client_id = '${clientId}'`)).toEqual([]);
  });

  it("search columns match without accents and by phone digits", async () => {
    await rowsAs(
      USER_A,
      `insert into clients (organization_id, full_name, phone, preferred_locations)
       values ('${orgA}', 'Kereső Péter', '+36 30 123 4567', '{"Budapest XI.", "Budaörs"}')`,
    );
    expect(await rowsAs(USER_A, `select full_name from clients where search_text like '%kereso peter%'`)).toEqual([
      { full_name: "Kereső Péter" },
    ]);
    expect(await rowsAs(USER_A, `select full_name from clients where phone_digits like '%301234567%'`)).toHaveLength(1);
    expect(await rowsAs(USER_A, `select full_name from clients where locations_text like '%budaors%'`)).toHaveLength(1);
  });

  it("property search matches title, address and reference without accents", async () => {
    await rowsAs(
      USER_A,
      `insert into properties (organization_id, title, reference_number, city, district, address)
       values ('${orgA}', 'Napfényes lakás', 'BP11-024', 'Budapest', 'XI. kerület', 'Örs vezér tere 5.')`,
    );
    for (const term of ["napfenyes", "ors vezer", "bp11-024", "xi. kerulet"]) {
      expect(await rowsAs(USER_A, `select title from properties where search_text like '%${term}%'`)).toHaveLength(1);
    }
    expect(await rowsAs(USER_B, `select title from properties where search_text like '%napfenyes%'`)).toEqual([]);
  });

  it("match decisions stay in their workspace and cannot point across workspaces", async () => {
    const clientId = await createClientAsA("Döntés Teszt");
    const [prop] = await rowsAs(USER_A, `insert into properties (organization_id, title) values ('${orgA}', 'Döntés lakás') returning id`);
    expect(
      (await asUser(USER_A, `insert into property_client_matches (organization_id, property_id, client_id, status) values ('${orgA}', '${prop.id}', '${clientId}', 'dismissed')`)).ok,
    ).toBe(true);
    expect(await rowsAs(USER_B, `select id from property_client_matches`)).toEqual([]);
    expect(
      (await asUser(USER_B, `insert into property_client_matches (organization_id, property_id, client_id, status) values ('${orgB}', '${prop.id}', '${clientId}', 'dismissed')`)).ok,
    ).toBe(false);
  });

  it("mailboxes and emails are visible only to the user who connected them", async () => {
    const [mb] = await rowsAs(
      USER_A,
      `insert into mailboxes (organization_id, provider, email_address, refresh_token_enc)
       values ('${orgA}', 'gmail', 'anna@example.test', 'ciphertext') returning id`,
    );
    const [mail] = await rowsAs(
      USER_A,
      `insert into emails (organization_id, mailbox_id, provider_message_id, direction, received_at, subject)
       values ('${orgA}', '${mb.id}', 'm1', 'incoming', now(), 'Érdeklődés') returning id`,
    );
    expect(await rowsAs(USER_B, `select id from mailboxes`)).toEqual([]);
    expect(await rowsAs(USER_B, `select id from emails where id = '${mail.id}'`)).toEqual([]);
    expect(await rowsAs(USER_B, `update emails set status = 'ignored' where id = '${mail.id}' returning id`)).toEqual([]);
    // Another user cannot attach their email to A's mailbox.
    const [mbB] = await rowsAs(
      USER_B,
      `insert into mailboxes (organization_id, provider, email_address, refresh_token_enc)
       values ('${orgB}', 'gmail', 'bela@example.test', 'ciphertext') returning id`,
    );
    expect(
      (await asUser(USER_B, `insert into emails (organization_id, mailbox_id, provider_message_id, direction, received_at) values ('${orgB}', '${mb.id}', 'x', 'incoming', now())`)).ok,
    ).toBe(false);
    expect(mbB.id).toBeDefined();
  });

  it("a shared listing shows only what the page needs, and only while the link is active", async () => {
    const [prop] = await rowsAs(
      USER_A,
      `insert into properties (organization_id, title, address, internal_notes, price) values ('${orgA}', 'Megosztott lakás', 'Titok utca 1.', 'belső megjegyzés', 50000000) returning id`,
    );
    const token = "TesztLinkToken_1234567890";
    const share = (who: string, org: string) =>
      asUser(who, `insert into property_shares (organization_id, property_id, token, contact_name) values ('${org}', '${prop.id}', '${token}', 'Anna') returning id`);
    // Another workspace can't create a link to A's listing.
    expect((await share(USER_B, orgB)).ok).toBe(false);
    expect((await share(USER_A, orgA)).ok).toBe(true);
    // Only one active link per listing.
    expect((await asUser(USER_A, `insert into property_shares (organization_id, property_id, token) values ('${orgA}', '${prop.id}', 'MasikLinkToken_12345678901')`)).ok).toBe(false);
    expect(await rowsAs(USER_B, `select id from property_shares`)).toEqual([]);

    const anon = async (sql: string) => {
      await db.exec("set role anon");
      try {
        return (await db.query<Record<string, unknown>>(sql)).rows;
      } finally {
        await db.exec("reset role");
      }
    };
    const page = (await anon(`select public.shared_listing('${token}') as page`))[0].page as Record<string, unknown>;
    expect(page.title).toBe("Megosztott lakás");
    expect(page.address).toBeNull(); // address hidden unless allowed
    expect(page).not.toHaveProperty("internal_notes");
    expect(page).not.toHaveProperty("owner_client_id");
    expect((await anon(`select public.shared_listing('nincs-ilyen-token-12345678') as page`))[0].page).toBeNull();
    // Anonymous visitors still can't read tables directly.
    await expect(anon(`select id from property_shares`)).rejects.toThrow();
    await expect(anon(`select title from properties`)).rejects.toThrow();
    // Views are counted; revoking ends access.
    expect((await rowsAs(USER_A, `select view_count from property_shares where token = '${token}'`))[0].view_count).toBe(1);
    await rowsAs(USER_A, `update property_shares set revoked_at = now() where token = '${token}' returning id`);
    expect((await anon(`select public.shared_listing('${token}') as page`))[0].page).toBeNull();
    expect((await anon(`select public.shared_media_visible('${orgA}/${prop.id}/x.jpg') as ok`))[0].ok).toBe(false);
  });

  it("viewings stay in their workspace, and feedback is required to close one", async () => {
    const clientId = await createClientAsA("Megtekintő Mária");
    const [prop] = await rowsAs(USER_A, `insert into properties (organization_id, title) values ('${orgA}', 'Megtekintett lakás') returning id`);
    const book = (who: string, org: string) =>
      asUser(who, `insert into viewings (organization_id, client_id, property_id, starts_at) values ('${org}', '${clientId}', '${prop.id}', now() + interval '1 day') returning id`);
    // Another workspace can't book A's client and listing, nor see A's viewings.
    expect((await book(USER_B, orgB)).ok).toBe(false);
    const ok = await book(USER_A, orgA);
    expect(ok.ok).toBe(true);
    const [v] = await rowsAs(USER_A, `select id from viewings`);
    expect(await rowsAs(USER_B, `select id from viewings`)).toEqual([]);
    expect((await rowsAs(USER_B, `update viewings set status = 'cancelled' where id = '${v.id}' returning id`)).length).toBe(0);
    // Completed means feedback was given.
    expect((await asUser(USER_A, `update viewings set status = 'completed' where id = '${v.id}'`)).ok).toBe(false);
    expect((await asUser(USER_A, `update viewings set status = 'completed', interest = 'high', feedback_at = now() where id = '${v.id}'`)).ok).toBe(true);
    // No deleting: cancelled viewings stay on record.
    expect((await asUser(USER_A, `delete from viewings where id = '${v.id}'`)).ok).toBe(false);
  });

  it("feedback is private to its author and can't be filed into another workspace", async () => {
    const send = (who: string, org: string, author = who) =>
      asUser(who, `insert into product_feedback (organization_id, user_id, kind, message, page) values ('${org}', '${author}', 'idea', 'Jó lenne…', '/dashboard')`);
    expect((await send(USER_A, orgA)).ok).toBe(true);
    // Not in someone else's workspace, nor in someone else's name.
    expect((await send(USER_B, orgA)).ok).toBe(false);
    expect((await send(USER_B, orgB, USER_A)).ok).toBe(false);
    expect(await rowsAs(USER_A, `select message from product_feedback`)).toHaveLength(1);
    expect(await rowsAs(USER_B, `select message from product_feedback`)).toEqual([]);
    // Sent feedback isn't edited or deleted from the app.
    expect((await asUser(USER_A, `update product_feedback set message = 'x'`)).ok).toBe(false);
    expect((await asUser(USER_A, `delete from product_feedback`)).ok).toBe(false);
  });

  it("property photos stay in their workspace and folder", async () => {
    const [prop] = await rowsAs(USER_A, `insert into properties (organization_id, title) values ('${orgA}', 'Fotós lakás') returning id`);
    const path = (org: string, file: string) => `${org}/${prop.id}/${file}`;
    const add = (who: string, org: string, p: string, cover = false) =>
      asUser(who, `insert into property_media (organization_id, property_id, kind, storage_path, mime_type, size_bytes, is_cover) values ('${org}', '${prop.id}', 'photo', '${p}', 'image/jpeg', 1000, ${cover})`);
    expect((await add(USER_A, orgA, path(orgA, "a.jpg"), true)).ok).toBe(true);
    // Only one cover per property.
    expect((await add(USER_A, orgA, path(orgA, "b.jpg"), true)).ok).toBe(false);
    // The file must be in this workspace's folder for this property.
    expect((await add(USER_A, orgA, path(orgB, "c.jpg"))).ok).toBe(false);
    expect((await add(USER_A, orgA, `${orgA}/other/d.jpg`)).ok).toBe(false);
    // Another workspace can't see, attach to or delete A's media.
    expect(await rowsAs(USER_B, `select id from property_media`)).toEqual([]);
    expect((await add(USER_B, orgB, path(orgB, "e.jpg"))).ok).toBe(false);
    expect(await rowsAs(USER_B, `delete from property_media returning id`)).toEqual([]);
    // Folder check used by storage: members of the first folder's workspace only.
    expect((await rowsAs(USER_A, `select private.is_member_of_folder('${path(orgA, "a.jpg")}') as ok`))[0].ok).toBe(true);
    expect((await rowsAs(USER_B, `select private.is_member_of_folder('${path(orgA, "a.jpg")}') as ok`))[0].ok).toBe(false);
    expect((await rowsAs(USER_A, `select private.is_member_of_folder('nem-uuid/x.jpg') as ok`))[0].ok).toBe(false);
  });

  it("a listing URL can be imported once per workspace", async () => {
    const url = "https://ingatlan.com/34567890";
    const insert = (who: string, org: string) => asUser(who, `insert into properties (organization_id, title, source_url) values ('${org}', 'Import', '${url}')`);
    expect((await insert(USER_A, orgA)).ok).toBe(true);
    expect((await insert(USER_A, orgA)).ok).toBe(false);
    // Another workspace may import the same listing; it can't see A's copy.
    expect((await insert(USER_B, orgB)).ok).toBe(true);
    expect(await rowsAs(USER_B, `select id from properties where organization_id = '${orgA}'`)).toEqual([]);
    expect((await asUser(USER_A, `insert into properties (organization_id, title, source_url) values ('${orgA}', 'x', 'javascript:alert(1)')`)).ok).toBe(false);
  });

  it("visit times are private to their user and workspace", async () => {
    expect((await asUser(USER_A, `insert into user_visits (organization_id) values ('${orgA}')`)).ok).toBe(true);
    expect((await asUser(USER_B, `insert into user_visits (organization_id, user_id) values ('${orgB}', '${USER_A}')`)).ok).toBe(false);
    expect((await asUser(USER_B, `insert into user_visits (organization_id) values ('${orgA}')`)).ok).toBe(false);
    expect(await rowsAs(USER_B, `select user_id from user_visits`)).toEqual([]);
    expect(await rowsAs(USER_B, `update user_visits set last_seen_at = now() where user_id = '${USER_A}' returning user_id`)).toEqual([]);
  });

  it("rejects an inverted budget range", async () => {
    const r = await asUser(
      USER_A,
      `insert into clients (organization_id, full_name, budget_min, budget_max) values ('${orgA}', 'x', 90000000, 80000000)`,
    );
    expect(r.ok).toBe(false);
  });
});
