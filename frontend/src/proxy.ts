import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  LAST_PRIVATE_ROUTE_COOKIE,
  LAST_PRIVATE_ROUTE_MAX_AGE,
  privatePathname,
} from "@/lib/routing";

const isPublicRoute = createRouteMatcher([
  "/",
  "/welcome",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/offline",
]);
const isApiRoute = createRouteMatcher(["/api(.*)", "/trpc(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  if (isApiRoute(request)) {
    await auth.protect();
    return;
  }

  const { userId } = await auth();
  if (!userId) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set(
      "redirect_url",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(signInUrl);
  }

  const response = NextResponse.next();
  const pathname = privatePathname(request.nextUrl.pathname);
  if (pathname) {
    response.cookies.set(LAST_PRIVATE_ROUTE_COOKIE, pathname, {
      httpOnly: true,
      maxAge: LAST_PRIVATE_ROUTE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|mp4|webm|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
