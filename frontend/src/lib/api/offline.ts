export function requireOnline() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("You're offline. Changes need a connection.");
  }
}
