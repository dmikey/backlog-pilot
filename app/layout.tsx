import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Backlog Pilot",
  description: "AI-powered game backlog curation for multi-platform collectors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2),_transparent_30%),linear-gradient(180deg,_#09090b_0%,_#111827_100%)] text-zinc-100">
        {children}
      </body>
    </html>
  );
}
