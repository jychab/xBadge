use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct StakeAccount {
    pub bump: u8,
    pub authority: Pubkey,
}

pub const BADGE_STAKE_ACCOUNT_PREFIX: &str = "collection-stake-pool";

pub const STAKE_ACCOUNT_SIZE: usize = 8 + 
1 + // bump
32; // key

