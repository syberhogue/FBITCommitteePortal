import { AuthCard } from "@/components/auth-card";
import { updatePassword } from "../actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Set new password"
      description="Choose a password of at least 12 characters."
      action={updatePassword}
      error={params.error}
      fields={[
        {
          name: "password",
          label: "New password",
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
    />
  );
}
