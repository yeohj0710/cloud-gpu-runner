export function safeInstanceDescription(value, maxLength = 120) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^a-zA-Z0-9 .,_:;()\-\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
