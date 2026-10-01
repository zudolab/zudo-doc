export const TOC_STORAGE_KEY = "zudo-doc-toc-visible";

export function readTocState(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(TOC_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function writeTocState(isVisible: boolean): void {
  try {
    localStorage.setItem(TOC_STORAGE_KEY, String(isVisible));
  } catch {
    // Private browsing and disabled storage must not block the toggle.
  }
}

export function setTocDataAttribute(isVisible: boolean): void {
  if (typeof document === "undefined") return;
  if (isVisible) {
    document.documentElement.removeAttribute("data-toc-hidden");
  } else {
    document.documentElement.setAttribute("data-toc-hidden", "");
  }
}
