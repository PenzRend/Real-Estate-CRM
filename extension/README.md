# Flavio – Importálás (Chrome extension)

Brings your own listings from a property portal into the CRM in one click,
through the CRM's review screen. Nothing is saved until you press
**Ingatlan mentése** in the CRM.

## Install (pilot, developer mode)

The CRM's import page has an **Importáló bővítmény** card: **Bővítmény letöltése**
gives a zip already set to that CRM's address. Unzip it, then:

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and choose this `extension` folder. After pulling
   changes, click the reload icon on the extension's card.
3. Pin the extension. In its popup, under **Beállítások**, the CRM address is
   `http://localhost:3000` by default; change it for a deployed CRM.

## Use

- **One listing:** open the listing (e.g. `https://ingatlan.com/34567890`),
  click the extension, tick "Ez a saját vagy az irodám hirdetése", then
  **Importálás a CRM-be**. The CRM opens with the form filled in by the AI.
- **Agent or office profile:** open the profile page, click the extension,
  tick the box, then **Lista megnyitása a CRM-ben**. The CRM lists the
  listings it found and marks those already imported. **Importálás** opens a
  listing in a new tab; the extension reads it there and sends it back to the
  CRM for review.

## What it does and doesn't do

- It reads a page only when you click it, or when the CRM opens one of your
  listings for import (address ending in `#crm-import`, ingatlan.com only).
  It never runs in the background, on a schedule, or on other pages.
- It reads what your browser shows: the page text, the page's structured data
  and links to listing pages. It doesn't depend on the portal's exact markup.
- Data goes to the CRM in the address fragment (`#import=…`), which browsers
  never send to a server; the CRM page reads it once and removes it.
- Photos: the first import from a portal asks once for permission to download
  from its photo server (e.g. the portal's image CDN). The photos are
  downloaded by your browser, kept in the CRM tab's own storage, and after you
  save the listing they are uploaded to it (resized, location data removed).
  Declining imports the listing without photos. Video and virtual-tour links
  (YouTube, Vimeo, Matterport) are saved on the listing as links.
- The extension also runs a tiny script on the CRM's own pages
  (`http://localhost:3000`), so the CRM knows it is installed and can receive
  the photos. For a deployed CRM add its address to `manifest.json`
  (`content_scripts` → `bridge.js`).

For a wider rollout, publish it through the Chrome Web Store.
