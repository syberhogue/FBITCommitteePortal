import { cn } from "@/lib/utils";

export function Card({ children, className, ...props }: React.ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "indigo" | "blue" | "green" | "amber" | "orange" | "red";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    indigo: "bg-[#eef6fb] text-[#003C71]",
    blue: "bg-[#0077CA] text-white",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    orange: "bg-[#E75D2A] text-[#00283C]",
    red: "bg-red-100 text-red-700",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </header>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#0077CA] focus:ring-2 focus:ring-[#0077CA]/20";
export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#003C71] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#042A4B] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[#0077CA] bg-white px-3 py-2 text-sm font-semibold text-[#003C71] transition hover:bg-[#eef6fb]";
export const dangerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50";
