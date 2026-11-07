import "server-only";
import { linksOf } from "./links";
import type { CurrentUser } from "@/lib/auth";
import { documentKinds, type DocumentKind } from "@/lib/documents/checklist";
import { createClient } from "@/lib/supabase/server";

// Finding a document anywhere: the office library (Dokumentumok, by name,
// file name, folder and uploader) and each listing's own papers (by the
// listing, the paper's kind and file name). Words match without accents and
// all must appear. Used by the assistant's find_documents tool.

export type FoundDocument = {
  id: string;
  where: "library" | "listing";
  title: string;
  fileName: string;
  folder: string | null;
  listing: { id: string; title: string } | null;
  /** The clients, listings and deals a library file is linked to. */
  linkedTo: string[];
  uploadedAt: string;
  href: string;
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export async function findDocuments(user: CurrentUser, query: string, limit = 20): Promise<FoundDocument[]> {
  const words = fold(query)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);
  const org = user.organization.id;
  const supabase = await createClient();
  const [library, folders, papers] = await Promise.all([
    supabase.from("office_documents").select("id, title, file_name, folder_id, created_at, created_by").eq("organization_id", org).order("created_at", { ascending: false }).limit(1000),
    supabase.from("office_document_folders").select("id, name").eq("organization_id", org),
    supabase
      .from("property_documents")
      .select("id, kind, file_name, created_at, property_id")
      .eq("organization_id", org)
      .not("storage_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  const folderName = new Map((folders.data ?? []).map((f) => [f.id as string, f.name as string]));
  const linked = await linksOf(
    user,
    (library.data ?? []).map((d) => d.id as string),
  );
  const propertyIds = [...new Set((papers.data ?? []).map((p) => p.property_id as string))];
  const { data: properties } = propertyIds.length ? await supabase.from("properties").select("id, title, address, city").eq("organization_id", org).in("id", propertyIds) : { data: [] };
  const property = new Map((properties ?? []).map((p) => [p.id as string, p]));

  const all: (FoundDocument & { text: string })[] = [
    ...(library.data ?? []).map((d) => {
      const folder = d.folder_id ? (folderName.get(d.folder_id) ?? null) : null;
      const links = (linked.get(d.id) ?? []).map((l) => l.title);
      return {
        id: d.id,
        where: "library" as const,
        title: d.title,
        fileName: d.file_name,
        folder: folder ?? "Egyéb",
        listing: null,
        linkedTo: links,
        uploadedAt: d.created_at,
        href: `/documents?doc=${d.id}`,
        text: fold(`${d.title} ${d.file_name} ${folder ?? "egyeb"} ${links.join(" ")} dokumentum`),
      };
    }),
    ...(papers.data ?? []).map((d) => {
      const p = property.get(d.property_id);
      const kind = documentKinds[d.kind as DocumentKind]?.label ?? "Dokumentum";
      return {
        id: d.id,
        where: "listing" as const,
        title: `${kind}${p ? ` – ${p.title}` : ""}`,
        fileName: d.file_name ?? "",
        folder: null,
        listing: p ? { id: p.id as string, title: p.title as string } : null,
        linkedTo: [],
        uploadedAt: d.created_at,
        href: p ? `/properties/${p.id}` : "/properties",
        text: fold(`${kind} ${d.file_name ?? ""} ${p?.title ?? ""} ${p?.address ?? ""} ${p?.city ?? ""} ingatlan dokumentum`),
      };
    }),
  ];
  return all
    // Hungarian endings: "szerződést" still finds "szerződés" (a long word may lose its last two letters).
    .filter((d) => words.every((w) => d.text.includes(w.length > 5 ? w.slice(0, -2) : w)))
    .slice(0, limit)
    .map((d) => ({ id: d.id, where: d.where, title: d.title, fileName: d.fileName, folder: d.folder, listing: d.listing, linkedTo: d.linkedTo, uploadedAt: d.uploadedAt, href: d.href }));
}
