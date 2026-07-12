import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import { expect } from "chai";

const idl = JSON.parse(
  fs.readFileSync("./target/idl/veilmarket.json", "utf8")
);

const SOLANA_DEVNET = "https://api.devnet.solana.com";

const PROGRAM_ID = new PublicKey(
  "2EAgovXRWjb5Vxmt4N3PNrWNDSt3AhvcLwUAPzkMsBLq"
);

// Valor confirmado del codigo fuente real de ephemeral-vrf-sdk v0.4.1
// (ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)
const VRF_DEFAULT_QUEUE = new PublicKey(
  "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh"
);

describe("veilmarket - checkpoint 5: VRF (resolucion aleatoria verificable)", () => {
  const secretKey = JSON.parse(
    fs.readFileSync(os.homedir() + "/.config/solana/id.json", "utf8")
  );
  const authority = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  const wallet = new Wallet(authority);

  const connection = new Connection(SOLANA_DEVNET, "confirmed");
  const provider = new AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
    commitment: "confirmed",
  });
  const program = new Program(idl as anchor.Idl, provider);

  const matchId = `MEX-USA-VRF-${Date.now()}`;
  const question = "Coin-flip: Mexico gana?";

  let marketPda: PublicKey;

  before(async () => {
    [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), Buffer.from(matchId)],
      PROGRAM_ID
    );
  });

  it("crea el mercado", async () => {
    await program.methods
      .createMarket(matchId, question)
      .accounts({
        market: marketPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("Mercado creado:", marketPda.toBase58());
  });

  it("solicita resolucion aleatoria via VRF y espera el callback del oraculo", async () => {
    const clientSeed = Math.floor(Math.random() * 256);

    const txSig = await program.methods
      .requestRandomResolution(clientSeed)
      .accounts({
        payer: authority.publicKey,
        market: marketPda,
        oracleQueue: VRF_DEFAULT_QUEUE,
      })
      .rpc();

    console.log("request_random_resolution tx:", txSig);
    console.log("Esperando el callback del oraculo VRF...");

    // El callback lo dispara el oraculo de MagicBlock de forma asincrona.
    // Hacemos polling sobre el estado del mercado hasta que resolved=true
    // o hasta un timeout razonable.
    const start = Date.now();
    const timeoutMs = 30000;
    let marketAccount: any = await (program.account as any).market.fetch(marketPda);

    while (!marketAccount.resolved && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      marketAccount = await (program.account as any).market.fetch(marketPda);
    }

    const elapsedMs = Date.now() - start;
    console.log(`Tiempo hasta resolucion via VRF: ${elapsedMs}ms`);

    expect(marketAccount.resolved).to.equal(true);
    console.log(
      "Mercado resuelto via VRF (coin-flip verificable). Outcome:",
      marketAccount.outcome
    );
  });
});
