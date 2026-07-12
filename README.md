# VeilMarket

**Private, real-time prediction markets for the 2026 World Cup — built on Solana with MagicBlock (Ephemeral Rollups, Private Ephemeral Rollups, and Verifiable Randomness).**

VeilMarket lets anyone create a prediction market for a World Cup match, bet real SOL on the outcome, change their prediction instantly and gaslessly inside an Ephemeral Rollup, and optionally hide their stake amount from other players via a Private Ephemeral Rollup — while the market's pool, bets, and resolution remain fully on-chain and publicly auditable. Markets can be resolved manually by their creator or via a provably-fair VRF coin-flip.

Built for **Solana Blitz v6** (MagicBlock, Mobile theme).

---

## Live links

- **App (devnet):** https://veilmarket.vercel.app/
- **Program ID:** `2EAgovXRWjb5Vxmt4N3PNrWNDSt3AhvcLwUAPzkMsBLq`
- **Explorer:** https://explorer.solana.com/address/2EAgovXRWjb5Vxmt4N3PNrWNDSt3AhvcLwUAPzkMsBLq?cluster=devnet
- **Cluster:** Solana Devnet

---

## What it demonstrates

| MagicBlock product | Where it's used |
|---|---|
| **Ephemeral Rollup (ER)** | Delegating a market/bet and updating a prediction in real time, gasless, without waiting for Solana block confirmations |
| **Private Ephemeral Rollup (PER)** | Hiding an individual bet's amount via the Permission Program, TEE-verified, while the pool total stays public |
| **Verifiable Randomness (VRF)** | An alternative, provably-fair coin-flip resolution path for market creators, instead of manual resolution |

All three are wired end-to-end into the actual product UI (not just backend tests) — see the "MagicBlock" panel inside any market's detail page.

---

## Tech stack

**On-chain program (`programs/veilmarket`)**
- Anchor 1.1.2 / Rust, Solana devnet
- `ephemeral-rollups-sdk` (ER + Private ER / access-control)
- `ephemeral-vrf-sdk` (VRF)

**Frontend (`frontend/`)**
- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Framer Motion (animations, swipe gestures, page transitions)
- Reown AppKit (wallet connect: Phantom/Solflare + email/social login)
- Custom lightweight i18n (English default, Spanish toggle)
- PWA (installable, tested on Android and iOS)
- RPC: Helius (devnet)

---

## Repository structure

```
veilmarket/
├── programs/veilmarket/src/lib.rs   # Anchor program (all instructions)
├── tests/                           # Anchor/TypeScript integration tests (17 passing)
├── Anchor.toml
├── Cargo.toml
└── frontend/
    ├── app/
    │   ├── page.tsx                 # Landing (connect + create market)
    │   ├── markets/page.tsx         # Swipeable market feed
    │   ├── markets/[pubkey]/page.tsx# Market detail (bet, ER, privacy, resolve, VRF, claim)
    │   ├── portfolio/page.tsx       # User's bets + created markets
    │   └── profile/page.tsx         # Stats, achievements, wallet actions
    ├── components/                  # Reusable UI (SwipeToConfirm, Toast, LedText, etc.)
    ├── lib/
    │   ├── veilmarket.ts             # Program client, PDA helpers, on-chain queries
    │   ├── useVeilWallet.ts          # Wallet hook (wraps Reown AppKit)
    │   └── i18n.tsx                  # Translation dictionary + language context
    └── public/                      # PWA manifest + icons
```

---

## On-chain program overview

**Accounts**
- `Market` — question, authority, resolved/outcome, total pool, winning pool
- `Bet` — market, better, amount, predicted outcome, settled/claimed flags

**Instructions**
| Instruction | Purpose |
|---|---|
| `create_market` | Creates a market for a match |
| `create_bet` | Places a bet; transfers real SOL into the market vault |
| `update_prediction` | Changes a bet's prediction — runs inside the ER |
| `resolve_market` | Manual resolution by the market authority |
| `request_random_resolution` / `resolve_market_random_callback` | VRF-based resolution |
| `settle_bet` | Registers a winning bet into the payout pool (pari-mutuel accounting) |
| `claim_payout` | Transfers the winner's share of the pool; blocks double-claims |
| `delegate_market` / `delegate_bet` | Delegates accounts to the Ephemeral Rollup |
| `undelegate_market` / `undelegate_bet` | Commits state back to Solana and ends the ER session |
| `init_bet_permission` / `set_bet_privacy` | Creates and toggles a Private ER permission on a bet, hiding its amount |

Payout formula (pari-mutuel): `payout = your_stake × total_pool / winning_pool`.

---

## Running the backend locally

Requirements: Rust, Solana CLI, Anchor CLI 1.1.2, Node.js, Yarn.

```bash
# Install deps
yarn install

# Build the program
anchor build

# Deploy to devnet (program ID already declared in lib.rs / Anchor.toml)
anchor deploy --provider.cluster https://api.devnet.solana.com

# Run the test suite (17 tests: core flow, ER, payout, Private ER, VRF)
anchor test --skip-local-validator --skip-deploy
```

> Note: `Anchor.toml`'s `[provider] cluster` points to the MagicBlock Magic Router (`https://devnet-router.magicblock.app`) for **program execution**. Program **deployment** must be pointed explicitly at `https://api.devnet.solana.com`, since the router doesn't support deploy-related RPC methods.

---

## Running the frontend locally

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```
NEXT_PUBLIC_SOLANA_RPC=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
NEXT_PUBLIC_REOWN_PROJECT_ID=YOUR_REOWN_PROJECT_ID
```

- Get a free Helius devnet RPC key at https://dashboard.helius.dev (the public Solana devnet RPC rate-limits heavily under normal app usage).
- Get a free Reown project ID at https://dashboard.reown.com.

```bash
npm run dev
```

Open `http://localhost:3000`. To test on a phone on the same network: `npm run dev -- -H 0.0.0.0`, then open `http://<your-local-ip>:3000` from the phone.

---

## Deployment

The frontend is deployed on Vercel. When deploying your own copy:

1. Import the repo, set **Root Directory** to `frontend`.
2. Add the two environment variables above under Project Settings → Environment Variables.
3. Deploy.

---

## Notable design decisions

- **Pari-mutuel payouts**, not an order book — matches a simple "pool splits among winners" model appropriate for casual prediction markets between friends.
- **No fabricated data anywhere in the UI.** Every number shown (volume, odds, P&L, accuracy, achievements) is computed from real on-chain state. Where MagicBlock/mockup-inspired designs implied data we don't track (e.g. historical odds charts, match end times), that UI was intentionally omitted rather than faked.
- **`useVeilWallet`** is a thin compatibility hook wrapping Reown AppKit so the rest of the app can consume it exactly like `@solana/wallet-adapter-react`'s `useWallet()`.

---

## Known limitations

- Devnet only; no mainnet deployment.
- Manual resolution requires trusting the market creator (mitigated by the optional VRF path).
- PWA icons are a placeholder (functional, not final-polish artwork).
- No automated frontend test suite (manual QA across Android/iOS/desktop).

---

## License

Built for Solana Blitz v6. No license specified — all rights reserved by the author unless stated otherwise.
