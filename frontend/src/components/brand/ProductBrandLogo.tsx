"use client";

import { useState } from "react";

type ProductBrand = {
  name: string;
  domain: string;
  aliases: readonly string[];
};

/**
 * Product-brand registry, not retailer/marketplace domains. Aliases also
 * cover common model families whose product titles omit the parent brand.
 */
const productBrands: readonly ProductBrand[] = [
  { name: "Apple", domain: "apple.com", aliases: ["apple", "iphone", "ipad", "macbook", "airpods", "imac"] },
  { name: "Samsung", domain: "samsung.com", aliases: ["samsung", "galaxy"] },
  { name: "Google", domain: "google.com", aliases: ["google", "pixel"] },
  { name: "Xiaomi", domain: "mi.com", aliases: ["xiaomi", "redmi", "poco"] },
  { name: "Huawei", domain: "huawei.com", aliases: ["huawei"] },
  { name: "Tecno", domain: "tecno-mobile.com", aliases: ["tecno"] },
  { name: "Infinix", domain: "infinixmobility.com", aliases: ["infinix"] },
  { name: "OnePlus", domain: "oneplus.com", aliases: ["oneplus"] },
  { name: "Oppo", domain: "oppo.com", aliases: ["oppo"] },
  { name: "Vivo", domain: "vivo.com", aliases: ["vivo"] },
  { name: "Nokia", domain: "nokia.com", aliases: ["nokia"] },
  { name: "Motorola", domain: "motorola.com", aliases: ["motorola", "moto"] },
  { name: "HP", domain: "hp.com", aliases: ["hewlett packard", "hp", "pavilion", "elitebook", "probook"] },
  { name: "Dell", domain: "dell.com", aliases: ["dell", "inspiron", "latitude", "xps", "alienware"] },
  { name: "Lenovo", domain: "lenovo.com", aliases: ["lenovo", "thinkpad", "ideapad", "yoga"] },
  { name: "ASUS", domain: "asus.com", aliases: ["asus", "zenbook", "vivobook", "rog"] },
  { name: "Acer", domain: "acer.com", aliases: ["acer", "aspire", "predator"] },
  { name: "Microsoft", domain: "microsoft.com", aliases: ["microsoft", "surface", "xbox"] },
  { name: "Sony", domain: "sony.com", aliases: ["sony", "playstation", "ps5", "ps4"] },
  { name: "LG", domain: "lg.com", aliases: ["lg"] },
  { name: "Hisense", domain: "hisense.com", aliases: ["hisense"] },
  { name: "TCL", domain: "tcl.com", aliases: ["tcl"] },
  { name: "JBL", domain: "jbl.com", aliases: ["jbl"] },
  { name: "Bose", domain: "bose.com", aliases: ["bose"] },
  { name: "Nike", domain: "nike.com", aliases: ["nike", "air max", "air force 1"] },
  { name: "Adidas", domain: "adidas.com", aliases: ["adidas", "yeezy"] },
  { name: "Puma", domain: "puma.com", aliases: ["puma"] },
  { name: "New Balance", domain: "newbalance.com", aliases: ["new balance"] },
  { name: "Under Armour", domain: "underarmour.com", aliases: ["under armour"] },
  { name: "Reebok", domain: "reebok.com", aliases: ["reebok"] },
  { name: "Canon", domain: "canon.com", aliases: ["canon"] },
  { name: "Nikon", domain: "nikon.com", aliases: ["nikon"] },
  { name: "DJI", domain: "dji.com", aliases: ["dji"] },
  { name: "Philips", domain: "philips.com", aliases: ["philips"] },
  { name: "Dyson", domain: "dyson.com", aliases: ["dyson"] },
  { name: "IKEA", domain: "ikea.com", aliases: ["ikea"] },
  { name: "Zara", domain: "zara.com", aliases: ["zara"] },
  { name: "H&M", domain: "hm.com", aliases: ["h&m", "h and m"] },
  { name: "Levi's", domain: "levi.com", aliases: ["levi's", "levis"] },
] as const;

function normalize(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function findProductBrand(name: string) {
  const normalized = normalize(name);
  if (!normalized) return null;

  const matches = productBrands.flatMap((brand) =>
    brand.aliases
      .filter((alias) => {
        const key = normalize(alias);
        return normalized === key ||
          normalized.startsWith(`${key} `) ||
          normalized.startsWith(`${key}-`) ||
          normalized.includes(` ${key} `);
      })
      .map((alias) => ({ brand, alias: normalize(alias) })),
  );

  return matches.sort((a, b) => b.alias.length - a.alias.length)[0]?.brand ?? null;
}

function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase();
  return (words[0] ?? "?").slice(0, 2).toLocaleUpperCase();
}

export function ProductBrandLogo({
  name,
  size = 44,
}: {
  name: string;
  size?: 36 | 40 | 44 | 48;
}) {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN?.trim();
  const brand = findProductBrand(name);
  const domain = brand?.domain ?? null;
  const [failedDomain, setFailedDomain] = useState<string | null>(null);

  if (!brand || !token || failedDomain === domain) {
    return (
      <span
        aria-label={brand ? `${brand.name} logo unavailable` : "Product brand"}
        className="inline-flex shrink-0 items-center justify-center rounded-xl bg-selected-surface font-semibold text-primary"
        role="img"
        style={{ height: size, width: size, fontSize: size * 0.32 }}
      >
        {initials(brand?.name ?? name)}
      </span>
    );
  }

  const src = new URL(`https://img.logo.dev/${domain}`);
  src.searchParams.set("token", token);
  src.searchParams.set("size", String(size));
  src.searchParams.set("format", "png");
  src.searchParams.set("retina", "true");
  src.searchParams.set("fallback", "404");

  return (
    <span
      aria-label={`${brand.name} logo`}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline/60 bg-surface p-1"
      role="img"
      style={{ height: size, width: size }}
    >
      {/* Logo.dev serves the registered product brand's logo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        className="h-full w-full object-contain"
        height={size * 2}
        loading="lazy"
        onError={() => setFailedDomain(domain)}
        src={src.toString()}
        width={size * 2}
      />
    </span>
  );
}
