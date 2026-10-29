// The office's month per agent: new leads, viewings held, listings taken,
// deals won and their commission, against the month's targets. Pure, so it is
// tested; office-data.ts feeds it.

export type AgentTarget = { commission: number | null; deals: number | null; listings: number | null; viewings: number | null };

export type AgentMonth = {
  userId: string;
  name: string;
  leads: number;
  viewings: number;
  listings: number;
  dealsWon: number;
  commission: number;
  /** Commission of the agent's open deals (what may still come). */
  pipeline: number;
  target: AgentTarget | null;
};

export type MonthFacts = {
  members: { userId: string; name: string }[];
  /** Agent ids of clients created in the month (their agent). */
  leads: (string | null)[];
  /** Agent ids of viewings held in the month (who booked them). */
  viewings: (string | null)[];
  /** Agent ids of listings created in the month. */
  listings: (string | null)[];
  wonDeals: { agentId: string | null; commission: number | null }[];
  openDeals: { agentId: string | null; commission: number | null }[];
  targets: (AgentTarget & { userId: string })[];
};

const count = (ids: (string | null)[], id: string) => ids.filter((x) => x === id).length;

export function officeMonth(f: MonthFacts): { agents: AgentMonth[]; total: Omit<AgentMonth, "userId" | "name" | "target"> & { target: AgentTarget } } {
  const agents = f.members.map((m) => {
    const t = f.targets.find((x) => x.userId === m.userId);
    return {
      userId: m.userId,
      name: m.name,
      leads: count(f.leads, m.userId),
      viewings: count(f.viewings, m.userId),
      listings: count(f.listings, m.userId),
      dealsWon: f.wonDeals.filter((d) => d.agentId === m.userId).length,
      commission: f.wonDeals.filter((d) => d.agentId === m.userId).reduce((s, d) => s + (d.commission ?? 0), 0),
      pipeline: f.openDeals.filter((d) => d.agentId === m.userId).reduce((s, d) => s + (d.commission ?? 0), 0),
      target: t ? { commission: t.commission, deals: t.deals, listings: t.listings, viewings: t.viewings } : null,
    };
  });
  const sumTarget = (k: keyof AgentTarget) => {
    const values = agents.map((a) => a.target?.[k]).filter((v): v is number => v != null);
    return values.length ? values.reduce((s, v) => s + v, 0) : null;
  };
  return {
    agents: agents.sort((a, b) => b.commission - a.commission || b.dealsWon - a.dealsWon || a.name.localeCompare(b.name, "hu")),
    total: {
      // The office's totals count everything, also what isn't tied to a current member.
      leads: f.leads.length,
      viewings: f.viewings.length,
      listings: f.listings.length,
      dealsWon: f.wonDeals.length,
      commission: f.wonDeals.reduce((s, d) => s + (d.commission ?? 0), 0),
      pipeline: f.openDeals.reduce((s, d) => s + (d.commission ?? 0), 0),
      target: { commission: sumTarget("commission"), deals: sumTarget("deals"), listings: sumTarget("listings"), viewings: sumTarget("viewings") },
    },
  };
}

/** Progress toward a target, 0–100 (more than 100 when exceeded); null without a target. */
export const progressPercent = (value: number, target: number | null) => (target ? Math.round((value / target) * 100) : null);

/** "2026-10" → first and next month's first day ("2026-10-01", "2026-11-01"). */
export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const previous = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  return { start: `${month}-01`, end: `${next}-01`, next, previous };
}
