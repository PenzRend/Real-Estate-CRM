import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exportWorkbook } from "@/lib/export/workbook";
import { canManageTeam } from "@/lib/team";

// The whole workspace as one Excel file, for the owner and admins: their data
// is theirs to take, and agencies ask for it before they commit.
export async function GET() {
  const user = await getCurrentUser();
  if (!canManageTeam(user)) return new NextResponse("Csak a tulajdonos és az adminok exportálhatnak.", { status: 403 });
  try {
    const file = await exportWorkbook(user);
    const day = new Intl.DateTimeFormat("sv-SE", { timeZone: user.timezone }).format(new Date());
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="flavio-export-${day}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("export", error instanceof Error ? error.message : error);
    return new NextResponse("Az exportálás nem sikerült. Próbáld újra.", { status: 500 });
  }
}
