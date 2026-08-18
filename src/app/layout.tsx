import type { Metadata } from "next";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "FBIT Committee Portal";

export const metadata: Metadata = {
  title: { default: appName, template: `%s | ${appName}` },
  description: "Secure university committee governance and collaboration portal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
