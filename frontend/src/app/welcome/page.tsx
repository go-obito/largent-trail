import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { PageContainer } from "@/components/PageContainer";
import { WelcomeExperience } from "@/features/welcome/WelcomeExperience";
import { welcomeCopy } from "@/features/welcome/copy";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: welcomeCopy.metadata.title,
  description: welcomeCopy.metadata.description,
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: welcomeCopy.metadata.title,
    description: welcomeCopy.metadata.description,
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: welcomeCopy.metadata.imageAlt,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: welcomeCopy.metadata.title,
    description: welcomeCopy.metadata.description,
    images: ["/icons/icon-512.png"],
  },
};

type WelcomePageProps = {
  searchParams: Promise<{ replay?: string | string[] }>;
};

async function WelcomeContent({ searchParams }: WelcomePageProps) {
  const [{ userId }, params] = await Promise.all([auth(), searchParams]);
  const replay = params.replay === "1";

  if (userId && !replay) redirect("/");

  return (
    <>
      <div className="flex min-h-11 justify-end">
        {replay ? (
          <Link
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-foreground hover:bg-selected"
            href="/"
          >
            {welcomeCopy.actions.back}
          </Link>
        ) : null}
      </div>
      <WelcomeExperience forceFull={replay} />
    </>
  );
}

function WelcomeLoading() {
  return (
    <div
      aria-label={welcomeCopy.loading}
      aria-busy="true"
      className="grid grid-cols-1 items-center gap-8 pb-12 pt-2 lg:grid-cols-2 lg:gap-14 lg:pb-20 lg:pt-8"
      role="status"
    >
      <div className="card-surface aspect-square w-full animate-pulse bg-panel-raised" />
      <div className="space-y-6">
        <div className="h-24 max-w-lg animate-pulse rounded-xl bg-panel-raised" />
        <div className="h-12 max-w-md animate-pulse rounded-xl bg-panel-raised" />
        <div className="h-36 max-w-md animate-pulse rounded-xl bg-panel-raised" />
      </div>
      <span className="sr-only">{welcomeCopy.loading}</span>
    </div>
  );
}

export default function WelcomePage({ searchParams }: WelcomePageProps) {
  return (
    <main className="min-h-dvh bg-page text-foreground">
      <PageContainer>
        <header className="flex min-h-20 items-center justify-between py-4">
          <Logo />
        </header>
        <Suspense fallback={<WelcomeLoading />}>
          <WelcomeContent searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </main>
  );
}
