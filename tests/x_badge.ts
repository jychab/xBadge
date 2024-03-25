import { XBadge } from "../target/types/x_badge";
import {
  MPL_TOKEN_METADATA_PROGRAM_ID,
  TokenStandard,
  createNft,
  createV1,
  fetchDigitalAssetWithAssociatedToken,
  findMetadataPda,
  mintV1,
  mplTokenMetadata,
  verifyCollectionV1,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  KeypairSigner,
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey,
  sol,
} from "@metaplex-foundation/umi";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import {
  IDL as CardinalStakePoolIdl,
  CardinalStakePool,
} from "../deps/cardinal-staking/src/idl/cardinal_stake_pool";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  toWeb3JsKeypair,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { assert } from "chai";
import { step, xstep } from "mocha-steps";

describe("XBadge", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  //
  // Program APIs.
  //
  const CARDINAL_STAKE_POOL_PROGRAM_ID = new PublicKey(
    "2gvBmibwtBnbkLExmgsijKy6hGXJneou8X6hkyWQvYnF"
  );
  const program = anchor.workspace.XBadge as Program<XBadge>;

  const stakePoolProgram = new Program<CardinalStakePool>(
    CardinalStakePoolIdl,
    CARDINAL_STAKE_POOL_PROGRAM_ID
  );

  // Use the RPC endpoint of your choice.
  const umi = createUmi(program.provider.connection.rpcEndpoint);

  const signer = umi.eddsa.createKeypairFromSecretKey(
    Buffer.from([
      225, 66, 240, 160, 100, 176, 216, 156, 98, 248, 136, 34, 108, 179, 97, 33,
      245, 103, 165, 252, 153, 131, 20, 190, 60, 85, 11, 240, 176, 184, 50, 183,
      208, 37, 214, 8, 236, 36, 232, 48, 167, 48, 193, 156, 104, 55, 81, 126,
      209, 94, 147, 84, 22, 209, 65, 127, 206, 246, 2, 145, 207, 168, 186, 29,
    ])
  );
  umi.use(mplTokenMetadata()).use(keypairIdentity(signer));

  let collectionMintAddress: KeypairSigner["publicKey"];
  let collectionMetadataAddress;
  let identifierId;
  let identifier;

  let mintAddress: KeypairSigner["publicKey"];
  let badgeAddress: KeypairSigner["publicKey"];

  step("Create a colletion nft & mint fungible asset", async () => {
    await umi.rpc.airdrop(signer.publicKey, sol(2));
    const collectionMint = generateSigner(umi);
    await createNft(umi, {
      tokenOwner: signer.publicKey,
      mint: collectionMint,
      name: "My SFT Collection",
      uri: "https://example.com/my-collection.json",
      sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
      creators: [{ address: signer.publicKey, verified: true, share: 100 }],
      isCollection: true,
    }).sendAndConfirm(umi);
    collectionMintAddress = collectionMint.publicKey;
    [collectionMetadataAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        toWeb3JsPublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBuffer(),
        new PublicKey(collectionMintAddress).toBuffer(),
      ],
      toWeb3JsPublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)
    );

    const mint = generateSigner(umi);
    await createNft(umi, {
      tokenOwner: signer.publicKey,
      mint: mint,
      name: "XYZ",
      uri: "https://example.com/my-collection.json",
      sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    }).sendAndConfirm(umi);
    mintAddress = mint.publicKey;

    const badge = generateSigner(umi);
    await createV1(umi, {
      mint: badge,
      authority: umi.payer,
      name: "My NFT",
      uri: "",
      sellerFeeBasisPoints: percentAmount(5.5),
      collection: { verified: false, key: collectionMintAddress },
      tokenStandard: TokenStandard.FungibleAsset,
    }).sendAndConfirm(umi);
    badgeAddress = badge.publicKey;

    await verifyCollectionV1(umi, {
      metadata: findMetadataPda(umi, { mint: badge.publicKey }),
      collectionMint: collectionMintAddress,
      authority: umi.payer,
    }).sendAndConfirm(umi);

    await mintV1(umi, {
      mint: badge.publicKey,
      authority: umi.payer,
      amount: 1,
      tokenOwner: signer.publicKey,
      tokenStandard: TokenStandard.FungibleAsset,
    }).sendAndConfirm(umi);
  });

  step("Initialize an identifier if required", async () => {
    [identifierId] = PublicKey.findProgramAddressSync(
      [Buffer.from("identifier")],
      stakePoolProgram.programId
    );
    const identifierData =
      await stakePoolProgram.account.identifier.fetchNullable(identifierId);

    identifier =
      identifierData !== null ? identifierData.count : new anchor.BN(1);

    if (!identifierData) {
      await stakePoolProgram.methods
        .initIdentifier()
        .accounts({
          identifier: identifierId,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([toWeb3JsKeypair(signer)])
        .rpc();
    }
  });

  step("Initialize a stake pool", async () => {
    const [stakePoolId] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake-pool"), identifier.toArrayLike(Buffer, "le", 8)],
      stakePoolProgram.programId
    );

    const [collectionStakePoolPdaAuthority] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("collection-stake-pool"),
        toWeb3JsPublicKey(collectionMintAddress).toBuffer(),
      ],
      program.programId
    );

    const collectionPayerAta = await fetchDigitalAssetWithAssociatedToken(
      umi,
      collectionMintAddress,
      signer.publicKey
    );

    try {
      await program.methods
        .createStakePoolUsingCollectionNft({
          overlayText: "Fock it.",
          imageUri: "https://www.madlads.com/mad_lads_logo.svg",
          requiresCollections: [],
          requiresCreators: [],
          requiresAuthorization: true,
          authority: SystemProgram.programId,
          resetOnStake: false,
          cooldownSeconds: null,
          minStakeSeconds: null,
          endDate: null,
          doubleOrResetEnabled: false,
        })
        .accounts({
          payer: signer.publicKey,
          stakePool: stakePoolId,
          stakePoolProgram: stakePoolProgram.programId,
          identifier: identifierId,
          collectionStakePoolPdaAuthority: collectionStakePoolPdaAuthority,
          collectionPayerAta: collectionPayerAta.token.publicKey,
          collectionMetadata: collectionMetadataAddress,
          systemProgram: SystemProgram.programId,
        })
        .signers([toWeb3JsKeypair(signer)])
        .rpc();
    } catch (e) {
      console.log(e);
    }

    const collectionStakePoolPdaAuthorityAccountData =
      await program.account.collectionStakePoolPdaAuthorityAccount.fetch(
        collectionStakePoolPdaAuthority
      );
    assert(
      collectionStakePoolPdaAuthorityAccountData.collection.toBase58() ===
        toWeb3JsPublicKey(collectionMintAddress).toBase58(),
      `StakePoolPda Collection: ${
        collectionStakePoolPdaAuthorityAccountData.collection
      } not equals ${toWeb3JsPublicKey(collectionMintAddress)}`
    );
    assert(
      collectionStakePoolPdaAuthorityAccountData.stakePool.toBase58() ===
        stakePoolId.toBase58(),
      `StakePoolPda StakePool: ${collectionStakePoolPdaAuthorityAccountData.stakePool} not equals ${stakePoolId}`
    );
    const stakeAccountData = await stakePoolProgram.account.stakePool.fetch(
      stakePoolId
    );
    assert(
      stakeAccountData.authority.toBase58() ===
        collectionStakePoolPdaAuthority.toBase58(),
      `StakeAccountData Authority: ${stakeAccountData.authority} not equals ${collectionStakePoolPdaAuthority}`
    );
  });

  step("Stake Badge for Authorization", async () => {
    const [badgeMetadata] = findMetadataPda(umi, { mint: badgeAddress });

    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault-authority"),
        toWeb3JsPublicKey(mintAddress).toBuffer(),
      ],
      program.programId
    );
    const [collectionStakePoolPdaAuthority] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("collection-stake-pool"),
        toWeb3JsPublicKey(collectionMintAddress).toBuffer(),
      ],
      program.programId
    );
    const stakePoolId = (
      await program.account.collectionStakePoolPdaAuthorityAccount.fetch(
        collectionStakePoolPdaAuthority
      )
    ).stakePool;
    const [stakeAuthorizationRecord] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("stake-authorization"),
        stakePoolId.toBuffer(),
        toWeb3JsPublicKey(mintAddress).toBuffer(),
      ],
      stakePoolProgram.programId
    );
    const mintPayerAta = await fetchDigitalAssetWithAssociatedToken(
      umi,
      mintAddress,
      signer.publicKey
    );
    const badgePayerAta = await fetchDigitalAssetWithAssociatedToken(
      umi,
      badgeAddress,
      signer.publicKey
    );
    const badgeVaultAuthorityAta = getAssociatedTokenAddressSync(
      toWeb3JsPublicKey(badgeAddress),
      vaultAuthority,
      true
    );
    try {
      await program.methods
        .stakeBadgeForAuthorization()
        .accounts({
          mintPayerAta: mintPayerAta.token.publicKey,
          vaultAuthority: vaultAuthority,
          badgeVaultAuthorityAta: badgeVaultAuthorityAta,
          stakePool: stakePoolId,
          stakePoolProgram: stakePoolProgram.programId,
          stakeAuthorizationRecord: stakeAuthorizationRecord,
          collectionStakePoolPdaAuthority: collectionStakePoolPdaAuthority,
          badge: badgeAddress,
          badgePayerAta: badgePayerAta.token.publicKey,
          badgeMetadata: badgeMetadata,
          payer: signer.publicKey,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([toWeb3JsKeypair(signer)])
        .rpc();
    } catch (e) {
      console.log(e);
    }

    const stakeAuthorizationRecordData =
      await stakePoolProgram.account.stakeAuthorizationRecord.fetch(
        stakeAuthorizationRecord
      );
    assert(
      stakeAuthorizationRecordData.mint.toBase58() ===
        toWeb3JsPublicKey(mintAddress).toBase58(),
      "Invalid mint on authorization record"
    );
    assert(
      stakeAuthorizationRecordData.pool.toBase58() === stakePoolId.toBase58(),
      "Invalid stake pool id on authorization record"
    );
  });

  step("Unstake Badge for Deauthorization", async () => {
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault-authority"),
        toWeb3JsPublicKey(mintAddress).toBuffer(),
      ],
      program.programId
    );
    const [collectionStakePoolPdaAuthority] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("collection-stake-pool"),
        toWeb3JsPublicKey(collectionMintAddress).toBuffer(),
      ],
      program.programId
    );
    const stakePoolId = (
      await program.account.collectionStakePoolPdaAuthorityAccount.fetch(
        collectionStakePoolPdaAuthority
      )
    ).stakePool;
    const [stakeAuthorizationRecord] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("stake-authorization"),
        stakePoolId.toBuffer(),
        toWeb3JsPublicKey(mintAddress).toBuffer(),
      ],
      stakePoolProgram.programId
    );
    const mintPayerAta = await fetchDigitalAssetWithAssociatedToken(
      umi,
      mintAddress,
      signer.publicKey
    );
    const badgePayerAta = await fetchDigitalAssetWithAssociatedToken(
      umi,
      badgeAddress,
      signer.publicKey
    );
    const badgeVaultAuthorityAta = getAssociatedTokenAddressSync(
      toWeb3JsPublicKey(badgeAddress),
      vaultAuthority,
      true
    );

    const [badgeMetadata] = findMetadataPda(umi, { mint: badgeAddress });

    try {
      await program.methods
        .unstakeBadgeForDeauthorization()
        .accounts({
          mintPayerAta: mintPayerAta.token.publicKey,
          stakePool: stakePoolId,
          stakePoolProgram: stakePoolProgram.programId,
          stakeAuthorizationRecord: stakeAuthorizationRecord,
          collectionStakePoolPdaAuthority: collectionStakePoolPdaAuthority,
          vaultAuthority: vaultAuthority,
          stakeEntry: null,
          badgeVaultAuthorityAta: badgeVaultAuthorityAta,
          mint: mintAddress,
          badgePayerAta: badgePayerAta.token.publicKey,
          badgeMetadata: badgeMetadata,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([toWeb3JsKeypair(signer)])
        .rpc();
    } catch (e) {
      console.log(e);
    }

    const stakeAuthorizationRecordData =
      await stakePoolProgram.account.stakeAuthorizationRecord.fetchNullable(
        stakeAuthorizationRecord
      );
    assert(stakeAuthorizationRecordData === null);
  });
});
