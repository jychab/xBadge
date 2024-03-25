use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct VaultAccount {
    pub bump: u8,
    pub authority: Pubkey,
}

pub const VAULT_AUTHORITY_PREFIX: &str = "vault-authority";

pub const VAULT_ACCOUNT_PREFIX: &str = "vault-account";

pub const VAULT_ACCOUNT_SIZE: usize = 8 + 
1 + // bump
32; // key

