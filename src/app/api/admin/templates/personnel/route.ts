import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

const csv = [
  "email,full_name,committee,role,status,global_role,person_category,department,title",
  '"alex.chen@university.edu","Alex Chen","FBIT","Member","active","faculty","faculty","Information Technology","Associate Professor"',
  '"sam.patel@university.edu","Sam Patel","Faculty Board Information Technology","Staff","active","staff","staff","Information Technology","Coordinator"',
].join("\n");

export async function GET() {
  await requireAdmin();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="personnel-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
