import type { SVGProps } from "react";

type LogoProps = {
  className?: string;
  markClassName?: string;
  variant?: "full" | "mark";
};

export function LargentMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-label="Largent"
      className={className}
      fill="none"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M17 7H35.5C36.3 7 37.1 7.3 37.7 7.9L53.1 23.3C53.7 23.9 54 24.7 54 25.5V45.5C54 47.4 52.4 49 50.5 49H44.5C42.6 49 41 47.4 41 45.5V27C41 23.1 37.9 20 34 20H17C15.1 20 13.5 18.4 13.5 16.5V10.5C13.5 8.6 15.1 7 17 7Z"
        fill="currentColor"
      />
      <path
        d="M47 57H28.5C27.7 57 26.9 56.7 26.3 56.1L10.9 40.7C10.3 40.1 10 39.3 10 38.5V18.5C10 16.6 11.6 15 13.5 15H19.5C21.4 15 23 16.6 23 18.5V37C23 40.9 26.1 44 30 44H47C48.9 44 50.5 45.6 50.5 47.5V53.5C50.5 55.4 48.9 57 47 57Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Logo({ className, markClassName, variant = "mark" }: LogoProps) {
  if (variant === "mark") {
    return <LargentMark className={markClassName ?? className} />;
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LargentMark className={`size-8 text-current ${markClassName ?? ""}`} />
      <span className="text-xl font-semibold lowercase tracking-[-0.055em]">
        largent
      </span>
    </span>
  );
}
