import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";

/** A client, listing or page that doesn't exist (or isn't in this workspace). */
export default function AppNotFound() {
  return (
    <Card>
      <EmptyState
        icon={SearchX}
        title="Ez az oldal nem található"
        description="Lehet, hogy törölték, archiválták, vagy egy másik munkaterülethez tartozik."
        action={<ButtonLink href="/dashboard">Vissza az áttekintéshez</ButtonLink>}
      />
    </Card>
  );
}
