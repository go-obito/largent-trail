import type { Metadata, Viewport } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Largent",
  title: "Largent",
  description: "Everyday money management.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Largent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/favicon.svg?v=2", sizes: "any", type: "image/svg+xml" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon-v2.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta content="#F4F6FB" name="theme-color" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{const p=localStorage.getItem("largent-theme");const d=window.matchMedia("(prefers-color-scheme: dark)").matches;const t=p==="light"||p==="dark"?p:(d?"dark":"light");const r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t;const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==="dark"?"#111521":"#F4F6FB"})();`,
          }}
        />
      </head>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
        <Analytics />
      </body>
    </html>
  );
}
