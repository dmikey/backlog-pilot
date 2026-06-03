import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-sm ${className}`}
    >
      {children}
    </section>
  );
}
