/**
 * Collects real DOM nodes. Empty selectors are not passed to GSAP to avoid "target not found" warnings.
 * @param {(string|Element|null|undefined)[]} items — selectors or elements
 * @returns {Element[]}
 */
export function gsapTargets(...items) {
  const out = [];
  for (const item of items) {
    if (!item) continue;
    if (typeof item === "string") {
      document.querySelectorAll(item).forEach((el) => out.push(el));
    } else if (item.nodeType === 1) {
      out.push(item);
    }
  }
  return out;
}
