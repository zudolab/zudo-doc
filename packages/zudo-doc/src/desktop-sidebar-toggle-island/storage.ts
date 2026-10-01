export const SIDEBAR_STORAGE_KEY = "zudo-doc-sidebar-visible";

export function readState(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function writeState(isVisible: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isVisible));
  } catch {
    // Private browsing and disabled storage must not block the toggle.
  }
}

export function setDataAttribute(isVisible: boolean): void {
  if (typeof document === "undefined") return;
  if (isVisible) {
    document.documentElement.removeAttribute("data-sidebar-hidden");
  } else {
    document.documentElement.setAttribute("data-sidebar-hidden", "");
  }
}
