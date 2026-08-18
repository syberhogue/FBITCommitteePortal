import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function AuthCard({
  title,
  description,
  action,
  fields,
  footer,
  error,
  message,
}: {
  title: string;
  description: string;
  action: (formData: FormData) => Promise<void>;
  fields: Array<{
    name: string;
    label: string;
    type: string;
    autoComplete?: string;
    minLength?: number;
  }>;
  footer?: { text: string; href: string; label: string };
  error?: string;
  message?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white p-7 shadow-2xl">
      <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      {error && (
        <div className="mt-5 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </div>
      )}
      {message && (
        <div className="mt-5 flex gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> {message}
        </div>
      )}
      <form action={action} className="mt-6 space-y-4">
        {fields.map((field) => (
          <label key={field.name} className="block text-sm font-medium text-slate-700">
            {field.label}
            <input
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              minLength={field.minLength}
              required
              className={`${inputClass} mt-1`}
            />
          </label>
        ))}
        <SubmitButton className="w-full" pendingLabel="Please wait…">
          {title}
        </SubmitButton>
      </form>
      {footer && (
        <p className="mt-6 text-center text-sm text-slate-500">
          {footer.text}{" "}
          <Link className="font-semibold text-indigo-700 hover:underline" href={footer.href}>
            {footer.label}
          </Link>
        </p>
      )}
    </div>
  );
}
