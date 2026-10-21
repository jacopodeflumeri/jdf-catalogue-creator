import { NextResponse } from "next/server";
import { config } from "@/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      version: config.app.version,
      commit: config.app.commit,
      environment: config.app.environment || "unknown",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
