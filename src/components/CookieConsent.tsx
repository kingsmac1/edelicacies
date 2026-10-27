import { useEffect, useState } from "react";
import { getCookieChoice, onReopenCookieBanner, setCookieChoice, type CookieChoice } from "../lib/cookieConsent";

const SITE = "Edelicacies";
// Brand colours for this site.
const THEME = { bg: "#121216", fg: "#fffdfb", accent: "#ff002c", accentFg: "#ffffff", radius: "999px" };

const CookieConsent = () => {
  const [open, setOpen] = useState(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (/^\/(admin|dashboard|checkin)/.test(window.location.pathname)) return;
    const had = getCookieChoice() !== null;
    setAnswered(had);
    const timer = window.setTimeout(() => { if (!had) setOpen(true); }, 1800);
    const off = onReopenCookieBanner(() => setOpen(true));
    return () => { window.clearTimeout(timer); off(); };
  }, []);

  const choose = (choice: CookieChoice) => {
    setCookieChoice(choice);
    setAnswered(true);
    setOpen(false);
  };

  if (typeof window !== "undefined" && /^\/(admin|dashboard|checkin)/.test(window.location.pathname)) return null;

  const base = { position: "fixed" as const, left: 16, zIndex: 90, fontFamily: "inherit" };
  const btn = { cursor: "pointer", fontSize: 14, fontWeight: 600, padding: "9px 20px", borderRadius: THEME.radius, fontFamily: "inherit" };

  return (
    <>
      {open && (
        <div role="dialog" aria-live="polite" aria-label="Cookie preferences"
          style={{ ...base, bottom: 16, right: 16, maxWidth: 400, background: THEME.bg, color: THEME.fg, padding: 20, borderRadius: THEME.radius === "999px" ? 20 : THEME.radius, boxShadow: "0 24px 60px -20px rgba(0,0,0,.6)", animation: "cookie-in .45s cubic-bezier(.16,1,.3,1)" }}>
          <style>{"@keyframes cookie-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}} @media(min-width:768px){[aria-label='Cookie preferences']{right:auto!important}}"}</style>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, opacity: 0.85 }}><b style={{ opacity: 1 }}>Cookies.</b> We use essential cookies to keep this site working (including secure sign-in and forms). Accept all to also allow optional ones that help us improve it.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <button type="button" onClick={() => choose("all")} style={{ ...btn, background: THEME.accent, color: THEME.accentFg, border: "1px solid " + THEME.accent }}>Accept all</button>
            <button type="button" onClick={() => choose("essential")} style={{ ...btn, background: "transparent", color: THEME.fg, border: "1px solid " + THEME.fg + "55" }}>Essentials only</button>
          </div>
        </div>
      )}
      {answered && !open && (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Cookie settings for ${SITE}`} title="Cookie settings"
          style={{ ...base, bottom: 16, zIndex: 80, width: 40, height: 40, borderRadius: "50%", background: THEME.bg, color: THEME.fg, border: 0, opacity: 0.6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(0,0,0,.35)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5Z"/><path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01"/></svg>
        </button>
      )}
    </>
  );
};

export default CookieConsent;
