# Publishing the import extension to the Chrome Web Store

Once it's published, the import page's install card shows one button,
"Hozzáadás a Chrome-hoz", instead of the zip download. The Chrome Web Store
listing also works in Edge.

## What you need first

1. **The CRM's production address** (e.g. `https://app.<domain>.hu`), live
   with `APP_URL` set to it. The extension is built for one address.
2. **The privacy policy live** at `https://<address>/adatvedelem`, with
   `PRIVACY_CONTROLLER` (name and address of the data controller) and
   `PRIVACY_EMAIL` set. Until then, the page shows a placeholder.
3. **A Chrome Web Store developer account**:
   https://chrome.google.com/webstore/devconsole. There is a one-time
   registration fee of US$5, and 2-step verification must be on.

## Build the upload

```bash
npm run extension:pack -- https://app.example.hu
```

This writes `dist/flavio-extension-<version>.zip`, with the manifest at
the zip root and the CRM address built in. For each new upload, raise
`version` in `extension/manifest.json` first.

## Developer console: what to fill in

**Store listing**

- Name: `Flavio – Importálás` (from the manifest).
- Short description (max. 132 characters): `Saját hirdetéseid átvétele az
  Flavióba egy kattintással – adatok, fotók, videólinkek –, ellenőrzés
  után.`
- Detailed description:

  > A Flavio importáló bővítménye a saját vagy az irodád hirdetéseit
  > hozza át egy hirdetési portálról a CRM-be.
  >
  > • Egy hirdetés: nyisd meg, kattints a bővítményre, és a CRM megnyitja az
  > adatlapot kitöltve – fotókkal és videólinkekkel.
  > • Teljes profil: az ingatlanos vagy iroda oldaláról listát kapsz a
  > hirdetésekről, és látod, melyik van már a CRM-ben.
  > • Semmi nem mentődik, amíg te ellenőrzés után el nem mented.
  >
  > A bővítmény csak akkor olvas egy oldalt, amikor rákattintasz, vagy amikor a
  > CRM importálásra nyit meg egy hirdetést. Nem fut a háttérben, nem gyűjt
  > böngészési előzményt, és csak a te CRM-ednek küld adatot.
  >
  > Használatához Flavio-fiók kell.

- Category: Workflow & Planning (or Productivity). Language: Hungarian.
- Icon: `extension/icons/icon128.png`.
- Screenshots: at least one, 1280×800. Good choices are the extension popup
  over a listing, and the CRM review screen after an import. Use your own
  listing or a test listing.
- Small promo tile (440×280): optional.

**Privacy practices**

- Single purpose: `Brings the user's own property listings from a listing
  portal into their Flavio account for review and saving.`
- Permission justifications:
  - `activeTab`: reads the listing page the user is on, only when they click
    the extension.
  - `scripting`: runs the page reader (`collect.js`) in that tab after the
    click.
  - `storage`: keeps the extension's setting (the CRM's address).
  - Optional host permissions (`https://*/*`): asked at runtime, only for
    the photo server of a portal the user imports from (e.g. the portal's
    image CDN), so the extension can download that listing's photos in the
    user's browser. If the user declines, the import works without photos.
  - Content scripts on `ingatlan.com`: when the CRM opens one of the user's
    listings for import (address ending in `#crm-import`), they read it and
    send it back to the CRM. They do nothing on other ingatlan.com pages.
  - Content script on the CRM's own address: tells the CRM the extension is
    installed and passes downloaded photos to the CRM tab.
- Remote code: **No.**
- Data usage: tick **Website content** only. Then certify that:
  - data is not sold;
  - it is not used for purposes unrelated to the single purpose;
  - it is not used for creditworthiness.
- Privacy policy URL: `https://<address>/adatvedelem`.

**Distribution**

- Visibility: **Unlisted** is enough. Only people with the link (the install
  card) can find it, and there is no store search exposure.
- Regions: all, or only Hungary.

## After approval

Review usually takes a few days. Then:

1. Copy the listing's address (`https://chromewebstore.google.com/detail/…`).
2. Set `EXTENSION_CHROME_URL` to it in the production environment.
3. The install card switches to the one-click button.

## Safari (later)

Safari extensions ship inside a Mac/iOS app. You need:

- a Mac with Xcode;
- an Apple Developer account (US$99/year).

On the Mac, run:

```bash
xcrun safari-web-extension-converter dist/<unzipped upload>
```

Then build the app, test it, and submit it to the App Store. When it's
published, set `EXTENSION_SAFARI_URL`.
