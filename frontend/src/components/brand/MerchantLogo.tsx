import { useState } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";

type Merchant = {
  domain: string;
  aliases: readonly string[];
};

/**
 * Explicit merchant-domain registry. Transaction notes are user-entered text,
 * so only known aliases are resolved; arbitrary text is never treated as a URL.
 */
const merchants: readonly Merchant[] = [
  { domain: "mtn.com.gh", aliases: ["mtn", "mtn ghana", "mtn airtime", "mtn momo"] },
  { domain: "telecel.com.gh", aliases: ["telecel", "telecel ghana", "vodafone ghana", "vodafone"] },
  { domain: "at.com.gh", aliases: ["at ghana", "at"] },
  { domain: "airteltigo.com.gh", aliases: ["airteltigo", "airtel tigo", "tigo"] },
  { domain: "ecg.com.gh", aliases: ["ecg", "electricity company of ghana"] },
  { domain: "melcom.com", aliases: ["melcom"] },
  { domain: "jumia.com.gh", aliases: ["jumia"] },
  { domain: "dstv.com", aliases: ["dstv", "multichoice"] },
  { domain: "netflix.com", aliases: ["netflix"] },
  { domain: "showmax.com", aliases: ["showmax"] },
  { domain: "spotify.com", aliases: ["spotify"] },
  { domain: "youtube.com", aliases: ["youtube", "youtube premium"] },
  { domain: "apple.com", aliases: ["apple", "apple services", "apple.com/bill"] },
  { domain: "google.com", aliases: ["google", "google play", "google one"] },
  { domain: "amazon.com", aliases: ["amazon", "amazon prime"] },
  { domain: "uber.com", aliases: ["uber", "uber eats"] },
  { domain: "yango.com", aliases: ["yango"] },
  { domain: "bolt.eu", aliases: ["bolt", "bolt food"] },
  { domain: "shell.com", aliases: ["shell"] },
  { domain: "totalenergies.com", aliases: ["totalenergies"] },
  { domain: "mcdonalds.com", aliases: ["mcdonald's", "mcdonalds"] },
  { domain: "kfc.com", aliases: ["kfc"] },
  { domain: "starbucks.com", aliases: ["starbucks"] },
] as const;

function normalizeMerchantName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

function findMerchantDomain(merchantName: string | null | undefined) {
  const normalized = normalizeMerchantName(merchantName ?? "");
  if (!normalized) return null;

  const match = merchants.find(({ aliases }) =>
    aliases.some((alias) => {
      const normalizedAlias = normalizeMerchantName(alias);
      return normalized === normalizedAlias ||
        normalized.startsWith(`${normalizedAlias} `) ||
        normalized.startsWith(`${normalizedAlias} ·`) ||
        normalized.startsWith(`${normalizedAlias} -`);
    }),
  );

  return match?.domain ?? null;
}

type MerchantLogoProps = {
  merchantName: string;
  categoryName: string;
  size?: 36 | 44 | 48;
  categoryIcon?: string | null;
};

/**
 * Uses Logo.dev's publishable CDN API for recognized merchants. If no public
 * token is configured, the merchant is unknown, or the image fails to load,
 * the category badge remains the reliable visual fallback.
 */
export function MerchantLogo({
  merchantName,
  categoryName,
  size = 44,
  categoryIcon,
}: MerchantLogoProps) {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN?.trim();
  const domain = findMerchantDomain(merchantName);
  const [failedDomain, setFailedDomain] = useState<string | null>(null);

  if (!token || !domain || failedDomain === domain) {
    return <CategoryBadge icon={categoryIcon} name={categoryName || "Uncategorized"} size={size} />;
  }

  const src = new URL(`https://img.logo.dev/${domain}`);
  src.searchParams.set("token", token);
  src.searchParams.set("size", String(size));
  src.searchParams.set("format", "png");
  src.searchParams.set("retina", "true");
  src.searchParams.set("fallback", "404");

  return (
    <span
      aria-label={`${merchantName} logo`}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline/60 bg-surface p-1"
      role="img"
      style={{ height: size, width: size }}
    >
      {/* Logo.dev serves third-party images directly; no image proxy or storage is needed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        className="h-[72%] w-[72%] object-contain"
        height={size * 2}
        loading="lazy"
        onError={() => setFailedDomain(domain)}
        src={src.toString()}
        width={size * 2}
      />
    </span>
  );
}

/** Visible attribution required for commercial use on Logo.dev's free plan. */
export function LogoDevAttribution({ className = "" }: { className?: string }) {
  if (!process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN?.trim()) return null;

  return (
    <p className={`text-xs text-muted ${className}`}>
      Merchant logos by{" "}
      <a
        className="underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
        href="https://logo.dev"
        rel="noopener noreferrer"
        target="_blank"
      >
        Logo.dev
      </a>
    </p>
  );
}
