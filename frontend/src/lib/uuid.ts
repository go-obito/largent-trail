export function uuidv7(): string {
  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues) {
    throw new Error("Secure randomness is required to generate UUIDv7 identifiers.");
  }

  let timestamp = Date.now();
  if (timestamp < 0 || timestamp >= 2 ** 48) {
    throw new RangeError("The current time cannot be represented in a UUIDv7.");
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = timestamp % 256;
    timestamp = Math.floor(timestamp / 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
