import { AuthCard } from "@/components/auth-card";
import { signUp } from "../actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Create account"
      description="Registration is restricted to approved university email domains."
      action={signUp}
      error={params.error}
      message={
        params.sent
          ? "Check your email to confirm your address. An administrator must then approve access."
          : undefined
      }
      fields={[
        { name: "full_name", label: "Full name", type: "text", autoComplete: "name" },
        { name: "email", label: "University email", type: "email", autoComplete: "email" },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "new-password",
          minLength: 12,
        },
        {
          name: "confirm_password",
          label: "Confirm password",
          type: "password",
          autoComplete: "new-password",
          minLength: 12,
        },
      ]}
      footer={{ text: "Already registered?", href: "/signin", label: "Sign in" }}
    />
  );
}
