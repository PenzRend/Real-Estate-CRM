import "server-only";
import { lookup } from "node:dns/promises";
import { isPublicAddress } from "./address";

/**
 * Null when every address of the host is on the public internet; otherwise
 * the agent-facing reason. Checked before each request (and redirect) Flavio
 * makes to a server the agent named.
 */
export async function publicHostProblem(hostname: string): Promise<string | null> {
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    return `A(z) ${hostname} szerver nem található.`;
  }
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address))) return `A(z) ${hostname} nem nyilvános szerver.`;
  return null;
}
