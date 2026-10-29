"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog ("Mentés PDF-ként" saves it as a PDF). */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer /> Nyomtatás / PDF
    </Button>
  );
}
