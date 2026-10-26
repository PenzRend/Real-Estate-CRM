/** Lowercase, accent-free, and stripped of PostgREST filter syntax characters. */
export function searchTerm(input: string) {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[*,()"\\:%]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
