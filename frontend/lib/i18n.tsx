"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "en" | "es";

const dict = {
  en: {
    // Nav / shared
    nav_explore: "Explore",
    nav_portfolio: "Portfolio",
    nav_create: "Create",
    nav_profile: "Profile",
    connect: "Connect",
    connect_wallet: "Connect wallet",
    connect_prompt: "Connect your wallet to bet or manage this market.",

    // Landing
    landing_eyebrow: "World Cup 2026 · Solana + MagicBlock",
    landing_headline_1: "The future is a",
    landing_headline_accent: "Swipe",
    landing_headline_2: "away.",
    landing_subtitle_pre: "Bet on World Cup 2026 matches, change your prediction in real time, and keep your stake",
    landing_subtitle_private: "private",
    landing_subtitle_post: "— no one else sees how much you risked.",
    landing_cta_primary: "Create your first market here",
    landing_new_market: "New market",
    landing_identifier: "Identifier",
    landing_question: "Question",
    landing_creating: "Creating...",
    landing_create_market: "Create market",
    landing_view_all_markets: "View all markets →",
    landing_steps_title: "3 steps to master it",
    landing_step1_title: "Swipe right",
    landing_step1_desc: "Bet \"YES\" on the outcome you think will happen.",
    landing_step2_title: "Swipe left",
    landing_step2_desc: "Bet \"NO\" when you don't believe the prediction.",
    landing_step3_title: "Cash out instantly",
    landing_step3_desc: "SOL goes straight to your wallet, no middlemen.",
    landing_feature_solana_title: "Powered by Solana + MagicBlock",
    landing_feature_solana_desc: "Ephemeral Rollups for instant, gasless prediction changes — no waiting for block confirmations.",
    landing_feature_privacy_title: "Real privacy",
    landing_feature_privacy_desc: "Your stake is hidden via Private Ephemeral Rollup.",
    landing_feature_noncustodial_title: "Non-custodial",
    landing_feature_noncustodial_desc: "Your keys, your funds. Always.",
    landing_cta_final_title: "Ready to play?",
    landing_view_markets: "View markets",
    landing_view_as_guest: "View markets as guest",
    landing_footer_tag: "Ephemeral Rollups · Private ER · VRF — Devnet",
    landing_wallet_linked_title: "Wallet connected",
    landing_wallet_linked_sub: "Welcome to the future of predictions.",

    // Feed
    feed_loading: "Loading markets...",
    feed_empty: "No markets yet. Create the first one.",
    feed_create_market: "Create market",
    feed_live: "LIVE",
    feed_resolved: "RESOLVED",
    feed_volume: "Volume",
    feed_odds_current: "Current odds",
    feed_no_bets_yet: "No bets yet",
    feed_view_detail: "View detail and bet →",
    feed_swipe_hint: "Swipe up/down to explore",
  },
  es: {
    nav_explore: "Explorar",
    nav_portfolio: "Portafolio",
    nav_create: "Crear",
    nav_profile: "Perfil",
    connect: "Conectar",
    connect_wallet: "Conectar wallet",
    connect_prompt: "Conecta tu wallet para apostar o gestionar este mercado.",

    landing_eyebrow: "Mundial 2026 · Solana + MagicBlock",
    landing_headline_1: "El futuro esta a un",
    landing_headline_accent: "Swipe",
    landing_headline_2: "de distancia.",
    landing_subtitle_pre: "Apuesta en partidos del Mundial 2026, cambia tu prediccion en tiempo real, y manten tu monto",
    landing_subtitle_private: "privado",
    landing_subtitle_post: "— nadie mas ve cuanto arriesgaste.",
    landing_cta_primary: "Crea tu primer mercado aqui",
    landing_new_market: "Nuevo mercado",
    landing_identifier: "Identificador",
    landing_question: "Pregunta",
    landing_creating: "Creando...",
    landing_create_market: "Crear mercado",
    landing_view_all_markets: "Ver todos los mercados →",
    landing_steps_title: "3 pasos para dominarlo",
    landing_step1_title: "Desliza a la derecha",
    landing_step1_desc: "Apuesta \"SI\" en el resultado que crees que va a pasar.",
    landing_step2_title: "Desliza a la izquierda",
    landing_step2_desc: "Apuesta \"NO\" cuando no le crees al pronostico.",
    landing_step3_title: "Cobra al instante",
    landing_step3_desc: "El SOL llega directo a tu wallet, sin intermediarios.",
    landing_feature_solana_title: "Impulsado por Solana + MagicBlock",
    landing_feature_solana_desc: "Ephemeral Rollups para cambios de prediccion instantaneos y gasless — sin esperar confirmaciones de bloque.",
    landing_feature_privacy_title: "Privacidad real",
    landing_feature_privacy_desc: "Tu monto se oculta via Private Ephemeral Rollup.",
    landing_feature_noncustodial_title: "No-custodial",
    landing_feature_noncustodial_desc: "Tus llaves, tus fondos. Siempre.",
    landing_cta_final_title: "¿Listo para jugar?",
    landing_view_markets: "Ver mercados",
    landing_view_as_guest: "Ver mercados como invitado",
    landing_footer_tag: "Ephemeral Rollups · Private ER · VRF — Devnet",
    landing_wallet_linked_title: "Wallet conectada",
    landing_wallet_linked_sub: "Bienvenido al futuro de las predicciones.",

    feed_loading: "Cargando mercados...",
    feed_empty: "Aun no hay mercados. Crea el primero.",
    feed_create_market: "Crear mercado",
    feed_live: "EN VIVO",
    feed_resolved: "RESUELTO",
    feed_volume: "Volumen",
    feed_odds_current: "Odds actuales",
    feed_no_bets_yet: "Sin apuestas aun",
    feed_view_detail: "Ver detalle y apostar →",
    feed_swipe_hint: "Desliza arriba/abajo para explorar",
  },
} as const;

type DictKey = keyof (typeof dict)["en"];

const LanguageContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
} | null>(null);

const STORAGE_KEY = "veilmarket_lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Ingles es el idioma default.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "en" || stored === "es") setLangState(stored);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
  }

  function t(key: DictKey): string {
    return dict[lang][key] ?? dict.en[key] ?? String(key);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
