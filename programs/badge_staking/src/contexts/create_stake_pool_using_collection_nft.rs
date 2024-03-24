use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::state::{
    CardinalStakePool, CollectionStakePoolPdaAuthorityAccount,
    COLLECTION_STAKE_POOL_PDA_AUTHORITY_ACCOUNT_SIZE, COLLECTION_STAKE_POOL_PREFIX,
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeArgs {
    pub overlay_text: String,
    pub image_uri: String,
    pub requires_collections: Vec<Pubkey>,
    pub requires_creators: Vec<Pubkey>,
    pub requires_authorization: bool,
    pub authority: Pubkey,
    pub reset_on_stake: bool,
    pub cooldown_seconds: Option<u32>,
    pub min_stake_seconds: Option<u32>,
    pub end_date: Option<i64>,
    pub double_or_reset_enabled: Option<bool>,
}

#[derive(Accounts)]
pub struct CreateStakePoolUsingCollectionNft<'info> {
    /// CHECK: Checked by cpi
    #[account(mut)]
    pub stake_pool: UncheckedAccount<'info>,

    /// CHECK: Checked by cpi
    #[account(mut)]
    pub identifier: UncheckedAccount<'info>,

    /// CHECK: Checked by cpi
    pub stake_pool_program: Program<'info, CardinalStakePool>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
		  init,
		  payer = payer,
          seeds = [COLLECTION_STAKE_POOL_PREFIX.as_bytes(), collection_payer_ata.mint.as_ref(),stake_pool.key().as_ref()],
          bump,
		  space = COLLECTION_STAKE_POOL_PDA_AUTHORITY_ACCOUNT_SIZE
    )]
    pub collection_stake_pool_pda_authority: Account<'info, CollectionStakePoolPdaAuthorityAccount>,

    #[account(
        constraint = collection_payer_ata.owner == payer.key(),
        constraint = collection_payer_ata.amount > 0
    )]
    pub collection_payer_ata: Account<'info, TokenAccount>,

    /// CHECK: Checked in instruction to make sure collection_mint_metadata belongs to collection_mint
    pub collection_metadata: AccountInfo<'info>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    pub system_program: Program<'info, System>,
}
