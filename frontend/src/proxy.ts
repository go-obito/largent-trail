import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
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

  if (request.nextUrl.searchParams.has("redirect_url")) {
    await auth.protect();
    return;
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|mp4|webm|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
