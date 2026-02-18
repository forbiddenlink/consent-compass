import { NextResponse } from "next/server";
import { z } from "zod";
import { scanUrl } from "@/lib/scan";

export const runtime = "nodejs";

const BodySchema = z.object({
  url: z.string().url(),
});

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const result = await scanUrl(body.url);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        status: "error",
        error: message,
      },
      { status: 400 },
    );
  }
}
