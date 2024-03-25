use std::str::FromStr;

use anchor_lang::prelude::*;

#[derive(Clone)]
pub struct CardinalStakePool;

#[account]
pub struct StakeEntry {
    pub bump: u8,
    pub pool: Pubkey,
    pub amount: u64,
    pub original_mint: Pubkey,
    pub original_mint_claimed: bool,
    pub last_staker: Pubkey,
    pub last_staked_at: i64,
    pub total_stake_seconds: u128,
    pub stake_mint_claimed: bool,
    pub kind: u8,
    pub stake_mint: Option<Pubkey>,
    pub cooldown_start_seconds: Option<i64>,
    pub last_updated_at: Option<i64>,
    pub grouped: Option<bool>,
}

pub const STAKE_ENTRY_PREFIX: &str = "stake-entry";

impl anchor_lang::Id for CardinalStakePool {
    fn id() -> Pubkey {
        Pubkey::from_str("2gvBmibwtBnbkLExmgsijKy6hGXJneou8X6hkyWQvYnF").unwrap()
    }
}

pub fn get_stake_seed(supply: u64, user: Pubkey) -> Pubkey {
    if supply > 1 {
        user
    } else {
        Pubkey::default()
    }
}
