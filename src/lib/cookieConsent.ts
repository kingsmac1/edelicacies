// The visitor's cookie choice, kept in localStorage so the "Cookie settings" button can reopen the banner.
// "essential" = only what the site needs to work; "all" = also optional storage.
// Anything optional (analytics, pixels, embeds that set cookies) must check hasOptionalConsent() before loading.
const STORAGE_KEY = "edelicacies_cookie_consent";
const REOPEN_EVENT = "cookie-consent:reopen";

export type CookieChoice = "all" | "essential";

export const getCookieChoice = (): CookieChoice | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { choice?: CookieChoice };
    return v.choice === "all" || v.choice === "essential" ? v.choice : null;
  } catch {
    return null;
  }
};

export const setCookieChoice = (choice: CookieChoice) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: new Date().toISOString() }));
  } catch {
    /* storage unavailable (private mode): the banner simply shows again next visit */
  }
};

/** True only when the visitor accepted optional cookies. */
export const hasOptionalConsent = () => getCookieChoice() === "all";

export const reopenCookieBanner = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REOPEN_EVENT));
};

export const onReopenCookieBanner = (handler: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(REOPEN_EVENT, handler);
  return () => window.removeEventListener(REOPEN_EVENT, handler);
};
