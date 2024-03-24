use crate::state::{
    CardinalStakePool, CollectionStakePoolPdaAuthorityAccount, StakeAccount,
    BADGE_STAKE_ACCOUNT_PREFIX,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount, Transfer};

#[derive(Accounts)]
pub struct UnstakeBadgeForDeauthorization<'info> {
    #[account(
    constraint = mint_payer_ata.owner == payer.key(),
    constraint = mint_payer_ata.amount > 0
  )]
    pub mint_payer_ata: Account<'info, TokenAccount>,

    /// CHECK: Checked by cpi
    #[account(mut)]
    pub stake_pool: UncheckedAccount<'info>,

    /// CHECK: Checked by cpi
    #[account(mut)]
    pub stake_authorization_record: UncheckedAccount<'info>,

    /// CHECK: Checked by cpi
    pub stake_pool_program: Program<'info, CardinalStakePool>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [BADGE_STAKE_ACCOUNT_PREFIX.as_bytes(),mint_payer_ata.mint.as_ref()],
        bump = stake_account.bump,
        constraint = mint_payer_ata.mint == stake_account.authority
      )]
    pub stake_account: Account<'info, StakeAccount>,

    #[
      account(
        constraint = collection_stake_pool_pda_authority.stake_pool == stake_pool.key()
      )
    ]
    pub collection_stake_pool_pda_authority: Account<'info, CollectionStakePoolPdaAuthorityAccount>,

    #[account(
      constraint = badge_payer_ata.owner == payer.key(),
    )]
    pub badge_payer_ata: Account<'info, TokenAccount>,

    /// CHECK: Instruction will check that collection metadata for badge belongs to stake pool
    pub badge_metadata: AccountInfo<'info>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    pub system_program: Program<'info, System>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
}

impl<'info> UnstakeBadgeForDeauthorization<'info> {
    pub fn into_transfer_to_signer_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.stake_account.to_account_info().clone(),
            to: self.badge_payer_ata.to_account_info().clone(),
            authority: self.stake_account.to_account_info().clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}
