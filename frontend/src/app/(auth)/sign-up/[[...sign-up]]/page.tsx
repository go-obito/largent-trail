import { SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "@/components/auth/ClerkAppearance";

export default function SignUpPage() {
  return (
    <SignUp
      appearance={clerkAppearance}
      fallbackRedirectUrl="/"
      path="/sign-up"
      routing="path"
      signInUrl="/sign-in"
    />
  );
}
