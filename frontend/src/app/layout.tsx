import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

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
    icon: [{ url: "/icons/favicon.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
    <html className={inter.variable} lang="en">
      <head>
        <meta content="#F5F7FB" name="theme-color" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{const p=localStorage.getItem("largent-theme");const d=window.matchMedia("(prefers-color-scheme: dark)").matches;const t=p==="light"||p==="dark"?p:(d?"dark":"light");const r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t;const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==="dark"?"#111521":"#F5F7FB"})();`,
          }}
        />
      </head>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
