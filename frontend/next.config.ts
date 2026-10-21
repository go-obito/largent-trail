import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const publicAssets = [
  "manage-money-animate.svg",
  "manage-money-script.svg",
  "transaction-icon.png",
  "wallet-icon.png",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];

function revisionForFile(filePath: string): string {
  return createHash("sha256")
    .update(readFileSync(path.resolve(process.cwd(), filePath)))
    .digest("hex");
}

const withSerwist = withSerwistInit({
  additionalPrecacheEntries: [
    { url: "/offline", revision: revisionForFile("src/app/offline/page.tsx") },
    ...publicAssets.map((asset) => ({
      url: `/${asset}`,
      revision: revisionForFile(path.join("public", asset)),
    })),
  ],
  disable: process.env.NODE_ENV !== "production",
  swDest: "public/sw.js",
  swSrc: "src/sw.ts",
});

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
