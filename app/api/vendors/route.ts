import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.PARTNER_API_KEY || auth !== `Bearer ${process.env.PARTNER_API_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: vendors, error } = await supabase
    .from("vendors")
    .select("id, vendor_code, name, status")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(vendors || []);
}
