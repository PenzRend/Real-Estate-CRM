import { z } from "zod";
import { toE164 } from "@/lib/contact";

// What the phone app sends to /api/calls: one call, or up to 50 at once (when
// it was offline). Pure, so it is tested; calls.ts records them.

const call = z.object({
  number: z.string().max(40).transform((v, ctx) => {
    const e164 = toE164(v);
    if (!e164) ctx.addIssue({ code: "custom", message: "invalid number" });
    return e164 ?? "";
  }),
  direction: z.enum(["incoming", "outgoing", "missed"]),
  startedAt: z.iso.datetime({ offset: true }),
  durationSeconds: z.number().int().min(0).max(86_400),
});

export type CallReport = z.infer<typeof call>;

export const callReportSchema = z.union([z.object({ calls: z.array(call).min(1).max(50) }).transform((v) => v.calls), call.transform((c) => [c])]);

/** The key from an "Authorization: Bearer …" header, or null. */
export function bearerToken(header: string | null) {
  const m = header?.match(/^Bearer\s+([\w-]+)$/i);
  return m ? m[1] : null;
}
