// Where things are in Flavio, for "where/how do I…" questions. Keep it in step
// with the screens: the assistant answers these only from this list.

export type GuideEntry = { id: string; screen: string; href: string; how: string };

export const appGuide: GuideEntry[] = [
  {
    id: "dashboard",
    screen: "Áttekintés",
    href: "/dashboard",
    how: "Start screen. 'Mai feladatok' (today's and overdue tasks), 'Javaslatok', recent activity, newest listings and clients. At the top, 'Mi történt, amíg távol voltál' summarises new emails; there each email has a 'Válaszvázlat' (AI reply draft) that can be edited and sent with 'Küldés' once Gmail sending is allowed.",
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
    how: "Client list with search and filters (status, follow-up, budget, location). Open a client for contact details, 'Keresési igények', 'Előzmények', tasks, viewings and 'Illő ingatlanok'. 'Szerkesztés' edits; 'Archiválás' archives (restorable).",
  },
  { id: "client_new", screen: "Új ügyfél", href: "/clients/new", how: "Add a client by hand: 'Gyors műveletek' → 'Új ügyfél' in the menu. Usually faster: 'Rögzítés' creates the client from the conversation." },
  {
    id: "properties",
    screen: "Ingatlanok",
    href: "/properties",
    how: "Listing list with filters. A listing's page has the description, details, owner, 'Fotók és videók' ('Fotók kezelése' to upload), 'Illő ügyfelek', viewings, tasks, 'Megosztás ügyféllel' (shareable link for a client) and 'Szerkesztés'. The status can be changed on the listing page.",
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
    how: "On a client's or a listing's page, the 'Megtekintések' card → 'Foglalás'. With Google Calendar connected it also goes into the calendar. After the viewing, 'Visszajelzés a megtekintésről' records how it went.",
  },
  {
    id: "matches",
    screen: "Illő ingatlanok / Illő ügyfelek",
    href: "/clients",
    how: "On a client's page 'Illő ingatlanok', on a listing's page 'Illő ügyfelek': rule-based matches with reasons. 'Ajánlom' creates a task to offer it and can open 'Ajánlat küldése' (an email draft to the client). A match can be hidden and restored.",
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
    how: "Emails from clients and portal inquiries from the connected Gmail. Tabs 'Feldolgozandó', 'Feldolgozott', 'Elrejtett'. Processing an email works like 'Rögzítés'; 'Elrejtés' hides it. 'Szinkronizálás' fetches new mail; connecting Gmail starts here too.",
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
    how: "Name and agency name ('Profil'), Gmail and Google Calendar connection and the browser extension ('Kapcsolatok'), password change ('Jelszó'). Also reachable from the account menu.",
  },
  { id: "feedback", screen: "Visszajelzés", href: "/dashboard", how: "Report a bug or idea to the Flavio team: 'Visszajelzés' at the bottom of the side menu." },
];
