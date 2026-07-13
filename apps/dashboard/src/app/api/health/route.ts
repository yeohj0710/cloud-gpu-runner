import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}

export function GET() {
  return NextResponse.json(
    { ok: true, service: "cloud-gpu-dashboard" },
    { headers: { "cache-control": "no-store" } },
  );
}
