import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/veilmarket.json";

export const SOLANA_DEVNET = "https://api.devnet.solana.com";
export const ER_DEVNET = "https://devnet.magicblock.app";

export const PROGRAM_ID = new PublicKey(
  "2EAgovXRWjb5Vxmt4N3PNrWNDSt3AhvcLwUAPzkMsBLq"
);

export const DELEGATION_PROGRAM_ID = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
);

// Valor confirmado del codigo fuente real de ephemeral-vrf-sdk v0.4.1
export const VRF_DEFAULT_QUEUE = new PublicKey(
  "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh"
);

export const PERMISSION_PROGRAM_ID = new PublicKey(
  "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
);
const PERMISSION_SEED = Buffer.from("permission:");

export function permissionPdaFromAccount(account: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [PERMISSION_SEED, account.toBuffer()],
    PERMISSION_PROGRAM_ID
  )[0];
}
export const EPHEMERAL_VAULT_ID = new PublicKey(
  "MagicVau1t999999999999999999999999999999999"
);
export const MAGIC_PROGRAM_ID = new PublicKey(
  "Magic11111111111111111111111111111111111111"
);

export function marketPda(matchId: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(matchId)],
    PROGRAM_ID
  )[0];
}

export function betPda(market: PublicKey, better: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), market.toBuffer(), better.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function getProgram(provider: AnchorProvider) {
  return new Program(idl as Idl, provider);
}

export function getConnection(cluster: "base" | "er" = "base") {
  return new Connection(cluster === "base" ? SOLANA_DEVNET : ER_DEVNET, "confirmed");
}

/**
 * Trae todas las cuentas Bet de una wallet especifica, sin importar el
 * mercado. Filtro memcmp sobre el campo `better` (offset 40 = 8 discriminador
 * + 32 bytes de `market` que viene justo antes en el struct).
 */
export async function fetchBetsForWallet(program: Program, better: PublicKey) {
  return (program.account as any).bet.all([
    {
      memcmp: {
        offset: 40,
        bytes: better.toBase58(),
      },
    },
  ]);
}

/**
 * Calcula el split real SI/NO de un mercado sumando todas sus cuentas Bet
 * (filtro memcmp sobre el campo `market`, offset 8 = justo despues del
 * discriminador de Anchor). No es un dato inventado: es la suma real de
 * lo apostado on-chain.
 */
export async function fetchMarketOdds(
  program: Program,
  market: PublicKey
): Promise<{ yesLamports: number; noLamports: number; totalBets: number }> {
  const bets = await (program.account as any).bet.all([
    {
      memcmp: {
        offset: 8,
        bytes: market.toBase58(),
      },
    },
  ]);

  let yesLamports = 0;
  let noLamports = 0;
  for (const b of bets) {
    const amount = b.account.amount.toNumber();
    if (b.account.predictedOutcome) yesLamports += amount;
    else noLamports += amount;
  }
  return { yesLamports, noLamports, totalBets: bets.length };
}
