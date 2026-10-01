// backend/src/utils/search.ts

/** Escape user input so it is matched literally inside a RegExp. */
export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Regex source for matching a place name literally but ignoring punctuation and
 * spacing differences: "T Nagar" matches "T. Nagar, Tamil Nadu".
 */
export function looseNamePattern(input: string) {
  const words = String(input || "").replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  return escapeRegex(words).replace(/ /g, "[\\s.,]*");
}
