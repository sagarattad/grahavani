// Private mode gate (see lib/access.ts): pages redirect to /signin, APIs answer
// 401. Does nothing when ALLOWED_EMAILS is not set.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { gate } from "@/lib/access";

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const decision = gate(pathname, req.auth?.user?.email);
  if (decision === "allow") return NextResponse.next();
  if (decision === "unauthorized") return Response.json({ error: "Please sign in." }, { status: 401 });
  const url = new URL("/signin", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
});

export const config = {
  // Everything except Next.js assets and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp|woff2?|txt)$).*)"],
};
