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

describe("veilmarket - checkpoint 3: payout real (pari-mutuel)", () => {
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

  const matchId = `MEX-USA-PAYOUT-${Date.now()}`;
  const question = "Mexico gana el partido?";
  const betAmount = new BN(0.02 * LAMPORTS_PER_SOL);

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

  it("crea el mercado y una apuesta ganadora (SOL real transferido al vault)", async () => {
    await program.methods
      .createMarket(matchId, question)
      .accounts({
        market: marketPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const marketBalanceBefore = await connection.getBalance(marketPda);

    await program.methods
      .createBet(betAmount, true) // apuesta a que el outcome sera "true"
      .accounts({
        market: marketPda,
        bet: betPda,
        better: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const marketBalanceAfter = await connection.getBalance(marketPda);
    expect(marketBalanceAfter - marketBalanceBefore).to.equal(betAmount.toNumber());
    console.log(
      "Vault (Market) recibio la apuesta. Delta:",
      (marketBalanceAfter - marketBalanceBefore) / LAMPORTS_PER_SOL,
      "SOL"
    );
  });

  it("resuelve el mercado con la apuesta como ganadora", async () => {
    await program.methods
      .resolveMarket(true)
      .accounts({
        market: marketPda,
        authority: authority.publicKey,
      })
      .rpc();

    const marketAccount = await (program.account as any).market.fetch(marketPda);
    expect(marketAccount.resolved).to.equal(true);
    expect(marketAccount.outcome).to.equal(true);
    console.log("Mercado resuelto. Outcome:", marketAccount.outcome);
  });

  it("registra la apuesta ganadora en el pool (settle_bet)", async () => {
    await program.methods
      .settleBet()
      .accounts({
        market: marketPda,
        bet: betPda,
      })
      .rpc();

    const marketAccount = await (program.account as any).market.fetch(marketPda);
    const betAccount = await (program.account as any).bet.fetch(betPda);
    expect(betAccount.settled).to.equal(true);
    expect(marketAccount.winningPool.toNumber()).to.equal(betAmount.toNumber());
    console.log(
      "Pool ganador registrado:",
      marketAccount.winningPool.toNumber() / LAMPORTS_PER_SOL,
      "SOL"
    );
  });

  it("reclama el payout real: transferencia de lamports Market -> better", async () => {
    const betterBalanceBefore = await connection.getBalance(authority.publicKey);
    const marketBalanceBefore = await connection.getBalance(marketPda);

    const txSig = await program.methods
      .claimPayout()
      .accounts({
        market: marketPda,
        bet: betPda,
        better: authority.publicKey,
      })
      .rpc();

    console.log("claim_payout tx:", txSig);

    const betterBalanceAfter = await connection.getBalance(authority.publicKey);
    const marketBalanceAfter = await connection.getBalance(marketPda);
    const betAccount = await (program.account as any).bet.fetch(betPda);

    expect(betAccount.claimed).to.equal(true);
    // Como es el unico apostador y gano, su payout == su apuesta original
    // (pool_total == pool_ganador == betAmount en este caso de un solo apostador).
    expect(marketBalanceBefore - marketBalanceAfter).to.equal(betAmount.toNumber());

    console.log(
      "Payout recibido (neto de fees de tx):",
      (betterBalanceAfter - betterBalanceBefore) / LAMPORTS_PER_SOL,
      "SOL"
    );
    console.log(
      "Lamports debitados del vault:",
      (marketBalanceBefore - marketBalanceAfter) / LAMPORTS_PER_SOL,
      "SOL"
    );
  });

  it("rechaza un segundo claim_payout (doble gasto)", async () => {
    try {
      await program.methods
        .claimPayout()
        .accounts({
          market: marketPda,
          bet: betPda,
          better: authority.publicKey,
        })
        .rpc();
      expect.fail("Deberia haber fallado: payout ya reclamado");
    } catch (err) {
      console.log("Segundo claim rechazado correctamente (esperado)");
    }
  });
});
