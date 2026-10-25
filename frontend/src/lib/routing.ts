export const LAST_PRIVATE_ROUTE_COOKIE = "largent-last-private-route";
export const LAST_PRIVATE_ROUTE_MAX_AGE = 60 * 60 * 24 * 30;

const publicPathPrefixes = ["/sign-in", "/sign-up"];
const publicPaths = new Set(["/", "/welcome", "/offline"]);

export function isPublicPath(pathname: string): boolean {
  return (
    publicPaths.has(pathname) ||
    publicPathPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

export function isPrivatePath(pathname: string): boolean {
  return pathname.startsWith("/") && !isPublicPath(pathname);
}

export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }

  try {
    const target = new URL(value, "https://largent.invalid");
    if (target.origin !== "https://largent.invalid" || !isPrivatePath(target.pathname)) {
      return null;
    }
    // Onboarding is an authentication transition, not a useful destination to resume.
    if (target.pathname === "/onboarding" || target.pathname.startsWith("/onboarding/")) {
      return null;
    }
    return `${target.pathname}${target.search}`;
  } catch {
    return null;
  }
}

export function privatePathname(pathname: string): string | null {
  return isPrivatePath(pathname) && !pathname.startsWith("/onboarding") && !pathname.startsWith("/auth/")
    ? pathname
    : null;
}
