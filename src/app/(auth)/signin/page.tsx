import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { signIn } from "../actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <AuthCard
        title="Sign in"
        description="Use your approved university email account."
        action={signIn}
        error={params.error}
        message={params.message}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
        footer={{ text: "Need an account?", href: "/signup", label: "Create one" }}
      />
      <div className="mt-4 text-center">
        <Link
          className="text-sm text-indigo-100 hover:text-white hover:underline"
          href="/forgot-password"
        >
          Forgot your password?
        </Link>
      </div>
    </>
  );
}
