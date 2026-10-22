import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { clerkAppearance } from "@/components/auth/ClerkAppearance";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { welcomeCopy } from "@/features/welcome/copy";

type SignUpPageProps = {
  searchParams: Promise<{
    from?: string | string[];
    redirect_url?: string | string[];
  }>;
};

async function SignUpContent({ searchParams }: SignUpPageProps) {
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
      <SignUp
        appearance={clerkAppearance}
        fallbackRedirectUrl="/onboarding"
        forceRedirectUrl="/onboarding"
        path="/sign-up"
        routing="path"
        signInUrl={`${welcomeCopy.paths.signInPlain}${queryString ? `?${queryString}` : ""}`}
      />
    </div>
  );
}

export default function SignUpPage(props: SignUpPageProps) {
  return (
    <Suspense
      fallback={<LoadingSkeleton label={welcomeCopy.loadingSignUp} rows={3} />}
    >
      <SignUpContent {...props} />
    </Suspense>
  );
}
