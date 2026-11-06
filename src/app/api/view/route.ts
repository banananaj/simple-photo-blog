import { NextResponse } from "next/server";
import { recordView } from "@/lib/views";

const ID = /^[a-z0-9-]{4,64}$/i;

// Called from the lightbox with sendBeacon; counts one view per full-size open.
export async function POST(request: Request) {
  let id = "";
  try {
    const body = (await request.json()) as { id?: unknown };
    if (typeof body.id === "string") id = body.id;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!ID.test(id)) return new NextResponse(null, { status: 400 });
  try {
    await recordView(id);
  } catch {
    // the store being down must not surface to a visitor
  }
  return new NextResponse(null, { status: 204 });
}
