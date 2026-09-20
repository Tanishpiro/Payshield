import { NextResponse } from "next/server";
import { sb } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Demo control: flip a receiver's KYC state so the risk/trust score visibly moves. */
export async function POST(req: Request) {
  const { handle, kyc_status } = await req.json().catch(() => ({}) as any);
  if (!handle || !["verified", "partial", "unverified"].includes(kyc_status))
    return NextResponse.json({ error: "handle and kyc_status required" }, { status: 400 });

  const { error } = await sb()
    .from("ps_receivers")
    .update({ kyc_status, kyc_verified_at: kyc_status === "verified" ? new Date().toISOString() : null })
    .eq("handle", handle);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, handle, kyc_status });
}
