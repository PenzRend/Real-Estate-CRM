// Reads the active tab only when the popup is opened (activeTab), shows what
// it found, and sends it to the CRM's import page for review.

const DEFAULT_CRM = "http://localhost:3000";
const $ = (id) => document.getElementById(id);

let tabId = null;
let collected = null;

async function collect(mode) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["collect.js"] });
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: (m) => globalThis.__crmCollect(m), args: [mode] });
  return result;
}

function show(result) {
  collected = result;
  const found = $("found");
  found.hidden = false;
  $("own-row").hidden = false;
  $("import").hidden = false;
  $("other").hidden = false;
  if (result.kind === "listing") {
    $("status").textContent = "Hirdetés ezen az oldalon. A Flavio kitölti az adatlapot, te ellenőrzöd és mented.";
    const title = result.text.split("\n").find((l) => l.trim().length > 10)?.slice(0, 120) ?? result.url;
    const extras = [result.images.length ? `${result.images.length} fotó` : null, result.videos.length ? `${result.videos.length} videólink` : null].filter(Boolean).join(", ");
    found.textContent = extras ? `${title} – ${extras}` : title;
    $("own-text").textContent = "Ez a saját vagy az irodám hirdetése.";
    $("import").textContent = "Importálás a Flavióba";
    $("other").textContent = "Inkább az oldalon lévő hirdetések listája";
  } else {
    const n = result.listings.length;
    $("status").textContent = n
      ? "Ezen az oldalon több hirdetés van. A Flavióban látod, melyik van már bent, és egyenként importálhatod őket."
      : "Ezen az oldalon nem találtam hirdetésre mutató linket.";
    found.textContent = `${n} hirdetés`;
    $("own-text").textContent = "Ezek a saját vagy az irodám hirdetései.";
    $("import").textContent = "Lista megnyitása a Flavióban";
    $("other").textContent = "Inkább ezt az oldalt importálom egy hirdetésként";
  }
  update();
}

function update() {
  const empty = collected?.kind === "profile" && collected.listings.length === 0;
  $("import").disabled = !collected || empty || !$("own").checked;
}

async function init() {
  const { crmUrl } = await chrome.storage.sync.get({ crmUrl: DEFAULT_CRM });
  $("crm").value = crmUrl;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\//.test(tab.url ?? "")) {
    $("status").textContent = "Nyiss meg egy hirdetést vagy egy ingatlanos profiloldalt, és kattints újra.";
    return;
  }
  tabId = tab.id;
  try {
    show(await collect("auto"));
  } catch {
    $("status").innerHTML = '<span class="error">Ezt az oldalt nem tudom olvasni.</span>';
  }
}

$("own").addEventListener("change", update);

$("other").addEventListener("click", async () => {
  $("own").checked = false;
  show(await collect(collected.kind === "listing" ? "profile" : "listing"));
});

/** The photo servers the listing (or the profile's listings) use, as permission patterns. */
function photoOrigins() {
  const urls = collected.kind === "listing" ? collected.images : collected.thumbs || [];
  const origins = new Set();
  for (const u of urls) {
    try {
      origins.add(`${new URL(u).origin}/*`);
    } catch {
      // not a URL
    }
  }
  return [...origins].slice(0, 5);
}

$("import").addEventListener("click", async () => {
  $("import").disabled = true;
  // Ask for the photo permission inside this click (browsers only allow it
  // then), but don't wait for the answer before sending: the question can
  // close this popup. The background waits for the answer before downloading.
  const origins = photoOrigins();
  const permission = origins.length ? chrome.permissions.request({ origins }).catch(() => false) : null;
  try {
    const [{ result: fragment }] = await chrome.scripting.executeScript({ target: { tabId }, func: (p) => globalThis.__crmEncode(p), args: [collected] });
    await chrome.runtime.sendMessage({ type: "open-crm", fragment, source: collected.url, images: collected.kind === "listing" ? collected.images : [] });
  } catch {
    $("status").innerHTML = '<span class="error">Nem sikerült elküldeni a Flaviónak. Töltsd újra a bővítményt a chrome://extensions oldalon.</span>';
    $("import").disabled = false;
    return;
  }
  if (permission) await permission;
  window.close();
});

$("save").addEventListener("click", async () => {
  let value = $("crm").value.trim().replace(/\/+$/, "");
  try {
    const u = new URL(value);
    if (!/^https?:$/.test(u.protocol)) throw new Error();
    value = u.origin;
  } catch {
    $("crm").value = "";
    $("crm").placeholder = "Érvénytelen cím";
    return;
  }
  await chrome.storage.sync.set({ crmUrl: value });
  $("crm").value = value;
  $("save").textContent = "Elmentve";
});

init();
