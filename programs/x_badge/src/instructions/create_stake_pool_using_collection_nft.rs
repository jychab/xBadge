use std::borrow::Borrow;

use crate::{
    state::COLLECTION_STAKE_POOL_PREFIX, CreateStakePoolUsingCollectionNft, CustomError,
    InitializeArgs,
};
use anchor_lang::{prelude::*, solana_program};
use mpl_token_metadata::accounts::Metadata;

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, CreateStakePoolUsingCollectionNft<'info>>,
    data: InitializeArgs,
) -> Result<()> {
    let collection_metadata = Metadata::safe_deserialize(
        ctx.accounts
            .collection_metadata
            .data
            .try_borrow()
            .unwrap()
            .borrow(),
    )
    .unwrap();
    // Make sure collection mint metadata is legit
    if collection_metadata.mint != ctx.accounts.collection_payer_ata.mint {
        return err!(CustomError::MintMetadataMismatch);
    }
    // Make sure collection mint is a collection nft
    if collection_metadata.collection_details.is_none() {
        return err!(CustomError::NotCollectionNft);
    }
    // Make sure signer is one of the creators or update authority
    if let Some(creators) = collection_metadata.creators {
        let found_item = creators
            .iter()
            .find(|&x| x.verified && x.address == ctx.accounts.payer.key());
        match found_item {
            Some(_) => msg!("Signer is one of the creators for the collection nft"),
            None => return err!(CustomError::AuthorityMismatch),
        }
    } else if collection_metadata.update_authority == ctx.accounts.payer.key() {
        msg!("Signer is the updated authority for the collection nft")
    } else {
        return err!(CustomError::AuthorityMismatch);
    }

    ctx.accounts.collection_stake_pool_pda_authority.bump = *ctx
        .bumps
        .get("collection_stake_pool_pda_authority")
        .unwrap();
    ctx.accounts.collection_stake_pool_pda_authority.collection =
        ctx.accounts.collection_payer_ata.mint;
    ctx.accounts.collection_stake_pool_pda_authority.stake_pool = ctx.accounts.stake_pool.key();

    init_pool_cpi(ctx, data);

    Ok(())
}

fn init_pool_cpi(
    ctx: Context<'_, '_, '_, '_, CreateStakePoolUsingCollectionNft<'_>>,
    data: InitializeArgs,
) {
    let accounts: Vec<solana_program::instruction::AccountMeta> = vec![
        AccountMeta::new(ctx.accounts.stake_pool.key(), false),
        AccountMeta::new(ctx.accounts.identifier.key(), false),
        AccountMeta::new(ctx.accounts.collection_stake_pool_pda_authority.key(), true),
        AccountMeta::new(ctx.accounts.payer.key(), true),
        AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
    ];

    let init_pool_discriminator: [u8; 8] = [116, 233, 199, 204, 115, 159, 171, 36];

    let mut bytes_data = vec![];
    bytes_data.extend(init_pool_discriminator);
    bytes_data.extend(data.try_to_vec().unwrap());

    let account_infos: Vec<AccountInfo> = vec![
        ctx.accounts.stake_pool.to_account_info(),
        ctx.accounts.identifier.to_account_info(),
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
