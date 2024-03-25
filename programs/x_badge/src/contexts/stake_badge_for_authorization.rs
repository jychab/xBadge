use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{Mint, TokenAccount}};

#[derive(Accounts)]
pub struct StakeBadgeForAuthorization<'info> {
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
      init_if_needed,
      seeds = [VAULT_AUTHORITY_PREFIX.as_bytes(),mint_payer_ata.mint.as_ref()],
      bump,
      payer = payer,
      space = VAULT_ACCOUNT_SIZE,
    )]
    pub vault_authority: Account<'info, VaultAccount>,

    #[account(
      init_if_needed,
      payer = payer,
      associated_token::mint = badge, 
      associated_token::authority = vault_authority 
    )]
    pub badge_vault_authority_ata: Account<'info, TokenAccount>,

    #[account(
      mut,
      constraint = collection_stake_pool_pda_authority.stake_pool == stake_pool.key()
    )]
    pub collection_stake_pool_pda_authority: Account<'info, CollectionStakePoolPdaAuthorityAccount>,

    pub badge: Account<'info, Mint>,

    #[account(
      mut,
      constraint = badge_payer_ata.owner == payer.key(),
      constraint = badge_payer_ata.amount > 0,
      constraint = badge_payer_ata.mint == badge.key()
    )]
    pub badge_payer_ata: Account<'info, TokenAccount>,

    /// CHECK: Instruction will check that collection metadata for badge belongs to stake pool
    pub badge_metadata: AccountInfo<'info>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    pub system_program: Program<'info, System>,

    // ATA Program required to create ATA for pda_nft_account
    pub associated_token_program: Program<'info, AssociatedToken>,
    
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
}
