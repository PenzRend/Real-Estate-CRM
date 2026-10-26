// Tenant-isolation tests for the SQL migrations.
//
// Runs every migration in an in-memory Postgres (PGlite) with a minimal
// stand-in for Supabase's `auth` schema and roles, then acts as two users in
// two different workspaces. This needs no Docker or network, but it is an
// approximation of Supabase: re-check against a real project before launch.

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
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
  db = new PGlite({ extensions: { pg_trgm } });
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

  it("rejects an inverted budget range", async () => {
    const r = await asUser(
      USER_A,
      `insert into clients (organization_id, full_name, budget_min, budget_max) values ('${orgA}', 'x', 90000000, 80000000)`,
    );
    expect(r.ok).toBe(false);
  });
});
