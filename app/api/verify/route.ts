import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Persistent KYC mutation is intentionally disabled. Use the non-persistent risk simulation instead. */
export async function POST(req: Request) {
  void req;
  return NextResponse.json({ error: "Persistent KYC changes require an authenticated partner workflow" }, { status: 403 });
}
