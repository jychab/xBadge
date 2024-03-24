use crate::state::{CardinalStakePool, StakeAccount};
use anchor_lang::prelude::*;
use anchor_spl::token::{CloseAccount, Mint, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Unstake<'info> {
    pub mint: Account<'info, Mint>,

    /// CHECK: Checked by cpi
    #[account(mut)]
    pub stake_pool: UncheckedAccount<'info>,

    /// CHECK: Checked by cpi
    #[account(mut)]
    pub stake_authorization_record: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Checked by cpi
    pub stake_pool_program: Program<'info, CardinalStakePool>,

    #[account(
        mut,
        constraint = mint.to_account_info().owner == signer.key
      )]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [mint.key().as_ref()],
        bump = stake_account.bump,
        constraint = badge.to_account_info().owner == &stake_account.key(),
        constraint = mint.key() == stake_account.authority 
      )]
    pub stake_account: Account<'info, StakeAccount>,

    /// Check: Instruction will check that collection metadata for badge belongs to stake pool
    pub badge: Account<'info,Mint>,

    #[account(
      mut,
      constraint = signer_badge_token_account.owner == signer.key()
    )]
    pub signer_badge_token_account: Account<'info, TokenAccount>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    pub system_program: Program<'info, System>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
}

impl<'info> Unstake<'info> {
  pub fn into_transfer_to_signer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
    let cpi_accounts = Transfer {
        from: self.stake_account.to_account_info().clone(),
        to: self.signer_badge_token_account.to_account_info().clone(),
        authority: self.stake_account.to_account_info().clone(),
    };
    CpiContext::new(self.token_program.clone(), cpi_accounts)
}
pub fn into_close_context(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
  let cpi_accounts = CloseAccount {
      account: self.stake_account.to_account_info().clone(),
      destination: self.authority.to_account_info().clone(),
      authority: self.stake_account.to_account_info().clone(),
  };
  CpiContext::new(self.token_program.clone(), cpi_accounts)
}
}
