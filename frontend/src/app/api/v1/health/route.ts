import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";
    const response = await fetch(new URL("/api/v1/health", backendUrl), {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    const health: unknown = response.ok ? await response.json() : null;

    if (
      typeof health !== "object" ||
      health === null ||
      !("status" in health) ||
      !("service" in health) ||
      health.status !== "ok" ||
      health.service !== "lumical-backend"
    ) {
      throw new Error("Backend health unavailable");
    }

    return NextResponse.json(
      { status: health.status, service: health.service },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable", service: "lumical-backend" },
      { status: 502, headers },
    );
  }
}
