use anchor_lang::prelude::*;
use anchor_spl::token;
use cardinal_stake_pool::cpi::accounts::DeauthorizeMintCtx;

use crate::Unstake;

pub fn handler<'info>(ctx: Context<'_, '_, '_, 'info, Unstake<'info>>) -> Result<()> {
    let signer_seeds: &[&[&[u8]]] = &[&[
        &ctx.accounts.stake_account.authority.as_ref(),
        &[ctx.accounts.stake_account.bump],
    ]];

    token::transfer(
        ctx.accounts
            .into_transfer_to_signer_context()
            .with_signer(signer_seeds),
        1,
    )?;

    token::close_account(ctx.accounts.into_close_context().with_signer(signer_seeds))?;

    let _ = cardinal_stake_pool::cpi::deauthorize_mint(CpiContext::new(
        ctx.accounts.stake_pool_program.to_account_info(),
        DeauthorizeMintCtx {
            stake_authorization_record: ctx.accounts.stake_authorization_record.to_account_info(),
            stake_pool: ctx.accounts.stake_pool.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        },
    ));

    Ok(())
}
