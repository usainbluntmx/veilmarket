"use client";

import { useLanguage } from "@/lib/i18n";

export function LanguageToggle({ style }: { style?: React.CSSProperties }) {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === "en" ? "es" : "en")}
      style={style}
      className="rounded-full px-3 font-mono text-xs border"
    >
      {lang === "en" ? "EN" : "ES"}
    </button>
  );
}
