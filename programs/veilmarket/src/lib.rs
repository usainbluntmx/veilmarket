use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use ephemeral_rollups_sdk::access_control::{
    instructions::{
        CloseEphemeralPermissionCpi, CreateEphemeralPermissionCpi,
        UpdateEphemeralPermissionCpi,
    },
    structs::{
        EphemeralMembersArgs, EphemeralPermission, Member, TX_BALANCES_FLAG, TX_LOGS_FLAG,
        TX_MESSAGE_FLAG,
    },
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{
    create_request_high_priority_scoped_randomness_ix, RequestRandomnessParams,
};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;

declare_id!("2EAgovXRWjb5Vxmt4N3PNrWNDSt3AhvcLwUAPzkMsBLq");

pub const MARKET_SEED: &[u8] = b"market";
pub const BET_SEED: &[u8] = b"bet";

/// Permission Program de MagicBlock (fijo, documentado)
pub const PERMISSION_PROGRAM_ID: Pubkey =
    anchor_lang::pubkey!("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");

#[ephemeral]
#[program]
pub mod veilmarket {
    use super::*;

    /// Crea un mercado de predicción para un partido/evento del Mundial 2026.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        match_id: String,
        question: String,
    ) -> Result<()> {
        require!(match_id.len() <= 32, VeilMarketError::MatchIdTooLong);
        require!(question.len() <= 200, VeilMarketError::QuestionTooLong);

        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.match_id = match_id;
        market.question = question;
        market.resolved = false;
        market.outcome = false;
        market.total_pool = 0;
        market.winning_pool = 0;
        market.bump = ctx.bumps.market;
        Ok(())
    }

    /// Crea la cuenta Bet Y transfiere los lamports apostados al vault (Market).
    /// Debe correr en la capa base (ANTES de delegar), porque mover SOL real
    /// requiere una CPI al System Program, algo que no se hace dentro del ER.
    pub fn create_bet(
        ctx: Context<CreateBet>,
        amount: u64,
        predicted_outcome: bool,
    ) -> Result<()> {
        require!(!ctx.accounts.market.resolved, VeilMarketError::MarketAlreadyResolved);
        require!(amount > 0, VeilMarketError::InvalidAmount);

        // Transferencia real de SOL: better -> market (vault)
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.better.to_account_info(),
                    to: ctx.accounts.market.to_account_info(),
                },
            ),
            amount,
        )?;

        // Pre-fondea la cuenta Bet con el rent necesario para su futuro
        // EphemeralPermission en el Private ER (se paga una sola vez aqui,
        // en base layer, para no requerir top-ups despues).
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.better.to_account_info(),
                    to: ctx.accounts.bet.to_account_info(),
                },
            ),
            ephemeral_rollups_sdk::ephemeral_accounts::rent(
                EphemeralPermission::size_of(1) as u32,
            ),
        )?;

        let bet = &mut ctx.accounts.bet;
        bet.market = ctx.accounts.market.key();
        bet.better = ctx.accounts.better.key();
        bet.amount = amount;
        bet.predicted_outcome = predicted_outcome;
        bet.settled = false;
        bet.claimed = false;
        bet.bump = ctx.bumps.bet;

        let market = &mut ctx.accounts.market;
        market.total_pool = market
            .total_pool
            .checked_add(amount)
            .ok_or(VeilMarketError::Overflow)?;

        Ok(())
    }

    /// Cambia tu prediccion mientras el mercado sigue abierto. Pura mutacion,
    /// sin mover fondos: ideal para ejecutarse dentro del ER (rapido, gasless).
    pub fn update_prediction(ctx: Context<PlaceBet>, new_predicted_outcome: bool) -> Result<()> {
        require!(!ctx.accounts.market.resolved, VeilMarketError::MarketAlreadyResolved);
        let bet = &mut ctx.accounts.bet;
        bet.predicted_outcome = new_predicted_outcome;
        Ok(())
    }

    /// Resuelve el mercado. Solo la autoridad (creador) puede resolver.
    pub fn resolve_market(ctx: Context<ResolveMarket>, outcome: bool) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(!market.resolved, VeilMarketError::MarketAlreadyResolved);
        require_keys_eq!(
            market.authority,
            ctx.accounts.authority.key(),
            VeilMarketError::Unauthorized
        );

        market.resolved = true;
        market.outcome = outcome;
        Ok(())
    }

    /// Resolucion alternativa via VRF: pide un numero aleatorio verificable
    /// a los oraculos de MagicBlock para decidir el outcome (coin-flip
    /// justo). Util para mercados de "puro azar" o como desempate cuando
    /// el resultado real es disputado. Solo la autoridad puede solicitarlo.
    pub fn request_random_resolution(
        ctx: Context<RequestRandomResolution>,
        client_seed: u8,
    ) -> Result<()> {
        require!(!ctx.accounts.market.resolved, VeilMarketError::MarketAlreadyResolved);
        require_keys_eq!(
            ctx.accounts.market.authority,
            ctx.accounts.payer.key(),
            VeilMarketError::Unauthorized
        );

        msg!("Solicitando resolucion aleatoria via VRF...");
        let ix = create_request_high_priority_scoped_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: ID,
            callback_discriminator: instruction::ResolveMarketRandomCallback::DISCRIMINATOR
                .to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: ctx.accounts.market.key(),
                is_signer: false,
                is_writable: true,
            }]),
            ..Default::default()
        });
        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    /// Consume la randomness verificable y resuelve el mercado con un
    /// coin-flip justo: bit menos significativo del byte aleatorio decide
    /// el outcome. Solo puede ser llamado por el programa VRF via CPI.
    pub fn resolve_market_random_callback(
        ctx: Context<ResolveMarketRandomCallback>,
        randomness: [u8; 32],
    ) -> Result<()> {
        let outcome = randomness[0] & 1 == 0;
        msg!("Randomness recibida, outcome del coin-flip: {}", outcome);

        let market = &mut ctx.accounts.market;
        require!(!market.resolved, VeilMarketError::MarketAlreadyResolved);
        market.resolved = true;
        market.outcome = outcome;
        Ok(())
    }

    /// Registra una apuesta ganadora en el pool ganador acumulado.
    /// Debe llamarse una vez por Bet, despues de resolve_market y antes
    /// de claim_payout, para poder calcular el reparto pari-mutuel.
    pub fn settle_bet(ctx: Context<SettleBet>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let bet = &mut ctx.accounts.bet;

        require!(market.resolved, VeilMarketError::MarketNotResolved);
        require!(!bet.settled, VeilMarketError::BetAlreadySettled);

        bet.settled = true;
        if bet.predicted_outcome == market.outcome {
            market.winning_pool = market
                .winning_pool
                .checked_add(bet.amount)
                .ok_or(VeilMarketError::Overflow)?;
        }
        Ok(())
    }

    /// Libera el pago pari-mutuel al apostador ganador:
    /// payout = tu_apuesta * pool_total / pool_ganador
    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        let bet = &mut ctx.accounts.bet;

        require!(ctx.accounts.market.resolved, VeilMarketError::MarketNotResolved);
        require!(bet.settled, VeilMarketError::BetNotSettled);
        require!(!bet.claimed, VeilMarketError::AlreadyClaimed);
        require!(
            bet.predicted_outcome == ctx.accounts.market.outcome,
            VeilMarketError::LosingBet
        );
        require!(ctx.accounts.market.winning_pool > 0, VeilMarketError::NoWinners);

        let payout = (bet.amount as u128)
            .checked_mul(ctx.accounts.market.total_pool as u128)
            .ok_or(VeilMarketError::Overflow)?
            .checked_div(ctx.accounts.market.winning_pool as u128)
            .ok_or(VeilMarketError::Overflow)? as u64;

        bet.claimed = true;

        // Transferencia manual de lamports: Market es propiedad de este
        // programa, asi que podemos debitar/acreditar directamente.
        **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= payout;
        **ctx.accounts.better.to_account_info().try_borrow_mut_lamports()? += payout;

        Ok(())
    }

    /// Crea el EphemeralPermission de Bet directamente en el ER. El payer es
    /// la propia PDA de Bet (ya delegada), que firma via sus program seeds.
    /// Idempotente: si el permiso ya existe, no hace nada. Empieza publico;
    /// se activa la privacidad con set_bet_privacy.
    pub fn init_bet_permission(ctx: Context<BetPermissionContext>) -> Result<()> {
        if ctx.accounts.permission.lamports() > 0 {
            return Ok(());
        }
        let market_key = ctx.accounts.bet.market;
        let better_key = ctx.accounts.bet.better;
        let signers = [
            BET_SEED,
            market_key.as_ref(),
            better_key.as_ref(),
            &[ctx.bumps.bet],
        ];
        CreateEphemeralPermissionCpi {
            payer: ctx.accounts.bet.to_account_info(),
            permissioned_account: ctx.accounts.bet.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            args: EphemeralMembersArgs {
                is_private: false,
                members: vec![],
            },
        }
        .invoke_signed(&[&signers])?;
        Ok(())
    }

    /// Activa/desactiva la privacidad del monto de la apuesta en el ER.
    /// Cuando es privada, solo el apostador (`bet.better`) puede leer el
    /// estado (logs, mensajes, balances) via el TEE; cualquier otra wallet
    /// queda bloqueada en el ingreso.
    pub fn set_bet_privacy(ctx: Context<BetPermissionContext>, is_private: bool) -> Result<()> {
        let market_key = ctx.accounts.bet.market;
        let better_key = ctx.accounts.bet.better;
        let signers = [
            BET_SEED,
            market_key.as_ref(),
            better_key.as_ref(),
            &[ctx.bumps.bet],
        ];
        let members = if is_private {
            vec![Member {
                flags: TX_LOGS_FLAG | TX_MESSAGE_FLAG | TX_BALANCES_FLAG,
                pubkey: ctx.accounts.bet.better,
            }]
        } else {
            vec![]
        };
        UpdateEphemeralPermissionCpi {
            payer: ctx.accounts.bet.to_account_info(),
            permissioned_account: ctx.accounts.bet.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            authority: ctx.accounts.bet.to_account_info(),
            authority_is_signer: false,
            args: EphemeralMembersArgs { is_private, members },
        }
        .invoke_signed(&[&signers])?;
        Ok(())
    }

    /// Cierra el EphemeralPermission en el ER, devolviendo el rent a la
    /// PDA de Bet. Opcional, util antes de undelegate si se quiere limpiar.
    pub fn close_bet_permission(ctx: Context<BetPermissionContext>) -> Result<()> {
        let market_key = ctx.accounts.bet.market;
        let better_key = ctx.accounts.bet.better;
        let signers = [
            BET_SEED,
            market_key.as_ref(),
            better_key.as_ref(),
            &[ctx.bumps.bet],
        ];
        CloseEphemeralPermissionCpi {
            payer: ctx.accounts.bet.to_account_info(),
            permissioned_account: ctx.accounts.bet.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            authority: ctx.accounts.bet.to_account_info(),
            authority_is_signer: false,
        }
        .invoke_signed(&[&signers])?;
        Ok(())
    }

    /// Delega Market al Ephemeral Rollup.
    pub fn delegate_market(ctx: Context<DelegateMarketInput>, match_id: String) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[MARKET_SEED, match_id.as_bytes()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Delega Bet al Ephemeral Rollup. Debe llamarse despues de create_bet
    /// y antes de place_bet si se quiere apostar dentro del ER.
    pub fn delegate_bet(
        ctx: Context<DelegateBetInput>,
        market: Pubkey,
        better: Pubkey,
    ) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[BET_SEED, market.as_ref(), better.as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Commit manual del estado del mercado desde el ER hacia la capa base.
    pub fn commit_market(ctx: Context<CommitMarket>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.market.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Commit + undelegate: cierra la sesión ER y devuelve el estado final a Solana.
    pub fn undelegate_market(ctx: Context<CommitMarket>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.market.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Commit manual del estado de Bet desde el ER hacia la capa base.
    pub fn commit_bet(ctx: Context<CommitBet>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.bet.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Commit + undelegate de Bet: necesario antes de settle_bet/claim_payout
    /// si la apuesta fue delegada al ER (por privacidad o por votar en vivo).
    pub fn undelegate_bet(ctx: Context<CommitBet>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.bet.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

// ---------- Accounts (estado) ----------

#[account]
pub struct Market {
    pub authority: Pubkey,
    pub match_id: String,     // ej: "MEX-USA-2026-R1"
    pub question: String,     // ej: "Mexico anota antes del min 30?"
    pub resolved: bool,
    pub outcome: bool,
    pub total_pool: u64,
    pub winning_pool: u64,
    pub bump: u8,
}

impl Market {
    // 8 discriminator + 32 authority + (4+32) match_id + (4+200) question
    // + 1 resolved + 1 outcome + 8 total_pool + 8 winning_pool + 1 bump
    pub const MAX_SIZE: usize = 8 + 32 + (4 + 32) + (4 + 200) + 1 + 1 + 8 + 8 + 1;
}

#[account]
pub struct Bet {
    pub market: Pubkey,
    pub better: Pubkey,
    pub amount: u64,
    pub predicted_outcome: bool,
    pub settled: bool,
    pub claimed: bool,
    pub bump: u8,
}

impl Bet {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 8 + 1 + 1 + 1 + 1;
}

// ---------- Contexts ----------

#[derive(Accounts)]
#[instruction(match_id: String)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = Market::MAX_SIZE,
        seeds = [MARKET_SEED, match_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = better,
        space = Bet::MAX_SIZE,
        seeds = [BET_SEED, market.key().as_ref(), better.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub better: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut)]
    pub bet: Account<'info, Bet>,
    pub better: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    pub authority: Signer<'info>,
}

#[vrf]
#[derive(Accounts)]
pub struct RequestRandomResolution<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    /// CHECK: oracle queue de MagicBlock VRF, direccion fija verificada
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ResolveMarketRandomCallback<'info> {
    /// Verifica que quien llama es el programa VRF de MagicBlock via CPI,
    /// usando la identidad "scoped" (vinculada a este programa), que es
    /// el mecanismo recomendado actualmente (VRF_PROGRAM_IDENTITY global
    /// esta deprecado).
    #[account(address = ephemeral_vrf_sdk::consts::scoped_vrf_identity(&ID))]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct SettleBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut)]
    pub bet: Account<'info, Bet>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, has_one = better)]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub better: SystemAccount<'info>,
}

/// Contexto de delegación: delega la cuenta Market (patrón oficial MagicBlock).
#[delegate]
#[derive(Accounts)]
pub struct DelegateMarketInput<'info> {
    pub payer: Signer<'info>,
    /// CHECK: PDA a delegar (Market)
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,
}

/// Contexto de delegación: delega la cuenta Bet.
#[delegate]
#[derive(Accounts)]
pub struct DelegateBetInput<'info> {
    pub payer: Signer<'info>,
    /// CHECK: PDA a delegar (Bet)
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,
}

/// Contexto para las instrucciones de Private ER sobre Bet:
/// init_bet_permission, set_bet_privacy, close_bet_permission.
/// `permission` y `ephemeral_vault` son derivadas y validadas por el CPI
/// del Permission Program; el cliente debe pasar las direcciones correctas
/// (via los helpers del SDK @magicblock-labs/ephemeral-rollups-sdk).
#[derive(Accounts)]
pub struct BetPermissionContext<'info> {
    #[account(
        mut,
        seeds = [BET_SEED, bet.market.as_ref(), bet.better.as_ref()],
        bump
    )]
    pub bet: Account<'info, Bet>,
    /// CHECK: EphemeralPermission PDA, validada por el Permission Program via CPI
    #[account(mut)]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: vault del permiso efimero, validado por el Permission Program via CPI
    #[account(mut)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: programa Magic (ER), validado por la CPI del SDK
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: Permission Program de MagicBlock
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

/// Contexto de commit/undelegate (patrón oficial MagicBlock).
#[commit]
#[derive(Accounts)]
pub struct CommitMarket<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
}

/// Contexto de commit/undelegate para Bet.
#[commit]
#[derive(Accounts)]
pub struct CommitBet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub bet: Account<'info, Bet>,
}

// ---------- Errores ----------

#[error_code]
pub enum VeilMarketError {
    #[msg("match_id no puede exceder 32 caracteres")]
    MatchIdTooLong,
    #[msg("question no puede exceder 200 caracteres")]
    QuestionTooLong,
    #[msg("El mercado ya fue resuelto")]
    MarketAlreadyResolved,
    #[msg("El mercado aun no ha sido resuelto")]
    MarketNotResolved,
    #[msg("Monto de apuesta invalido")]
    InvalidAmount,
    #[msg("Overflow al sumar al pool")]
    Overflow,
    #[msg("No autorizado")]
    Unauthorized,
    #[msg("Este payout ya fue reclamado")]
    AlreadyClaimed,
    #[msg("Ya se coloco una apuesta en esta cuenta Bet")]
    BetAlreadyPlaced,
    #[msg("La apuesta no fue ganadora")]
    LosingBet,
    #[msg("Esta apuesta ya fue registrada en el settlement")]
    BetAlreadySettled,
    #[msg("Esta apuesta aun no ha sido registrada via settle_bet")]
    BetNotSettled,
    #[msg("No hay ganadores en este mercado")]
    NoWinners,
}
