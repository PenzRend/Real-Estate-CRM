// Which folder an uploaded file probably belongs in, from its name: shared
// words with a folder's name, plus a few everyday meanings (a "megbízási
// szerződés" belongs with contracts, an "árlista" with marketing). Pure, so it
// is tested; the AI suggestion (documents/actions.ts) falls back to this.

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

// File-name words → words a matching folder's name tends to contain.
const MEANINGS: [RegExp, RegExp][] = [
  [/szerzod|megbiz|adasvet|foglalo|elovasarl|contract|berleti/, /szerzod|contract|minta/],
  [/sablon|minta|template|urlap|nyomtatv/, /sablon|minta|template|urlap/],
  [/arlista|marketing|plakat|brosur|szorolap|logo|hirdetes|banner|bemutat|prezentac/, /marketing|hirdet|arculat/],
  [/szamla|berlet|iroda|munkaido|szabadsag|belso|szabalyzat|hr/, /iroda|belso|ugyek|adminisztr/],
  [/tulajdoni|energet|alaprajz|tanusitv|hatarozat/, /ingatlan|okirat|papir|dokument/],
];

export function suggestFolder(fileName: string, folders: { id: string; name: string }[]): string | null {
  const name = fold(fileName.replace(/\.[a-z0-9]{1,5}$/i, ""));
  const own = new Set(words(name));
  let best: { id: string; score: number } | null = null;
  for (const f of folders) {
    const folder = fold(f.name);
    let score = words(folder).filter((w) => [...own].some((o) => o.startsWith(w.slice(0, 5)) || w.startsWith(o.slice(0, 5)))).length * 2;
    for (const [fileRe, folderRe] of MEANINGS) if (fileRe.test(name) && folderRe.test(folder)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { id: f.id, score };
  }
  return best?.id ?? null;
}
