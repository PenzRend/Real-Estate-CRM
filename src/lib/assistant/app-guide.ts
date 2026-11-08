// Where things are in Flavio, for "where/how do I…" questions. Keep it in step
// with the screens: the assistant answers these only from this list.

export type GuideEntry = { id: string; screen: string; href: string; how: string };

export const appGuide: GuideEntry[] = [
  {
    id: "menu",
    screen: "Menü",
    href: "/dashboard",
    how: "The side menu (on a phone the ☰ button at the top left): 'Mondd Flaviónak' (say what to do), 'Rögzítés' (log a call or meeting), 'Keresés', then Áttekintés, Ügyfelek, Ingatlanok, Ügyletek, Feladatok, Naptár, Levelek, Dokumentumok; in an office with colleagues also a 'Csapat' group with Üzenetek and Iroda. While Levelek is open, the menu shows 'Beérkezett' and 'Automatikus levelek' under it; while Dokumentumok is open, 'Fájlok', 'Szerződések' and 'Dokumentumkészítő' (on a phone these switch at the top of the page). Beállítások opens from your name at the bottom of the menu; 'Visszajelzés' is just above it. The AI assistant is the round button in the bottom-right corner. A listing's page has tabs: 'Áttekintés' (deals, viewings, matching clients, description, owner, tasks), 'Fotók', 'Papírok' (document checklist, contracts, linked files), 'Részletek' (all data, 'Ár és piac', weekly owner report, interested clients), 'Előzmények'; 'Ügylet indítása' is in its '…' menu. A client's page has 'Áttekintés' and 'Papírok' (anti-money-laundering identification, contracts, linked files). On a day with viewings Áttekintés shows 'Mai útvonal': today's own viewings in order with 'Navigáció' (Google Maps), 'Hívás' and 'Késem' (a ready SMS: about 10 minutes late), and 'Teljes útvonal' for the whole day. With phone notifications on, a 7:00 note sums up the day (viewings, the first one's time and place, tasks), and right after a viewing ends 'Hogy sikerült?' opens its feedback. New users see 'Első lépések' on Áttekintés until the first listing, client, mailbox and assistant request are done.",
  },
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
    how: "Client list with search and filters (status, follow-up, budget, location). Open a client for contact details, one-tap 'Hívás', 'SMS', 'WhatsApp', 'Viber' and 'E-mail' buttons (after a call, 'Hogy ment?' logs it in one tap: 'Megbeszéltük', 'Nem vette fel', 'Visszahív / később', 'Foglalt volt', with an optional note and follow-up task), 'Pénzmosás elleni azonosítás' (customer due diligence under the Pmt.: 'Azonosítás felvétele' opens a form for a private person – name, birth name, mother's name, birth place and date, nationality, address, ID document and its validity – or a company – registration data, representative, beneficial owners – plus the PEP declaration, purpose and source of funds; saved encrypted; 'Adatlap aláírásra' prints it for signing; deals warn when the buyer or seller is not identified; data is kept for 8 years, so such a client can't be permanently erased before that), 'Keresési igények', 'Előzmények', tasks, deals, viewings and 'Illő ingatlanok'. 'Szerkesztés' edits; 'Archiválás' archives (restorable).",
  },
  { id: "booking_link", screen: "Foglalási link", href: "/calendar", how: "Clients book viewings themselves: 'Foglalási link' at the top of Naptár. Switch it on, choose the days, from–to, the viewing length, the minimum notice and how far ahead clients may book; 'Másolás' copies the link to send (for one listing: the listing's '…' menu → 'Foglalási link másolása'). The client picks a listing (the office's active ones) and a free time, leaves a name and phone or email, and the viewing appears in Naptár marked 'Online foglalás'; a client already in Flavio is found by phone or email, otherwise added as a new lead. Times clashing with the agent's other Flavio viewings are not offered; other calendar events are not checked yet. 'Új link' replaces the address; 'Kikapcsolás' stops it." },
  { id: "client_import", screen: "Ügyfelek importálása", href: "/clients/import", how: "Bring existing clients over in one go: 'Importálás' on Ügyfelek. Drop an Excel (.xlsx), CSV or phone contacts (.vcf, exportable on iPhone and Android) file; Flavio guesses which column is the name, phone, email, type, budget (e.g. '40–60M'), wished areas, notes and source, the agent can change each column's meaning, sees how the first rows will look, then '… ügyfél átvétele'. Clients already in Flavio (same phone or email) are skipped and listed; imported clients get no welcome email or automatic documents. Up to 3000 rows at a time." },
  { id: "client_new", screen: "Új ügyfél", href: "/clients/new", how: "Add a client by hand: 'Új ügyfél' on Ügyfelek (or Ctrl+K → 'Új ügyfél'). Usually faster: 'Rögzítés' creates the client from the conversation." },
  {
    id: "properties",
    screen: "Ingatlanok",
    href: "/properties",
    how: "Listing list with filters. A listing's page has the description, details, owner, 'Fotók és videók' ('Fotók kezelése' to upload), 'Illő ügyfelek' ('Ajánlás mindenkinek' writes a personal offer to every matching buyer not yet offered it – strong and good matches ticked – to review and send all at once; it opens by itself right after a listing is added or imported, and a draft listing says how many clients it would suit once made active), viewings, tasks, 'Megosztás ügyféllel' (shareable link for a client), deals ('Ügylet indítása'), 'AI hirdetésszöveg' next to 'Leírás' (writes the ad from the listing's data in 'Kiegyensúlyozott', 'Rövid' or 'Részletes' style, lists missing facts such as the energy rating, 'Mentés a leírásba' or 'Másolás a portálhoz'), 'Ár és piac' (price per m² against comparable listings and agreed deal prices in the office's data, with a realistic range; 'Értékbecslő lap a tulajdonosnak' opens a printable valuation sheet, 'Nyomtatás / PDF'), 'Dokumentumok' (checklist: tulajdoni lap, energetikai tanúsítvány and megbízási szerződés required, plus floor plan, condominium deed, utility bills, other; 'Feltöltés' for a PDF, photo or Word file, 'Nem kell' when not needed, 'Hiányzók bekérése a tulajdonostól' emails the owner a list and sets a reminder), 'Heti riport a tulajdonosnak' (switch on 'Hetente automatikusan, hétfő reggel' to email the owner every Monday about the week's viewings, anonymous buyer feedback and offers from the agent's own mailbox; 'Riport most' drafts one to edit and send now; needs an owner with an email address) and 'Szerkesztés'. The status can be changed on the listing page.",
  },
  { id: "property_new", screen: "Új ingatlan", href: "/properties/new", how: "Add a listing by hand: 'Ingatlan hozzáadása' on Ingatlanok (or Ctrl+K → 'Új ingatlan')." },
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
    how: "Tabs 'Mai', 'Lejárt', 'Közelgő', 'Kész'. Create one with the form at the top of Feladatok (Teendők in the menu), or ask the assistant ('írj fel egy feladatot holnapra…'); tick the circle to complete. Tasks also come from 'Rögzítés' automatically.",
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
    how: "The round button in the bottom-right corner on every screen opens it (full page: the arrows in its corner). Answers questions about the agent's own clients, listings, deals, tasks and emails, and where things are in Flavio, and does things when asked: creates a task, logs a call or note, sets a follow-up date, adds a client, drafts a contract for review, writes an email into 'Kimenő levelek' for approval, opens a page; a viewing booking or moving a deal to another stage waits for 'Jóváhagyás' in the chat. It never sends anything itself and cannot delete. 'Mondd Flaviónak' (above 'Rögzítés' in the menu, the sound-wave button on a phone) or the microphone in the chat: say what to do, it listens until you stop talking.",
  },
  {
    id: "portals",
    screen: "Hirdetési portálok (export)",
    href: "/settings",
    how: "Listings go to real estate portals through an XML link: on a listing's page 'Portálokra' marks it (it shows 'Portálokon'; only active, reserved or under-negotiation listings are sent, without the street address). The owner or an admin creates the link once in Beállítások → Kapcsolatok → 'Hirdetési portálok (XML export)' → 'Export link létrehozása' and gives it to the portal; the portal then downloads the marked listings with their photos regularly. Portals (ingatlan.com, Otthon Centrum, Jófogás…) need a partner agreement for automatic import – the agency arranges that with the portal.",
  },
  {
    id: "phone-calls",
    screen: "Hívásnapló Androidról",
    href: "/settings",
    how: "Calls with clients on an Android phone can go onto the client's timeline by themselves ('Kimenő hívás (2 perc)', 'Nem fogadott hívás'); calls with numbers that are not a client's are not recorded. It needs the Flavio Android app, which is not available yet ('Hamarosan' in Beállítások → Kapcsolatok → 'Hívásnapló Androidról'; once it is, 'Telefon hozzáadása' there makes the key for it). On iPhone this is not possible: use the 'Hívás' button on the client's page and 'Hogy ment?'.",
  },
  {
    id: "office",
    screen: "Iroda",
    href: "/office",
    how: "How the month is going. On top, the office's commission ('Jutalék', from deals won this month) with a ring toward the target, what is still in open deals ('Folyamatban'), the days left and a forecast at the current pace; below it 'Lezárt ügylet', 'Új megbízás' (listings taken), 'Megtekintés' (viewings held) and 'Új ügyfél' (clients assigned). Then one card per agent ('Munkatársak') with progress bars against their own targets; the month's leader has a crown. The owner and admins set an agent's monthly targets with 'Havi célok megadása' / 'Célok módosítása' on the card (each saves when the field is left) and see everyone; an agent sees the office totals and their own card. The arrows switch month. The dashboard's 'A hónapom' card shows the agent's own month against the targets. New clients are shared out in Beállítások → Csapat → 'Új ügyfelek kiosztása': 'Aki felveszi' (the agent who adds it) or 'Sorban kiosztva' (in turn among the ticked colleagues); whoever gets a client from someone else is notified. On Ügyfelek, 'Csak az enyéim' shows only the agent's own clients.",
  },
  {
    id: "team-work",
    screen: "Csapatmunka",
    href: "/clients",
    how: "Handing a client to a colleague: the client's page → '…' → 'Átadás kollégának', pick the colleague and add a note; they become the client's agent and get a message with the client's card. Adding a client or listing that may already exist (same phone, email or name; same portal link or address) shows a warning with whose it is – it never blocks saving. Naptár shows colleagues' viewings with their name ('Iroda'); 'Csak az enyéim' shows only your own. Owners and admins see 'Múlt hét az irodában' on the dashboard from Monday to Wednesday (last week against the week before, the week's star) and get it as a Monday notification. Everyone can upload a profile picture in Beállítások → Profil.",
  },
  {
    id: "document-creator",
    screen: "Dokumentumkészítő",
    href: "/documents/templates",
    how: "Templates the office writes once and Flavio fills in: Dokumentumok → 'Dokumentumkészítő' → 'Új sablon' (or 'Példasablonok' for a welcome letter, a reservation agreement draft and a listing presentation). In the editor: '# címsor', '## alcím', '**félkövér**', '- felsorolás', 'Mező beszúrása' for fields such as {vevo_nev}, {ingatlan_cim}, {vetelar}, and 'AI-bekezdés' for a [[AI: …]] paragraph the AI writes from the record's data only. The right side previews it filled for a chosen client, listing or deal ('AI-val is' writes the AI paragraphs too); 'Dokumentum készítése' makes the Word file. 'Mikor készüljön?': 'Csak kézzel', 'Új ügyfélnél magától' or 'Új ügyletnél magától' – then it is made by itself and linked. 'Melyik mappába?' chooses the folder in Dokumentumok. On a client's, listing's or deal's page, 'Kapcsolódó fájlok' lists the files linked to it, and 'Sablonból' makes one there. Files are linked to clients, listings and deals in Dokumentumok ('Kapcsolás' under a file; when uploading, the AI suggests which ones the file is about).",
  },
  {
    id: "messages",
    screen: "Üzenetek",
    href: "/messages",
    how: "Chat inside Flavio. On the left the conversations: the whole office ('<iroda neve> – mindenki', everyone in the workspace reads it) and each colleague one to one (only the two of them see it); a private chat also opens with 'Üzenet' on a colleague in Beállítások → Csapat or on their card on Iroda. Write in the box at the bottom; Enter sends, Shift+Enter starts a new line. '@' and the start of a colleague's name offers them to mention (like in Slack); the mention shows their name and notifies them. The paperclip attaches a client, listing or deal as a card; 'Csapatnak' on a client's, listing's or deal's page does the same with a note. New messages arrive live; the menu shows how many are unread. Direct messages and @mentions in the office channel also come as phone notifications (where notifications are on). A deal closed as won posts a congratulation in the office channel. Your own message can be deleted with the bin icon next to it.",
  },
  {
    id: "documents",
    screen: "Dokumentumok",
    href: "/documents",
    how: "The office's shared files – contract templates, price lists, marketing material – for every member, laid out like a file explorer: the folders on the left ('Minden fájl', the office's folders, 'Egyéb' for files without a folder; '+ Új mappa' adds one; with a folder open, 'Átnevezés' and 'Törlés' at the top change or remove it – its files then go to 'Egyéb'), the open folder's files on the right with a path at the top. 'Minden fájl' shows the folders as tiles and the latest files. 'Feltöltés' or dragging files onto the list opens a window to name each file and choose its folder (in 'Minden fájl' the AI suggests a folder for each; in an open folder files go there). PDF, Word, Excel, PowerPoint, image or text, up to 20 MB each. Drag a file onto a folder (on the left or a tile) to move it. The search box looks through every folder by name, uploader and folder. A Word (.docx) file has 'Kitöltés': pick a deal (buyer, seller, listing and amounts together) or a client and a listing, and a filled copy downloads; the template's fields are written in curly brackets, e.g. {vevo_nev}, {elado_nev}, {ingatlan_cim}, {vetelar}, {foglalo}, {jutalek}, {datum} (the full list is in the 'Kitöltés' window). A file's '…' menu (for the uploader, the owner and admins): 'Átnevezés', 'Kitűzés felülre' (pinned files come first), 'Mappa' (move), 'Törlés'. A listing's own papers (tulajdoni lap, energetikai tanúsítvány…) are on the listing's page under 'Dokumentumok'. The AI assistant finds any file in both places ('Hol van a megbízási szerződés?').",
  },
  {
    id: "contracts",
    screen: "Szerződések",
    href: "/contracts",
    how: "Formal Hungarian contracts that Flavio drafts from the deal, the listing, the clients and their AML identification: megbízási szerződés (agency agreement), megtekintési lap (viewing sheet), foglalási megállapodás (reservation with deposit), adásvételi szerződés tervezet (sale and purchase draft, for the lawyer to countersign), bérleti szerződés and átadás-átvételi jegyzőkönyv. Start one on a deal's, listing's or client's page under 'Szerződések' ('Új szerződés'); drafts are also made by themselves: a megbízási when a listing is added, a megtekintési when a viewing is booked, a foglalási (or bérleti for a rental) when a deal starts, an átadás-átvételi when a deal moves to handover. The review page shows the missing fields (marked in the text), checks (e.g. a deposit above 10% of the price, dates in the wrong order), 'AI-ellenőrzés', the fields grouped by Felek / Ingatlan / Pénzügyek / Iroda, 'Szöveg szerkesztése' to change the wording, 'Mentés', 'Word letöltése' and 'Jóváhagyás és Word' (only once nothing required is missing; saves the Word file into Dokumentumok › Szerződések, linked to the deal, listing and client). The list at /contracts shows drafts waiting for review and the approved ones; the dashboard shows 'Átnézendő szerződések'. Under 'Amit Flavio megír' each contract has 'Testreszabás' (/contracts/templates/<kind>, owners and admins): edit the office's own wording with 'Mezők beszúrása' (fields filled from the records, amounts '+ betűvel'), '+ Új mező' for a field of the office's own (filled in on review), a live preview, 'Mentés', and 'Flavio alapszövege' to go back to the built-in text. 'Word vagy PDF feltöltése' reads the office's own contract and the AI rebuilds it as a template keeping its wording, turning blanks and case details into fields (identity, tax and bank numbers, emails and phones are cut out before the AI sees it; a scanned PDF can't be read, a Word file or text PDF can); review, then 'Mentés'. New drafts use the office's text.",
  },
  {
    id: "email-automation",
    screen: "Automatikus levelek",
    href: "/inbox/automation",
    how: "Under Levelek, 'Automatikus levelek' at the top. 'Szabályok': each rule says when an email is written (new client, viewing booked, after a viewing, deal started, deal closed, when a client has not been contacted for N days, when a new active listing suits a buyer well ('Új ingatlan, ami illik hozzá'), or when an active listing's price drops ('Árcsökkenés': to clients who viewed, asked about or made an offer on it)), after how long, and whether it goes by itself ('Magától megy') or waits for review ('Előbb átnézem'); the text uses fields like {keresztnev}, {ingatlan_megnevezes}, {megtekintes_ideje}, {ugynok_nev}, {ingatlan_link} (the listing's client page), {korabbi_ar} (the old price) and AI paragraphs written per client. 'Kész szabályok hozzáadása' adds ready-made rules switched off; the switch turns a rule on. 'Kimenő levelek' lists the messages: waiting for approval (edit subject and text, 'Jóváhagyás', 'Küldés most', 'Visszavonás'), scheduled, sent and failed. Emails go from the agent's own connected mailbox; one per client per event.",
  },
  {
    id: "settings",
    screen: "Beállítások",
    href: "/settings",
    how: "Name and agency name ('Profil'); team ('Csapat'): workspace members, inviting a colleague by email ('Meghívás' creates a link to send with 'Küldés e-mailben' or 'Link másolása'; owner and admins only), pending invites ('Új link', 'Visszavonás'), removing a member, leaving a workspace, switching between workspaces; the connected mailbox and calendar (Gmail or Outlook), the browser extension, and a calendar subscription link that puts viewings into Apple Calendar on iPhone/Mac, Outlook or other calendar apps ('Apple Naptár, Outlook és más naptárak' → 'Feliratkozási link létrehozása') ('Kapcsolatok'); exporting all data to one Excel file ('Adatok' → 'Exportálás Excelbe', owner and admins only); password change ('Jelszó'). Opened from your name at the bottom of the menu.",
  },
  { id: "feedback", screen: "Visszajelzés", href: "/dashboard", how: "Report a bug or idea to the Flavio team: 'Visszajelzés' at the bottom of the side menu." },
];
