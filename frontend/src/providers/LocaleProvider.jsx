import { createContext, useContext, useMemo, useState } from "react";

const LOCALE_KEY = "health_knowledge_locale";
const LocaleContext = createContext(null);

function getInitialLocale() {
  if (typeof window === "undefined") return "vi";
  const saved = window.localStorage.getItem(LOCALE_KEY);
  return saved === "en" ? "en" : "vi";
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);

  const value = useMemo(
    () => ({
      locale,
      setLocale(nextLocale) {
        const safeLocale = nextLocale === "en" ? "en" : "vi";
        setLocaleState(safeLocale);
        window.localStorage.setItem(LOCALE_KEY, safeLocale);
      },
      toggleLocale() {
        const nextLocale = locale === "vi" ? "en" : "vi";
        setLocaleState(nextLocale);
        window.localStorage.setItem(LOCALE_KEY, nextLocale);
      },
      t(vi, en) {
        return locale === "en" ? en : vi;
      },
    }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
