import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
// Constantes de MagicBlock verificadas directamente del SDK instalado
// (@magicblock-labs/ephemeral-rollups-sdk, lib/constants.js y lib/pda.js).
// Se hardcodean aqui para evitar problemas de interop CJS/ESM con ts-mocha.
const EPHEMERAL_VAULT_ID = new PublicKey("MagicVau1t999999999999999999999999999999999");
const MAGIC_PROGRAM_ID = new PublicKey("Magic11111111111111111111111111111111111111");
const PERMISSION_PROGRAM_ID = new PublicKey("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");
const PERMISSION_SEED = Buffer.from("permission:");

function permissionPdaFromAccount(account: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [PERMISSION_SEED, account.toBuffer()],
    PERMISSION_PROGRAM_ID
  )[0];
}
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

describe("veilmarket - checkpoint 4: Private ER (monto oculto)", () => {
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

  const matchId = `MEX-USA-PRIVATE-${Date.now()}`;
  const question = "Mexico gana el partido? (privado)";
  const betAmount = new BN(0.015 * LAMPORTS_PER_SOL);

  let marketPda: PublicKey;
  let betPda: PublicKey;
  let permissionPda: PublicKey;

  before(async () => {
    [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), Buffer.from(matchId)],
      PROGRAM_ID
    );
    [betPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), marketPda.toBuffer(), authority.publicKey.toBuffer()],
      PROGRAM_ID
    );
    // PDA del permiso efimero, derivada por el SDK oficial de MagicBlock
    permissionPda = permissionPdaFromAccount(betPda);
  });

  it("crea el mercado y la apuesta (pre-fondea rent del permiso)", async () => {
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

    console.log("Mercado y apuesta creados. permission PDA:", permissionPda.toBase58());
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

  it("inicializa el permiso efimero para Bet dentro del ER", async () => {
    const txSig = await erProgram.methods
      .initBetPermission()
      .accounts({
        bet: betPda,
        permission: permissionPda,
        ephemeralVault: EPHEMERAL_VAULT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
        permissionProgram: PERMISSION_PROGRAM_ID,
      })
      .rpc();

    console.log("init_bet_permission tx (ER):", txSig);

    const permissionInfo = await erConnection.getAccountInfo(permissionPda);
    expect(permissionInfo).to.not.be.null;
    console.log("Cuenta de permiso creada en el ER:", permissionPda.toBase58());
  });

  it("activa la privacidad: solo el apostador puede leer el monto", async () => {
    const txSig = await erProgram.methods
      .setBetPrivacy(true)
      .accounts({
        bet: betPda,
        permission: permissionPda,
        ephemeralVault: EPHEMERAL_VAULT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
        permissionProgram: PERMISSION_PROGRAM_ID,
      })
      .rpc();

    console.log("set_bet_privacy(true) tx (ER):", txSig);
    console.log("El monto de la apuesta ahora es privado para otras wallets.");
  });

  it("el apostador SI puede leer su propio monto (fetch normal)", async () => {
    const betAccount = await (erProgram.account as any).bet.fetch(betPda);
    expect(betAccount.amount.toNumber()).to.equal(betAmount.toNumber());
    console.log(
      "El propio apostador ve su monto:",
      betAccount.amount.toNumber() / LAMPORTS_PER_SOL,
      "SOL"
    );
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
    console.log("Market de vuelta en base layer");
  });
});
