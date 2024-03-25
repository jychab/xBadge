use crate::state::{
    get_stake_seed, CardinalStakePool, CollectionStakePoolPdaAuthorityAccount, StakeEntry, VaultAccount, STAKE_ENTRY_PREFIX, VAULT_AUTHORITY_PREFIX
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(Accounts)]
pub struct UnstakeBadgeForDeauthorization<'info> {
    #[account(
    constraint = mint_payer_ata.owner == payer.key(),
    constraint = mint_payer_ata.mint == mint.key(),
    constraint = mint_payer_ata.amount > 0
    )]
    pub mint_payer_ata: Account<'info, TokenAccount>,

    pub mint: Account<'info,Mint>,

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
        seeds = [VAULT_AUTHORITY_PREFIX.as_bytes(),mint.key().as_ref()],
        bump = vault_authority.bump,
      )]
    pub vault_authority: Account<'info, VaultAccount>,

    #[account(
      mut,
      constraint = badge_vault_authority_ata.owner == vault_authority.key(),
      constraint = badge_vault_authority_ata.mint == badge_payer_ata.mint,
      constraint = badge_vault_authority_ata.amount > 0,  
    )]
    pub badge_vault_authority_ata: Account<'info, TokenAccount>,

    #[account(
      seeds = [
        STAKE_ENTRY_PREFIX.as_bytes(), 
        stake_entry.pool.as_ref(), 
        stake_entry.original_mint.as_ref(), 
        get_stake_seed(mint.supply, payer.key()).as_ref()
      ],
      seeds::program = CardinalStakePool::id(),
      bump=stake_entry.bump,
    )]
    /// CHECK: Check is done in Instructions
    pub stake_entry: Option<Account<'info, StakeEntry>>,

    #[account(
      mut,
      constraint = collection_stake_pool_pda_authority.stake_pool == stake_pool.key()
    )]
    pub collection_stake_pool_pda_authority: Account<'info, CollectionStakePoolPdaAuthorityAccount>,

    #[account(
      mut,
      constraint = badge_payer_ata.owner == payer.key(),
    )]
    pub badge_payer_ata: Account<'info, TokenAccount>,

    /// CHECK: Check is done in Instructions
    pub badge_metadata: AccountInfo<'info>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    pub system_program: Program<'info, System>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
}
