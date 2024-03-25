use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct CollectionStakePoolPdaAuthorityAccount {
    pub bump: u8,
    pub collection: Pubkey,
    pub stake_pool: Pubkey,
}

pub const COLLECTION_STAKE_POOL_PDA_AUTHORITY_ACCOUNT_SIZE: usize = 8 + 
1 + //bump
32 + // key
32; // key

pub const COLLECTION_STAKE_POOL_PREFIX: &str = "collection-stake-pool";