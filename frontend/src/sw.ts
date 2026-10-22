import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const protectedPath = /(?:^|\/)(?:v1|api|sign-in|sign-up)(?:\/|$)/i;
const welcomeVideoPath = "/manage%20money%20onboarding%20video.mp4";

function isProtectedPath(pathname: string): boolean {
  return protectedPath.test(pathname);
}

function isWelcomeVideoEntry(entry: PrecacheEntry | string): boolean {
  const entryUrl = typeof entry === "string" ? entry : entry.url;
  return (
    new URL(entryUrl, self.location.origin).pathname.toLowerCase() ===
    welcomeVideoPath
  );
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST?.filter(
    (entry) => !isWelcomeVideoEntry(entry),
  ),
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => isProtectedPath(url.pathname),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) =>
        url.pathname.toLowerCase().endsWith(".mp4") ||
        url.pathname.toLowerCase().endsWith(".webm"),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) => url.pathname === "/manage-money-animate.svg",
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request, url }) =>
        request.destination === "image" && !isProtectedPath(url.pathname),
      handler: new CacheFirst({
        cacheName: "largent-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher: ({ request, url }) =>
        request.destination === "font" && !isProtectedPath(url.pathname),
      handler: new CacheFirst({
        cacheName: "largent-fonts",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 16,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          }),
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) =>
          request.destination === "document" &&
          !isProtectedPath(new URL(request.url).pathname),
      },
    ],
  },
});

serwist.addEventListeners();
