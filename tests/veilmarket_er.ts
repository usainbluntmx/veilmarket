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
const ER_DEVNET = "https://devnet.magicblock.app";

const PROGRAM_ID = new PublicKey(
  "2EAgovXRWjb5Vxmt4N3PNrWNDSt3AhvcLwUAPzkMsBLq"
);
const DELEGATION_PROGRAM_ID = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
);

describe("veilmarket - checkpoint 2 (v3): create_bet -> delegate -> update_prediction en ER -> undelegate", () => {
  const secretKey = JSON.parse(
    fs.readFileSync(os.homedir() + "/.config/solana/id.json", "utf8")
  );
  const authority = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  const wallet = new Wallet(authority);

  const baseConnection = new Connection(SOLANA_DEVNET, "confirmed");
  const baseProvider = new AnchorProvider(baseConnection, wallet, {
    preflightCommitment: "confirmed",
    commitment: "confirmed",
  });
  const baseProgram = new Program(idl as anchor.Idl, baseProvider);

  const erConnection = new Connection(ER_DEVNET, "confirmed");
  const erProvider = new AnchorProvider(erConnection, wallet, {
    preflightCommitment: "confirmed",
    commitment: "confirmed",
  });
  const erProgram = new Program(idl as anchor.Idl, erProvider);

  const matchId = `MEX-USA-${Date.now()}`;
  const question = "Mexico anota antes del minuto 30? (ER v3)";
  const betAmount = new BN(0.01 * LAMPORTS_PER_SOL);

  let marketPda: PublicKey;
  let betPda: PublicKey;

  before(async () => {
    [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), Buffer.from(matchId)],
      PROGRAM_ID
    );
    [betPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), marketPda.toBuffer(), authority.publicKey.toBuffer()],
      PROGRAM_ID
    );
  });

  it("crea el mercado y la apuesta (con SOL real) en la capa base", async () => {
    await baseProgram.methods
      .createMarket(matchId, question)
      .accounts({
        market: marketPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await baseProgram.methods
      .createBet(betAmount, true)
      .accounts({
        market: marketPda,
        bet: betPda,
        better: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Mercado y apuesta creados. Prediccion inicial: true");
  });

  it("delega Market y Bet al Ephemeral Rollup", async () => {
    await baseProgram.methods
      .delegateMarket(matchId)
      .accounts({
        payer: authority.publicKey,
        pda: marketPda,
      })
      .rpc();

    await baseProgram.methods
      .delegateBet(marketPda, authority.publicKey)
      .accounts({
        payer: authority.publicKey,
        pda: betPda,
      })
      .rpc();

    const marketInfo = await baseConnection.getAccountInfo(marketPda);
    const betInfo = await baseConnection.getAccountInfo(betPda);
    expect(marketInfo?.owner.toBase58()).to.equal(DELEGATION_PROGRAM_ID.toBase58());
    expect(betInfo?.owner.toBase58()).to.equal(DELEGATION_PROGRAM_ID.toBase58());
    console.log("Market y Bet delegadas correctamente");
  });

  it("cambia la prediccion DENTRO del ER (mutacion pura, rapida y gasless)", async () => {
    const start = Date.now();
    const txSig = await erProgram.methods
      .updatePrediction(false) // el usuario cambia de opinion a ultimo momento
      .accounts({
        market: marketPda,
        bet: betPda,
        better: authority.publicKey,
      })
      .rpc();
    const elapsedMs = Date.now() - start;

    console.log("update_prediction tx (ER):", txSig);
    console.log(`Tiempo de confirmacion dentro del ER: ${elapsedMs}ms`);

    const betAccount = await (erProgram.account as any).bet.fetch(betPda);
    expect(betAccount.predictedOutcome).to.equal(false);
  });

  it("hace commit + undelegate de Market: sincroniza a Solana", async () => {
    await erProgram.methods
      .undelegateMarket()
      .accounts({
        payer: authority.publicKey,
        market: marketPda,
      })
      .rpc();

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const accountInfo = await baseConnection.getAccountInfo(marketPda);
    expect(accountInfo?.owner.toBase58()).to.equal(PROGRAM_ID.toBase58());
    console.log("Market de vuelta en base layer, lista para resolve/settle/claim");
  });
});
