use anchor_lang::prelude::*;

declare_id!("CrZVQmQ11QC6xz9RoBHWWFixhfJh5FHXwpwNL264bPmq");

pub mod contexts;
pub mod error;
pub mod instructions;
pub mod state;

pub use contexts::*;
pub use error::*;

#[program]
pub mod badge_staking {

    use super::*;

    pub fn create_stake_pool_using_collection_nft<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateStakePoolUsingCollectionNft<'info>>,
        data: InitializeArgs,
    ) -> Result<()> {
        instructions::create_stake_pool_using_collection_nft::handler(ctx, data)
    }

    pub fn stake_badge_for_authorization<'info>(
        ctx: Context<'_, '_, '_, 'info, StakeBadgeForAuthorization<'info>>,
    ) -> Result<()> {
        instructions::stake_badge_for_authorization::handler(ctx)
    }

    // pub fn unstake<'info>(ctx: Context<'_, '_, '_, 'info, Unstake<'info>>) -> Result<()> {
    //     instructions::unstake::handler(ctx)
    // }
}
