import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.get<{ ok: number }>(sql`select 1 as ok`);

    if (result?.ok !== 1) {
      throw new Error("D1 health query returned an unexpected result");
    }

    return NextResponse.json(
      {
        data: {
          service: "research-community-hub",
          dependency: "d1",
          status: "ok",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Database health check failed", error);

    return NextResponse.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Database health check failed",
        },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
