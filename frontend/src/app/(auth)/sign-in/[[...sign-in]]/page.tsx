import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { clerkAppearance } from "@/components/auth/ClerkAppearance";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { welcomeCopy } from "@/features/welcome/copy";

type SignInPageProps = {
  searchParams: Promise<{
    from?: string | string[];
    redirect_url?: string | string[];
  }>;
};

async function SignInContent({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.from === "welcome") query.set("from", "welcome");
  if (typeof params.redirect_url === "string") {
    query.set("redirect_url", params.redirect_url);
  }
  const queryString = query.toString();

  return (
    <div className="w-full">
      {params.from === "welcome" ? (
        <Link
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground hover:bg-selected"
          href="/welcome"
        >
          <ArrowLeft aria-hidden="true" size={18} />
          {welcomeCopy.actions.back}
        </Link>
      ) : null}
      <SignIn
        appearance={clerkAppearance}
        fallbackRedirectUrl="/"
        path="/sign-in"
        routing="path"
        signUpUrl={`${welcomeCopy.paths.signUpPlain}${queryString ? `?${queryString}` : ""}`}
      />
    </div>
  );
}

export default function SignInPage(props: SignInPageProps) {
  return (
    <Suspense
      fallback={<LoadingSkeleton label={welcomeCopy.loadingSignIn} rows={3} />}
    >
      <SignInContent {...props} />
    </Suspense>
  );
}
