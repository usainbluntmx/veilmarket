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

    // Common
    yes: "YES",
    no: "NO",

    // Market detail
    detail_loading: "Loading market...",
    detail_not_found: "Market not found.",
    err_insufficient_funds: "Insufficient funds in your wallet.",
    err_account_exists: "That account already exists.",
    busy_sending_bet: "Sending bet...",
    busy_resolving: "Resolving...",
    busy_requesting_vrf: "Requesting verifiable randomness (VRF)...",
    busy_waiting_vrf: "Waiting for VRF oracle...",
    busy_activating_er: "Activating real-time (ER)...",
    busy_updating_prediction: "Updating prediction on the ER...",
    busy_activating_privacy: "Activating privacy (Private ER)...",
    busy_syncing_solana: "Syncing to Solana...",
    busy_processing_payout: "Processing payout...",
    busy_syncing_before_claim: "Syncing from ER before claiming...",
    busy_processing: "Processing...",
    detail_resolved_prefix: "Resolved:",
    detail_market_live: "Live market",
    detail_volume: "Volume",
    detail_odds_current: "Current odds",
    detail_no_bets: "No bets",
    detail_onchain_title: "On-chain verification",
    detail_onchain_desc:
      "This market is resolved manually by its creator, or via a verifiable draw (VRF) if the creator requests it instead of deciding by hand. All the state — pool, bets, resolution — lives on-chain and is publicly auditable.",
    detail_creator: "Creator:",
    detail_view_explorer: "View on Explorer →",
    detail_er_active: "Ephemeral Rollup active",
    detail_private_amount: "🔒 Private amount",
    detail_er_last_update: "Last ER update:",
    detail_your_bet: "Your bet",
    detail_amount_label: "Amount:",
    detail_hidden: "🔒 Hidden",
    detail_prediction_label: "Prediction:",
    detail_payout_claimed: "Payout claimed",
    detail_unclaimed: "Unclaimed",
    detail_magicblock_title: "MagicBlock",
    detail_activate_realtime: "Activate real-time (Ephemeral Rollup)",
    detail_change_prediction_hint: "Change your prediction with no friction, inside the rollup:",
    detail_change_to_yes: "Change to YES",
    detail_change_to_no: "Change to NO",
    detail_hide_amount: "🔒 Hide my amount (Private ER)",
    detail_sync_solana: "Sync to Solana",
    detail_resolve_authority: "Resolve (creator only)",
    detail_resolve_yes: "Resolve: YES",
    detail_resolve_no: "Resolve: NO",
    detail_resolve_vrf: "🎲 Resolve with verifiable randomness (VRF)",
    detail_claim_payout: "Claim payout",
    detail_predict: "Predict",
    detail_your_stake_input: "Your stake",
    detail_swipe_confirm_prefix: "Swipe to confirm",
    detail_bet_sent_suffix: "bet sent ✓",
    toast_bet_placed: "Bet placed successfully!",
    toast_payout_claimed: "Payout claimed!",
    toast_privacy_on: "Your amount is now private.",
    toast_er_live: "Real-time mode activated.",
    toast_synced: "Synced back to Solana.",
    toast_prediction_updated: "Prediction updated.",
    toast_market_resolved: "Market resolved.",

    // Portfolio
    port_connect_prompt: "Connect your wallet to view your portfolio.",
    port_loading: "Loading portfolio...",
    port_wallet_balance: "Your wallet balance",
    port_payout_singular: "payout",
    port_payout_plural: "payouts",
    port_to_claim: "to claim →",
    port_created: "Created",
    port_active: "Active",
    port_staked: "Staked",
    port_your_bets: "Your bets",
    port_no_bets: "You haven't bet on any market yet.",
    port_staked_suffix: "SOL staked",
    port_live: "Live",
    port_claimed: "Claimed",
    port_won: "You won",
    port_claim_arrow: "Claim →",
    port_lost: "You lost",
    port_your_markets: "Markets you created",
    port_no_markets: "You haven't created any market yet.",

    // Profile
    prof_connect_prompt: "Connect your wallet to view your profile.",
    prof_loading: "Loading profile...",
    prof_title: "Profile",
    prof_copied: "✓ copied",
    prof_net_gain: "Net gain",
    prof_resolved_only: "resolved markets only",
    prof_accuracy: "Accuracy %",
    prof_no_resolved: "No resolved markets yet",
    prof_resolved_suffix: "resolved",
    prof_markets_joined: "Markets you joined",
    prof_markets_created: "Markets created",
    prof_achievements: "Achievements",
    prof_first_bet: "First bet",
    prof_sharpshooter: "Sharpshooter",
    prof_creator: "Creator",
    prof_high_roller: "High roller",
    prof_view_history: "View history on Explorer",
    prof_view_full_portfolio: "View full portfolio",
    prof_disconnect: "Disconnect wallet",
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

    yes: "SI",
    no: "NO",

    detail_loading: "Cargando mercado...",
    detail_not_found: "Mercado no encontrado.",
    err_insufficient_funds: "Fondos insuficientes en tu wallet.",
    err_account_exists: "Esa cuenta ya existe.",
    busy_sending_bet: "Enviando apuesta...",
    busy_resolving: "Resolviendo...",
    busy_requesting_vrf: "Solicitando azar verificable (VRF)...",
    busy_waiting_vrf: "Esperando al oraculo VRF...",
    busy_activating_er: "Activando tiempo real (ER)...",
    busy_updating_prediction: "Actualizando prediccion en el ER...",
    busy_activating_privacy: "Activando privacidad (Private ER)...",
    busy_syncing_solana: "Sincronizando a Solana...",
    busy_processing_payout: "Procesando payout...",
    busy_syncing_before_claim: "Sincronizando desde el ER antes de reclamar...",
    busy_processing: "Procesando...",
    detail_resolved_prefix: "Resuelto:",
    detail_market_live: "Mercado en vivo",
    detail_volume: "Volumen",
    detail_odds_current: "Odds actuales",
    detail_no_bets: "Sin apuestas",
    detail_onchain_title: "Verificacion on-chain",
    detail_onchain_desc:
      "Este mercado se resuelve manualmente por su creador, o mediante un sorteo verificable (VRF) si el creador lo solicita en vez de decidir a mano. Todo el estado — pool, apuestas, resolucion — vive on-chain y es publicamente auditable.",
    detail_creator: "Creador:",
    detail_view_explorer: "Ver en Explorer →",
    detail_er_active: "Ephemeral Rollup activo",
    detail_private_amount: "🔒 Monto privado",
    detail_er_last_update: "Ultima actualizacion ER:",
    detail_your_bet: "Tu apuesta",
    detail_amount_label: "Monto:",
    detail_hidden: "🔒 Oculto",
    detail_prediction_label: "Prediccion:",
    detail_payout_claimed: "Payout reclamado",
    detail_unclaimed: "Sin reclamar",
    detail_magicblock_title: "MagicBlock",
    detail_activate_realtime: "Activar tiempo real (Ephemeral Rollup)",
    detail_change_prediction_hint: "Cambia tu prediccion sin friccion, dentro del rollup:",
    detail_change_to_yes: "Cambiar a SI",
    detail_change_to_no: "Cambiar a NO",
    detail_hide_amount: "🔒 Ocultar mi monto (Private ER)",
    detail_sync_solana: "Sincronizar a Solana",
    detail_resolve_authority: "Resolver (solo creador)",
    detail_resolve_yes: "Resolver: SI",
    detail_resolve_no: "Resolver: NO",
    detail_resolve_vrf: "🎲 Resolver con azar verificable (VRF)",
    detail_claim_payout: "Reclamar payout",
    detail_predict: "Predecir",
    detail_your_stake_input: "Tu apuesta",
    detail_swipe_confirm_prefix: "Desliza para confirmar",
    detail_bet_sent_suffix: "apuesta enviada ✓",
    toast_bet_placed: "¡Apuesta enviada con exito!",
    toast_payout_claimed: "¡Payout reclamado!",
    toast_privacy_on: "Tu monto ahora es privado.",
    toast_er_live: "Modo tiempo real activado.",
    toast_synced: "Sincronizado de vuelta a Solana.",
    toast_prediction_updated: "Prediccion actualizada.",
    toast_market_resolved: "Mercado resuelto.",

    port_connect_prompt: "Conecta tu wallet para ver tu portafolio.",
    port_loading: "Cargando portafolio...",
    port_wallet_balance: "Balance de tu wallet",
    port_payout_singular: "payout",
    port_payout_plural: "payouts",
    port_to_claim: "por reclamar →",
    port_created: "Creados",
    port_active: "Activas",
    port_staked: "Apostado",
    port_your_bets: "Tus apuestas",
    port_no_bets: "Aun no has apostado en ningun mercado.",
    port_staked_suffix: "SOL apostado",
    port_live: "En vivo",
    port_claimed: "Reclamado",
    port_won: "Ganaste",
    port_claim_arrow: "Reclamar →",
    port_lost: "Perdiste",
    port_your_markets: "Mercados que creaste",
    port_no_markets: "Aun no has creado ningun mercado.",

    prof_connect_prompt: "Conecta tu wallet para ver tu perfil.",
    prof_loading: "Cargando perfil...",
    prof_title: "Perfil",
    prof_copied: "✓ copiado",
    prof_net_gain: "Ganancia neta",
    prof_resolved_only: "solo mercados resueltos",
    prof_accuracy: "% de aciertos",
    prof_no_resolved: "Sin mercados resueltos aun",
    prof_resolved_suffix: "resueltos",
    prof_markets_joined: "Mercados en los que participaste",
    prof_markets_created: "Mercados creados",
    prof_achievements: "Logros",
    prof_first_bet: "Primera apuesta",
    prof_sharpshooter: "Tirador certero",
    prof_creator: "Creador",
    prof_high_roller: "Alta apuesta",
    prof_view_history: "Ver historial en Explorer",
    prof_view_full_portfolio: "Ver portafolio completo",
    prof_disconnect: "Desconectar wallet",
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

  // Mantiene <html lang="..."> sincronizado con el idioma elegido, para
  // accesibilidad/SEO (layout.tsx es un server component y no puede leer
  // este estado directamente, asi que lo actualizamos en el cliente).
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

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
