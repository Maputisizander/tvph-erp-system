import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateExportBuffer } from "@/utils/import-export";
import { requireCapability } from "@/lib/auth/permissions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const supabase = await createClient();
  const { error: authError } = await requireCapability("export.financial", supabase);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError === "Unauthorized" ? 401 : 403 });
  }

  const { data: prs, error } = await supabase
    .from("purchase_requests")
    .select(`
      *,
      vendors (
        name
      ),
      projects (
        name
      )
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: Record<string, any>[] = [];

  for (const pr of prs || []) {
    rows.push({
      "PR Number": pr.pr_number,
      Description: pr.description || "",
      "Project Name": pr.projects?.name || "",
      "Vendor Name": pr.vendors?.name || "",
      Amount: pr.amount || 0,
      Currency: pr.currency || "PHP",
      "Downpayment Amount": pr.dp_amount || 0,
      Status: pr.status || "",
      "Created Date": pr.created_at ? new Date(pr.created_at).toLocaleDateString() : "",
    });
  }

  const blob = generateExportBuffer(rows, format);
  const filename = `purchase_requests_${new Date().toISOString().split("T")[0]}.${format}`;

  return new NextResponse(blob, {
    headers: {
      "Content-Type": blob.type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}