import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("email, full_name, status, global_role, person_category, department, title, created_at")
    .order("full_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const headers = [
    "email",
    "full_name",
    "status",
    "global_role",
    "person_category",
    "department",
    "title",
    "created_at",
  ];
  const csv = [
    headers.map(csvCell).join(","),
    ...(data ?? []).map((row) =>
      headers.map((key) => csvCell(row[key as keyof typeof row])).join(","),
    ),
  ].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fbit-portal-users-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
