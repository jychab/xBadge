use std::borrow::Borrow;

use anchor_lang::{prelude::*, solana_program};
use anchor_spl::token::{self, Transfer};
use mpl_token_metadata::accounts::Metadata;

use crate::{
    state::{COLLECTION_STAKE_POOL_PREFIX, VAULT_AUTHORITY_PREFIX},
    CustomError, UnstakeBadgeForDeauthorization,
};

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, UnstakeBadgeForDeauthorization<'info>>,
) -> Result<()> {
    if let Some(stake_entry) = &ctx.accounts.stake_entry {
        if !(stake_entry.pool == ctx.accounts.stake_pool.key()
            && stake_entry.original_mint == ctx.accounts.mint.key()
            && stake_entry.amount == 0)
        {
            return err!(CustomError::MintIsStillStaked);
        }
    }
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

    let auth_bump = ctx.accounts.vault_authority.bump;
    let seeds = &[
        VAULT_AUTHORITY_PREFIX.as_bytes(),
        &ctx.accounts.vault_authority.authority.key().to_bytes(),
        &[auth_bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_accounts = Transfer {
        from: ctx.accounts.badge_vault_authority_ata.to_account_info(),
        to: ctx.accounts.badge_payer_ata.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };

    let token_transfer_context = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(token_transfer_context, 1)?;

    deauthorize_mint_cpi(ctx);

    Ok(())
}

fn deauthorize_mint_cpi(ctx: Context<'_, '_, '_, '_, UnstakeBadgeForDeauthorization<'_>>) {
    let accounts: Vec<solana_program::instruction::AccountMeta> = vec![
        AccountMeta::new(ctx.accounts.stake_pool.key(), false),
        AccountMeta::new(ctx.accounts.stake_authorization_record.key(), false),
        AccountMeta::new(ctx.accounts.collection_stake_pool_pda_authority.key(), true),
    ];

    let deauthorize_mint_discriminator: [u8; 8] = [89, 117, 35, 36, 164, 184, 56, 26];

    let mut bytes_data = vec![];
    bytes_data.extend(deauthorize_mint_discriminator);

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
