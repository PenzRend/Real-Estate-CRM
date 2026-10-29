// Where things are in Flavio, for "where/how do I…" questions. Keep it in step
// with the screens: the assistant answers these only from this list.

export type GuideEntry = { id: string; screen: string; href: string; how: string };

export const appGuide: GuideEntry[] = [
  {
    id: "dashboard",
    screen: "Áttekintés",
    href: "/dashboard",
    how: "Start screen. 'Mai feladatok' (today's and overdue tasks), 'Javaslatok', recent activity, newest listings and clients. At the top, 'Mi történt, amíg távol voltál' summarises new emails; there each email has a 'Válaszvázlat' (AI reply draft) that can be edited and sent with 'Küldés' once sending from the connected Gmail or Outlook mailbox is allowed.",
  },
  {
    id: "capture",
    screen: "Rögzítés",
    href: "/interactions/new",
    how: "Record a call, meeting, viewing or note by voice or text: the 'Rögzítés' button at the top of the menu, or on a client's page. AI fills in the client, requirements, tasks and follow-up date; review and save.",
  },
  {
    id: "clients",
    screen: "Ügyfelek",
    href: "/clients",
    how: "Client list with search and filters (status, follow-up, budget, location). Open a client for contact details, one-tap 'Hívás', 'SMS', 'WhatsApp', 'Viber' and 'E-mail' buttons (after a call, 'Hogy ment?' logs it in one tap: 'Megbeszéltük', 'Nem vette fel', 'Visszahív / később', 'Foglalt volt', with an optional note and follow-up task), 'Keresési igények', 'Előzmények', tasks, deals, viewings and 'Illő ingatlanok'. 'Szerkesztés' edits; 'Archiválás' archives (restorable).",
  },
  { id: "client_new", screen: "Új ügyfél", href: "/clients/new", how: "Add a client by hand: 'Gyors műveletek' → 'Új ügyfél' in the menu. Usually faster: 'Rögzítés' creates the client from the conversation." },
  {
    id: "properties",
    screen: "Ingatlanok",
    href: "/properties",
    how: "Listing list with filters. A listing's page has the description, details, owner, 'Fotók és videók' ('Fotók kezelése' to upload), 'Illő ügyfelek' ('Ajánlás mindenkinek' writes a personal offer to every matching buyer not yet offered it – strong and good matches ticked – to review and send all at once; it opens by itself right after a listing is added or imported, and a draft listing says how many clients it would suit once made active), viewings, tasks, 'Megosztás ügyféllel' (shareable link for a client), deals ('Ügylet indítása'), 'AI hirdetésszöveg' next to 'Leírás' (writes the ad from the listing's data in 'Kiegyensúlyozott', 'Rövid' or 'Részletes' style, lists missing facts such as the energy rating, 'Mentés a leírásba' or 'Másolás a portálhoz'), 'Ár és piac' (price per m² against comparable listings and agreed deal prices in the office's data, with a realistic range; 'Értékbecslő lap a tulajdonosnak' opens a printable valuation sheet, 'Nyomtatás / PDF'), 'Dokumentumok' (checklist: tulajdoni lap, energetikai tanúsítvány and megbízási szerződés required, plus floor plan, condominium deed, utility bills, other; 'Feltöltés' for a PDF, photo or Word file, 'Nem kell' when not needed, 'Hiányzók bekérése a tulajdonostól' emails the owner a list and sets a reminder), 'Heti riport a tulajdonosnak' (switch on 'Hetente automatikusan, hétfő reggel' to email the owner every Monday about the week's viewings, anonymous buyer feedback and offers from the agent's own mailbox; 'Riport most' drafts one to edit and send now; needs an owner with an email address) and 'Szerkesztés'. The status can be changed on the listing page.",
  },
  { id: "property_new", screen: "Új ingatlan", href: "/properties/new", how: "Add a listing by hand: 'Gyors műveletek' → 'Új ingatlan', or 'Ingatlan hozzáadása' on Ingatlanok." },
  {
    id: "import",
    screen: "Importálás hirdetésből",
    href: "/properties/import",
    how: "Create a listing from an ingatlan.com or other portal ad: paste the link, or use the Flavio browser extension (the 'Importáló bővítmény' installation steps are on this page). Photos come along.",
  },
  {
    id: "viewings",
    screen: "Megtekintés foglalása",
    href: "/clients",
    how: "On a client's or a listing's page, the 'Megtekintések' card → 'Foglalás'. With a Gmail or Outlook mailbox connected and its calendar allowed, it also goes into that calendar (Google Calendar or the Outlook calendar); for Apple Calendar (iPhone/Mac), subscribe once in Beállítások → Kapcsolatok. The morning before a viewing the client automatically gets an email from the agent's mailbox with the time, address, a map link and a link to answer 'Ott leszek' / 'Nem tudok jönni' (the answer shows on the viewing as 'Visszaigazolta' / 'Nem tud jönni', with their message, and the agent gets a notification); 'Emlékeztető' on an upcoming viewing sends it right away. After the viewing, 'Visszajelzés a megtekintésről' records how it went.",
  },
  {
    id: "matches",
    screen: "Illő ingatlanok / Illő ügyfelek",
    href: "/clients",
    how: "On a client's page 'Illő ingatlanok', on a listing's page 'Illő ügyfelek': rule-based matches with reasons. 'Ajánlom' creates a task to offer it and can open 'Ajánlat küldése' (an email draft to the client). A match can be hidden and restored.",
  },
  {
    id: "search",
    screen: "Keresés (Ctrl+K)",
    href: "/dashboard",
    how: "Ctrl+K (⌘K on a Mac), or 'Keresés' in the menu (the magnifier on a phone): type a few letters of a client's name, email or phone number (accents and spaces optional), a listing's title, address or reference, a deal, an email subject or sender, or a task – Enter opens it. It also jumps to any screen and to 'Új ügyfél', 'Új ingatlan', 'Új ügylet', 'Új feladat', 'Hirdetés importálása', 'Rögzítés'. Archiving a client or listing and hiding an email happen at once, with 'Visszavonás' in the note at the bottom for a few seconds.",
  },
  {
    id: "deals",
    screen: "Ügyletek",
    href: "/deals",
    how: "Deals from the buyer's offer to the commission, as a board by stage: Ajánlat, Foglaló, Adásvételi, Finanszírozás, Birtokbaadás, Jutalék; tabs 'Folyamatban', 'Sikeres', 'Meghiúsult', with this month's expected commission on top. Start one with 'Új ügylet' or 'Ügylet indítása' on a listing's or a client's page. On a deal: 'Tovább: …' moves it to the next stage ('Jutalék megérkezett – lezárás' closes it as won, the listing becomes sold), dates under 'Határidők' (deposit, contract, financing, handover, commission) save themselves and each becomes a task, 'Ajánlatok' records offers and counter-offers ('Elfogadva' sets the agreed price), 'Ár és jutalék' (percentage or fixed), 'Felek' (buyer, seller, and the lawyer, bank or mortgage adviser with one-tap call), 'Meghiúsult' with a reason.",
  },
  {
    id: "tasks",
    screen: "Feladatok",
    href: "/tasks",
    how: "Tabs 'Mai', 'Lejárt', 'Közelgő', 'Kész'. Create one with 'Gyors műveletek' → 'Új feladat'; tick the circle to complete. Tasks also come from 'Rögzítés' automatically.",
  },
  {
    id: "inbox",
    screen: "Levelek",
    href: "/inbox",
    how: "Emails from clients and portal inquiries from all connected mailboxes, in one list. Several mailboxes can be connected: Gmail / Google Workspace, Outlook / Microsoft 365, and any other mailbox by IMAP/SMTP – a business address on its own domain, iCloud, Yahoo, Zoho ('Céges, iCloud vagy más': email address and password, an app password for iCloud or with two-step sign-in; server settings are found automatically and can be edited under 'Szerverbeállítások'). Add more with 'Postafiók hozzáadása'; 'Alapértelmezett' picks the mailbox new emails and offers are sent from (replies always go from the mailbox the email came to); 'Leválasztás' removes one. Tabs 'Feldolgozandó', 'Feldolgozott', 'Elrejtett' hold the relevant emails Flavio keeps; 'Összes levél' shows the whole mailbox live (pick the mailbox, search sender/subject/text, 'Régebbi levelek' for older ones, click an email to read it), and 'Feldolgozás' there brings any email into Flavio. Processing an email works like 'Rögzítés'; 'Elrejtés' hides it. 'Szinkronizálás' fetches new mail from every mailbox.",
  },
  {
    id: "calendar",
    screen: "Naptár",
    href: "/calendar",
    how: "A big month view ('Hónap', the default; click a day for that week) and a week view ('Hét'), with 'Ma' and previous/next. Shows the workspace's viewings, the agent's own tasks, and the agent's own calendars. All calendar connections are behind the 'Naptárak' button at the top of the calendar (a popup) and also in Beállítások → Naptárak: their Google or Outlook calendars ('Engedélyezés' or connect the account), their Apple iCloud calendars (the iPhone calendar: the 'Apple iCloud-naptár' card walks through three steps – 'Apple-fiók megnyitása', there Bejelentkezés és biztonság → Alkalmazásspecifikus jelszavak → name it Flavio → Létrehozás, then paste the password Apple shows ('Beillesztés') and click 'Kész – naptáraim megjelenítése'; the normal Apple password does not work; connecting an iCloud mailbox in Levelek adds the calendars automatically; other CalDAV servers under 'Más naptárszerver'), and any other calendar by its iCal/webcal link ('Más naptár hozzáadása linkkel'). Only the agent sees their own calendars. The other way round, 'A Flavio a többi naptáradban' creates a subscription link that puts viewings into iPhone, Mac, Outlook or any calendar app.",
  },
  {
    id: "settings-calendars",
    screen: "Beállítások → Naptárak",
    href: "/settings/calendars",
    how: "The same calendar connections as the 'Naptárak' button on the calendar page: the iPhone (iCloud) calendar in three guided steps, Google and Outlook calendars, other calendars by link, and the subscription link that puts viewings into iPhone, Mac, Outlook or any calendar app ('Új link létrehozása').",
  },
  {
    id: "assistant",
    screen: "AI-asszisztens",
    href: "/assistant",
    how: "This chat, also available from the round button in the bottom-right corner on every screen. Answers questions about the agent's own clients, listings, tasks and emails, and where things are in Flavio. It only reads.",
  },
  {
    id: "settings",
    screen: "Beállítások",
    href: "/settings",
    how: "Name and agency name ('Profil'); team ('Csapat'): workspace members, inviting a colleague by email ('Meghívás' creates a link to send with 'Küldés e-mailben' or 'Link másolása'; owner and admins only), pending invites ('Új link', 'Visszavonás'), removing a member, leaving a workspace, switching between workspaces; the connected mailbox and calendar (Gmail or Outlook), the browser extension, and a calendar subscription link that puts viewings into Apple Calendar on iPhone/Mac, Outlook or other calendar apps ('Apple Naptár, Outlook és más naptárak' → 'Feliratkozási link létrehozása') ('Kapcsolatok'); exporting all data to one Excel file ('Adatok' → 'Exportálás Excelbe', owner and admins only); password change ('Jelszó'). Also reachable from the account menu.",
  },
  { id: "feedback", screen: "Visszajelzés", href: "/dashboard", how: "Report a bug or idea to the Flavio team: 'Visszajelzés' at the bottom of the side menu." },
];
