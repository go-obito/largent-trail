import type { SVGProps } from "react";

type LogoProps = {
  className?: string;
  markClassName?: string;
  variant?: "full" | "mark";
};

export function LargentMark({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect fill="currentColor" height="36" rx="12" width="36" x="2" y="2" />
      <path
        d="M24.8 10.8a10.3 10.3 0 1 0 4.4 18.6 1.7 1.7 0 0 0-1.8-2.9 6.8 6.8 0 1 1-3.1-12.2 1.7 1.7 0 0 0 .5-3.5Z"
        fill="white"
      />
      <circle cx="28" cy="19.5" fill="white" r="3.4" />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  variant = "full",
}: LogoProps) {
  if (variant === "mark") {
    return <LargentMark className={markClassName ?? className} />;
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LargentMark className={`size-8 text-primary ${markClassName ?? ""}`} />
      <span className="text-xl font-bold tracking-[-0.03em] text-foreground">
        Largent
      </span>
    </span>
  );
}
