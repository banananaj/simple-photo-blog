import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Basic-auth gate for /admin. Credentials come from the environment only; with
// none set the route is closed rather than open.
export function proxy(request: NextRequest) {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  if (!user || !password) {
    return new NextResponse("Admin is not configured.", { status: 404 });
  }
  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [u, p] = atob(encoded).split(":");
    if (u === user && p === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' },
  });
}

export const config = {
  matcher: "/admin/:path*",
};
