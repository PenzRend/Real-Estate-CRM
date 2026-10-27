"use client";

import { CircleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";

/** Anything unexpected inside the app: the sidebar stays, the page offers a retry. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card>
      <EmptyState
        icon={CircleAlert}
        title="Valami nem sikerült"
        description="Az adataid biztonságban vannak. Próbáld újra; ha ismét előjön, szólj nekünk a Visszajelzés gombbal."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => retry()}>Újrapróbálás</Button>
            <ButtonLink href="/dashboard" variant="secondary">
              Vissza az áttekintéshez
            </ButtonLink>
          </div>
        }
      />
    </Card>
  );
}
