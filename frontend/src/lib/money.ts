const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const MAX_AMOUNT_MINOR = BigInt("1000000000000");
const AMOUNT_PATTERN = /^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/;

export function formatGhs(minor: number): string {
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError("GHS amounts must be safe integers in pesewas.");
  }

  const amount = BigInt(minor);
  const isNegative = amount < ZERO;
  const absoluteAmount = isNegative ? -amount : amount;
  const whole = (absoluteAmount / HUNDRED)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (absoluteAmount % HUNDRED).toString().padStart(2, "0");

  return `${isNegative ? "-" : ""}₵${whole}.${fraction}`;
}

export function parseGhsInput(text: string): number | null {
  const input = text.trim();
  if (!AMOUNT_PATTERN.test(input)) {
    return null;
  }

  const [whole, fraction = ""] = input.replace(/,/g, "").split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  if (normalizedWhole.length > 11) {
    return null;
  }

  const minor =
    BigInt(normalizedWhole) * HUNDRED +
    BigInt(fraction.padEnd(2, "0"));

  if (minor > MAX_AMOUNT_MINOR) {
    return null;
  }

  return Number(minor);
}
