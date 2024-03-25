use std::borrow::Borrow;

use crate::{
    contexts::StakeBadgeForAuthorization, state::COLLECTION_STAKE_POOL_PREFIX, CustomError,
};
use anchor_lang::{prelude::*, solana_program};
use anchor_spl::token::{self, Transfer};
use mpl_token_metadata::accounts::Metadata;

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, StakeBadgeForAuthorization<'info>>,
) -> Result<()> {
    ctx.accounts.vault_authority.authority = ctx.accounts.mint_payer_ata.mint;
    ctx.accounts.vault_authority.bump = *ctx.bumps.get("vault_authority").unwrap();

    let badge_metadata = Metadata::safe_deserialize(
        ctx.accounts
            .badge_metadata
            .data
            .try_borrow()
            .unwrap()
            .borrow(),
    )
    .unwrap();

    // Make sure badge metadata is legit
    if badge_metadata.mint != ctx.accounts.badge_payer_ata.mint {
        return err!(CustomError::MintMetadataMismatch);
    }
    // Make sure badge collection exist
    if let Some(collection) = badge_metadata.collection {
        // Make sure badge collection is verified and is equals to pda collection authority
        if !(collection.verified
            && ctx.accounts.collection_stake_pool_pda_authority.collection == collection.key)
        {
            return err!(CustomError::StakePoolMismatch);
        }
    } else {
        return err!(CustomError::NoCollectionFound);
    }

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_accounts = Transfer {
        from: ctx.accounts.badge_payer_ata.to_account_info(),
        to: ctx.accounts.badge_vault_authority_ata.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    let token_transfer_context = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(token_transfer_context, 1)?;

    //authorize mint for staking
    authorize_mint_cpi(ctx);

    Ok(())
}

fn authorize_mint_cpi(ctx: Context<'_, '_, '_, '_, StakeBadgeForAuthorization<'_>>) {
    let accounts: Vec<solana_program::instruction::AccountMeta> = vec![
        AccountMeta::new(ctx.accounts.stake_pool.key(), false),
        AccountMeta::new(ctx.accounts.stake_authorization_record.key(), false),
        AccountMeta::new(ctx.accounts.collection_stake_pool_pda_authority.key(), true),
        AccountMeta::new(ctx.accounts.payer.key(), true),
        AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
    ];

    let authorize_mint_discriminator: [u8; 8] = [9, 39, 140, 25, 174, 113, 9, 242];

    let mut bytes_data = vec![];
    bytes_data.extend(authorize_mint_discriminator);
    bytes_data.extend(ctx.accounts.mint_payer_ata.mint.to_bytes());

    let account_infos: Vec<AccountInfo> = vec![
        ctx.accounts.stake_pool.to_account_info(),
        ctx.accounts.stake_authorization_record.to_account_info(),
        ctx.accounts
            .collection_stake_pool_pda_authority
            .to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    ];

    let signer_seeds: &[&[&[u8]]] = &[&[
        COLLECTION_STAKE_POOL_PREFIX.as_bytes(),
        &ctx.accounts
            .collection_stake_pool_pda_authority
            .collection
            .as_ref(),
        &[ctx.accounts.collection_stake_pool_pda_authority.bump],
    ]];
    let _invoke = solana_program::program::invoke_signed(
        &solana_program::instruction::Instruction {
            program_id: ctx.accounts.stake_pool_program.key(),
            accounts,
            data: bytes_data,
        },
        &account_infos[..],
        signer_seeds,
    );
}
