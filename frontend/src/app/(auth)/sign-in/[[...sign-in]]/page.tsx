import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/components/auth/ClerkAppearance";

export default function SignInPage() {
  return (
    <SignIn
      appearance={clerkAppearance}
      fallbackRedirectUrl="/"
      path="/sign-in"
      routing="path"
      signUpUrl="/sign-up"
    />
  );
}
