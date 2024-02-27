use anchor_lang::prelude::*;
use solana_program::program_pack::IsInitialized;

#[account]
#[derive(Default)]
pub struct StakeAccount {
    pub is_initialized: bool,
    pub bump: u8,
    pub address: Pubkey,
    pub assets: Vec<Pubkey>,
}

impl IsInitialized for StakeAccount {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

pub const STAKE_ACCOUNT_SIZE: usize = 8 + 
1 +
1 + // bump
32+ // key;
4 +
6*32;
