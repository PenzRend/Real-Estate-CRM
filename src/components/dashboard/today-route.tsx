import { Clock, MessageSquare, Navigation, Phone, Route } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { dayRoute, directionsTo, hhmm, lateText, placeOf, smsLink, todaysViewings, type DayViewing } from "@/lib/viewings/day";

const action = "inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-ink hover:bg-surface";

/**
 * "Mai útvonal": on a viewing day, today's viewings in order with the
 * buttons an agent needs on the road – directions, a call, and "Késem" (a
 * ready "running late" text). Hidden on days without viewings.
 */
export function TodayRoute({ viewings, now, agent }: { viewings: (DayViewing & { client: { id: string } })[]; now: Date; agent: string | null }) {
  const today = todaysViewings(viewings, now);
  if (!today.length) return null;
  const route = dayRoute(today, now);
  return (
    <Card>
      <CardHeader
        title="Mai útvonal"
        count={today.length}
        action={
          route ? (
            <a href={route} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-accent">
              <Route className="size-4" /> Teljes útvonal
            </a>
          ) : undefined
        }
      />
      <ol className="divide-y divide-border">
        {today.map((v) => {
          const end = new Date(v.startsAt).getTime() + v.durationMinutes * 60_000;
          const past = end < now.getTime();
          const place = placeOf(v);
          return (
            <li key={v.id} className={cn("flex flex-col gap-2 px-5 py-3.5", past && "opacity-55")}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink tabular-nums">
                  <Clock className="size-3" /> {hhmm(v.startsAt)}
                </span>
                <span className="min-w-0">
                  <Link href={`/clients/${v.client.id}`} className="block truncate text-sm font-medium text-ink hover:underline">
                    {v.client.name}
                  </Link>
                  <span className="block truncate text-xs text-muted">{place || v.property.name}</span>
                </span>
              </div>
              {!past && (
                <div className="flex flex-wrap gap-1.5 pl-[3.6rem]">
                  {place && (
                    <a href={directionsTo(place)} target="_blank" rel="noopener noreferrer" className={action}>
                      <Navigation className="size-3.5" /> Navigáció
                    </a>
                  )}
                  {v.client.phone && (
                    <>
                      <a href={`tel:${v.client.phone.replace(/[^\d+]/g, "")}`} className={action}>
                        <Phone className="size-3.5" /> Hívás
                      </a>
                      <a href={smsLink(v.client.phone, lateText(agent))} className={action}>
                        <MessageSquare className="size-3.5" /> Késem
                      </a>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
