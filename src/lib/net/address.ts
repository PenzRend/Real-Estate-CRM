// Which network addresses Flavio may connect to on an agent's behalf. Pure, no I/O.

/**
 * True for addresses on the public internet. Flavio connects to servers and
 * links the agent names, so private, loopback, link-local and other reserved
 * ranges are refused (no reaching into the server's own network).
 */
export function isPublicAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const [a, b] = v4.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return false;
  if (/^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff")) return false;
  if (v6.startsWith("64:ff9b:") || v6.startsWith("2001:db8:")) return false;
  return v6.includes(":");
}
