use anchor_lang::prelude::*;
use spl_account_compression::{program::SplAccountCompression, Noop};

use crate::{state::*, utils::Bubblegum};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct StakeArgs {
    pub root: [u8; 32],
    pub data_hash: [u8; 32],
    pub creator_hash: [u8; 32],
    pub nonce: u64,
    pub index: u32,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
      init_if_needed,
      seeds = [signer.key.as_ref()],
      bump,
      payer = signer,
      space = STAKE_ACCOUNT_SIZE,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    /// CHECK: Checked by cpi
    #[account(
      mut,
      seeds = [merkle_tree.key().as_ref()],
      bump,
      seeds::program = bubblegum_program.key(),
    )]
    pub tree_authority: AccountInfo<'info>,

    /// CHECK: Checked by cpi
    #[account(mut)]
    pub merkle_tree: AccountInfo<'info>,

    /// CHECK: Checked by cpi
    pub bubblegum_program: Program<'info, Bubblegum>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub system_program: Program<'info, System>,
}
