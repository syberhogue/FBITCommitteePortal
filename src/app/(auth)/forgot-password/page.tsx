import { AuthCard } from "@/components/auth-card";
import { requestPasswordReset } from "../actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Reset password"
      description="We will send a secure password reset link if the account exists."
      action={requestPasswordReset}
      error={params.error}
      message={params.sent ? "Check your inbox for a password reset link." : undefined}
      fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
      footer={{ text: "Remembered it?", href: "/signin", label: "Return to sign in" }}
    />
  );
}
