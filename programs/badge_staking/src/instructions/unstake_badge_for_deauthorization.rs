use std::borrow::Borrow;

use anchor_lang::{prelude::*, solana_program};
use anchor_spl::token;
use mpl_token_metadata::accounts::Metadata;

use crate::{state::COLLECTION_STAKE_POOL_PREFIX, CustomError, UnstakeBadgeForDeauthorization};

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, UnstakeBadgeForDeauthorization<'info>>,
) -> Result<()> {
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

    let signer_seeds: &[&[&[u8]]] = &[&[
        &ctx.accounts.stake_account.authority.as_ref(),
        &[ctx.accounts.stake_account.bump],
    ]];

    token::transfer(
        ctx.accounts
            .into_transfer_to_signer_context()
            .with_signer(signer_seeds),
        1,
    )?;

    deauthorize_mint_cpi(ctx);

    Ok(())
}

fn deauthorize_mint_cpi(ctx: Context<'_, '_, '_, '_, UnstakeBadgeForDeauthorization<'_>>) {
    let accounts: Vec<solana_program::instruction::AccountMeta> = vec![
        AccountMeta::new(ctx.accounts.stake_pool.key(), false),
        AccountMeta::new(ctx.accounts.stake_authorization_record.key(), false),
        AccountMeta::new(ctx.accounts.collection_stake_pool_pda_authority.key(), true),
    ];

    let init_pool_discriminator: [u8; 8] = [116, 233, 199, 204, 115, 159, 171, 36];

    let mut bytes_data = vec![];
    bytes_data.extend(init_pool_discriminator);

    let account_infos: Vec<AccountInfo> = vec![
        ctx.accounts.stake_pool.to_account_info(),
        ctx.accounts.stake_authorization_record.to_account_info(),
        ctx.accounts
            .collection_stake_pool_pda_authority
            .to_account_info(),
    ];

    let signer_seeds: &[&[&[u8]]] = &[&[
        COLLECTION_STAKE_POOL_PREFIX.as_bytes(),
        &ctx.accounts
            .collection_stake_pool_pda_authority
            .collection
            .as_ref(),
        &ctx.accounts
            .collection_stake_pool_pda_authority
            .stake_pool
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
