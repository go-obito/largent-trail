import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}
