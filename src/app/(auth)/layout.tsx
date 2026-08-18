import { Landmark } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center border-t-8 border-[#E75D2A] bg-gradient-to-br from-[#00283C] via-[#003C71] to-[#005793] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          <Landmark className="size-9" aria-hidden />
          <span className="text-2xl font-bold">FBIT Committee Portal</span>
        </div>
        {children}
      </div>
    </main>
  );
}
