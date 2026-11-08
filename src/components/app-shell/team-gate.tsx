import { getCurrentUser } from "@/lib/auth";
import { hasTeam } from "@/lib/team/has-team";
import { TeamNav } from "./sidebar";

/** The "Csapat" menu group, for offices with more than one member; a one-person office never sees it. */
export async function TeamGate() {
  return (await hasTeam(await getCurrentUser())) ? <TeamNav /> : null;
}
