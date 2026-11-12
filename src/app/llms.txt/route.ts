import { SITE, siteUrl } from "@/lib/site";

// llms.txt (llmstxt.org): a plain summary for AI assistants that are asked
// about Flavio. Every line describes what the product does today.

export function GET() {
  const url = siteUrl();
  const body = `# ${SITE.name}

> ${SITE.description}

Flavio is a Hungarian-language CRM for real estate agents in Hungary, with an AI assistant built in. It is currently in an invite-only free pilot.

## Mit csinál

- Hívás vagy megtekintés után diktálás vagy pár szavas jegyzet: az AI kiszedi az ügyfél nevét, keresését, keretét és a teendőket. Az agent mezőnként jóváhagyja; semmi nem mentődik a tudta nélkül.
- Ingatlan–ügyfél párosítás feltételenként (mi teljesül, mi majdnem, mi nem), és ajánló levél a hirdetés linkjével.
- Gmail- és Outlook-összekapcsolás: az ügyfelek levelei és az ingatlanportálos megkeresések bekerülnek, a hírlevelek kiszűrve. Válaszlevél-vázlat egy kattintással; küldés csak az agent kattintására.
- AI-asszisztens, amely csak az agent saját adataiból válaszol, és minden állításhoz forrást mutat.
- Hirdetés átvétele böngészőbővítménnyel az ingatlan.com-ról és más portálokról (adatok, fotók, videólinkek).
- Megtekintések a Google- vagy Outlook-naptárral együtt, iPhone-naptár feliratkozással; utána visszajelzés rögzítése.
- Megosztható, reklámmentes ingatlan-adatlap az agent elérhetőségével.
- Utánkövetés: mai és lejárt teendők, esedékes visszahívások; telefonos értesítések.
- Csapatok: közös munkaterület az iroda tagjainak, szerepkörökkel.

## Adatvédelem

- Minden adat munkaterülethez kötött; ezt az adatbázis kényszeríti ki (sorszintű jogosultság).
- Az adatbázis és a fájlok az EU-ban (Frankfurt) vannak tárolva. Az AI-feldolgozás amerikai szolgáltatóknál történik, a tájékoztatóban leírt módon.
- Részletek: ${url}/adatvedelem

## Hozzáférés

- A pilot meghívásos és ingyenes, bankkártya nem kell. Regisztráció meghívókóddal: ${url}/signup
- Nyelv: magyar.

## Linkek

- [Kezdőlap](${url}/)
- [Adatkezelési tájékoztató](${url}/adatvedelem)
- [Regisztráció](${url}/signup)
`;
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
