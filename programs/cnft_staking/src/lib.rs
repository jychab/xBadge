use anchor_lang::prelude::*;

declare_id!("J4sLUgubzqHERK3AtQ1iuXfGPBQdEdJLY9roa41XAzy4");

pub mod contexts;
pub mod instructions;
pub mod state;
pub mod utils;

pub use contexts::*;

#[program]
pub mod cnft_staking {
    use super::*;

    pub fn stake<'info>(
        ctx: Context<'_, '_, '_, 'info, Stake<'info>>,
        args: StakeArgs,
    ) -> Result<()> {
        instructions::stake::handler(ctx, args)
    }

    pub fn unstake<'info>(
        ctx: Context<'_, '_, '_, 'info, Unstake<'info>>,
        args: UnstakeArgs,
    ) -> Result<()> {
        instructions::unstake::handler(ctx, args)
    }
}
