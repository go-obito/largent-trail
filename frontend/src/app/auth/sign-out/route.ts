import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { LAST_PRIVATE_ROUTE_COOKIE } from "@/lib/routing";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return new NextResponse(null, { status: 401 });

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(LAST_PRIVATE_ROUTE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
