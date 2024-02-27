use anchor_lang::{prelude::*, solana_program};

use crate::{Unstake, UnstakeArgs};

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, Unstake<'info>>,
    args: UnstakeArgs,
) -> Result<()> {
    let asset_id = mpl_bubblegum::utils::get_asset_id(ctx.accounts.merkle_tree.key, args.nonce);

    ctx.accounts.stake_account.assets.retain(|x| x != &asset_id);

    let mut accounts: Vec<solana_program::instruction::AccountMeta> = vec![
        AccountMeta::new_readonly(ctx.accounts.tree_authority.key(), false),
        AccountMeta::new_readonly(ctx.accounts.stake_account.key(), true),
        AccountMeta::new_readonly(ctx.accounts.stake_account.key(), false),
        AccountMeta::new_readonly(ctx.accounts.signer.key(), false),
        AccountMeta::new(ctx.accounts.merkle_tree.key(), false),
        AccountMeta::new_readonly(ctx.accounts.log_wrapper.key(), false),
        AccountMeta::new_readonly(ctx.accounts.compression_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
    ];

    // first 8 bytes of SHA256("global:transfer")
    let transfer_discriminator: [u8; 8] = [163, 52, 200, 231, 140, 3, 69, 186]; //hex::decode("a334c8e78c0345ba").expect("hex decode fail");
                                                                                //msg!("{:?}", transfer_discriminator);

    let mut data: Vec<u8> = vec![];
    data.extend(transfer_discriminator);
    data.extend(args.root);
    data.extend(args.data_hash);
    data.extend(args.creator_hash);
    data.extend(args.nonce.to_le_bytes());
    data.extend(args.index.to_le_bytes());

    let mut account_infos: Vec<AccountInfo> = vec![
        ctx.accounts.tree_authority.to_account_info(),
        ctx.accounts.stake_account.to_account_info(),
        ctx.accounts.stake_account.to_account_info(),
        ctx.accounts.signer.to_account_info(),
        ctx.accounts.merkle_tree.to_account_info(),
        ctx.accounts.log_wrapper.to_account_info(),
        ctx.accounts.compression_program.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    ];

    // add "accounts" (hashes) that make up the merkle proof
    for acc in ctx.remaining_accounts.iter() {
        accounts.push(AccountMeta::new_readonly(acc.key(), false));
        account_infos.push(acc.to_account_info());
    }
    let signer_seeds: &[&[&[u8]]] = &[&[
        &ctx.accounts.stake_account.address.as_ref(),
        &[ctx.accounts.stake_account.bump],
    ]];

    let _ = solana_program::program::invoke_signed(
        &solana_program::instruction::Instruction {
            program_id: ctx.accounts.bubblegum_program.key(),
            accounts: accounts,
            data: data,
        },
        &account_infos[..],
        signer_seeds,
    )
    .map_err(Into::<ProgramError>::into);

    Ok(())
}
