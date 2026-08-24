import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

const csv = [
  "name,short_name,mandate,color,status",
  '"Faculty Board Information Technology","FBIT","Committee mandate or purpose.","#003C71","active"',
].join("\n");

export async function GET() {
  await requireAdmin();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="committee-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
