import { XBadge } from "../target/types/x_badge";
import {
  MPL_TOKEN_METADATA_PROGRAM_ID,
  TokenStandard,
  createNft,
  createV1,
  fetchDigitalAssetWithAssociatedToken,
  findMasterEditionPda,
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
import spl, { createMint, freezeAccount } from "@solana/spl-token";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { BN, Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import {
  IDL as CardinalStakePoolIdl,
  CardinalStakePool,
} from "../deps/soulbound/deps/cardinal-staking/target/types/cardinal_stake_pool";
import {
  IDL as CardinalRewardDistributorIdl,
  CardinalRewardDistributor,
} from "../deps/soulbound/deps/cardinal-staking/target/types/cardinal_reward_distributor";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  fromWeb3JsPublicKey,
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
import {
  TOKEN_METADATA_PROGRAM_ID,
  AUTHORIZATION_RULES,
  AUTHORIZATION_RULES_PROGRAM_ID,
  getStakeSeed,
} from "../deps/soulbound/tests/utils";

describe("XBadge", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  //
  // Program APIs.
  //
  const CARDINAL_STAKE_POOL_PROGRAM_ID = new PublicKey(
    "2gvBmibwtBnbkLExmgsijKy6hGXJneou8X6hkyWQvYnF"
  );

  // const CARDINAL_REWARD_DISTRIBUTOR_PROGRAM_ID = new PublicKey(
  //   "H2yQahQ7eQH8HXXPtJSJn8MURRFEWVesTd8PsracXp1S"
  // );
  const program = anchor.workspace.XBadge as Program<XBadge>;

  // const rewardDistributorProgram = new Program<CardinalRewardDistributor>(
  //   CardinalRewardDistributorIdl,
  //   CARDINAL_REWARD_DISTRIBUTOR_PROGRAM_ID
  // );

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
  let badgeAddress: KeypairSigner["publicKey"];
  let stakePoolId;
  let collectionStakePoolPdaAuthority;

  //
  // Mint for the gold point system.
  //
  // let goldMint: PublicKey;

  //
  // NFTs. These are the two mad lads for the tests.
  //
  let nftA: {
    mintAddress: PublicKey;
    masterEditionAddress: PublicKey;
    metadataAddress: PublicKey;
  };
  let nftB: {
    mintAddress: PublicKey;
    masterEditionAddress: PublicKey;
    metadataAddress: PublicKey;
  };
  let collection: {
    mintAddress: PublicKey;
    masterEditionAddress: PublicKey;
    metadataAddress: PublicKey;
  };

  //
  // Misc accounts used across tests.
  //
  // let sba: PublicKey; // Soulbound Authority.
  // let rewardDistributor: PublicKey;

  // step("Setup: creates the gold mint", async () => {
  //   await umi.rpc.airdrop(signer.publicKey, sol(10));
  //   const goldMintKeypair = Keypair.generate();
  //   goldMint = goldMintKeypair.publicKey;

  //   console.log("ARMANI GOLD MINT", goldMint.toString());

  //   await createMint(
  //     program.provider.connection,
  //     toWeb3JsKeypair(signer),
  //     toWeb3JsPublicKey(signer.publicKey),
  //     toWeb3JsPublicKey(signer.publicKey),
  //     0,
  //     goldMintKeypair
  //   );
  // });

  step(
    "Setup: creates two nfts, verified as part of the same collection",
    async () => {
      let madLadCollection = generateSigner(umi);
      await createNft(umi, {
        tokenOwner: signer.publicKey,
        mint: madLadCollection,
        name: "My SFT Collection",
        uri: "https://example.com/my-collection.json",
        sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
        creators: [{ address: signer.publicKey, verified: true, share: 100 }],
        isCollection: true,
      }).sendAndConfirm(umi);
      collection = {
        mintAddress: toWeb3JsPublicKey(madLadCollection.publicKey),
        masterEditionAddress: toWeb3JsPublicKey(
          findMasterEditionPda(umi, {
            mint: madLadCollection.publicKey,
          })[0]
        ),
        metadataAddress: toWeb3JsPublicKey(
          findMetadataPda(umi, {
            mint: madLadCollection.publicKey,
          })[0]
        ),
      };
      let madlad1 = generateSigner(umi);
      await createNft(umi, {
        tokenOwner: signer.publicKey,
        mint: madlad1,
        name: "My Digital Collectible",
        uri: "https://arweave.net/my-content-hash",
        sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
        isMutable: true,
        collection: {
          key: madLadCollection.publicKey,
          verified: false,
        },
        ruleSet: fromWeb3JsPublicKey(AUTHORIZATION_RULES),
      }).sendAndConfirm(umi);
      nftA = {
        mintAddress: toWeb3JsPublicKey(madlad1.publicKey),
        masterEditionAddress: toWeb3JsPublicKey(
          findMasterEditionPda(umi, {
            mint: madlad1.publicKey,
          })[0]
        ),
        metadataAddress: toWeb3JsPublicKey(
          findMetadataPda(umi, {
            mint: madlad1.publicKey,
          })[0]
        ),
      };
      let madlad2 = generateSigner(umi);
      await createNft(umi, {
        tokenOwner: signer.publicKey,
        mint: madlad2,
        name: "My Digital Collectible",
        uri: "https://arweave.net/my-content-hash",
        sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
        collection: {
          key: madLadCollection.publicKey,
          verified: false,
        },
        isMutable: true,
        ruleSet: fromWeb3JsPublicKey(AUTHORIZATION_RULES),
      }).sendAndConfirm(umi);
      nftB = {
        mintAddress: toWeb3JsPublicKey(madlad2.publicKey),
        masterEditionAddress: toWeb3JsPublicKey(
          findMasterEditionPda(umi, {
            mint: madlad2.publicKey,
          })[0]
        ),
        metadataAddress: toWeb3JsPublicKey(
          findMetadataPda(umi, {
            mint: madlad2.publicKey,
          })[0]
        ),
      };
      await verifyCollectionV1(umi, {
        metadata: findMetadataPda(umi, { mint: madlad1.publicKey }),
        collectionMint: madLadCollection.publicKey,
        authority: umi.payer,
      }).sendAndConfirm(umi);
      await verifyCollectionV1(umi, {
        metadata: findMetadataPda(umi, { mint: madlad2.publicKey }),
        collectionMint: madLadCollection.publicKey,
        authority: umi.payer,
      }).sendAndConfirm(umi);
    }
  );

  step("Create a colletion nft & mint fungible badge", async () => {
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
    [stakePoolId] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake-pool"), identifier.toArrayLike(Buffer, "le", 8)],
      stakePoolProgram.programId
    );

    [collectionStakePoolPdaAuthority] = PublicKey.findProgramAddressSync(
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
      [Buffer.from("vault-authority"), nftA.mintAddress.toBuffer()],
      program.programId
    );
    [collectionStakePoolPdaAuthority] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("collection-stake-pool"),
        toWeb3JsPublicKey(collectionMintAddress).toBuffer(),
      ],
      program.programId
    );
    stakePoolId = (
      await program.account.collectionStakePoolPdaAuthorityAccount.fetch(
        collectionStakePoolPdaAuthority
      )
    ).stakePool;
    const [stakeAuthorizationRecord] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("stake-authorization"),
        stakePoolId.toBuffer(),
        nftA.mintAddress.toBuffer(),
      ],
      stakePoolProgram.programId
    );
    const mintPayerAta = await fetchDigitalAssetWithAssociatedToken(
      umi,
      fromWeb3JsPublicKey(nftA.mintAddress),
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
        nftA.mintAddress.toBase58(),
      "Invalid mint on authorization record"
    );
    assert(
      stakeAuthorizationRecordData.pool.toBase58() === stakePoolId.toBase58(),
      "Invalid stake pool id on authorization record"
    );
  });

  // step("Stake NftA Token", async () => {
  //   const stakeEntry = PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("stake-entry"),
  //       stakePoolId.toBuffer(),
  //       nftA.mintAddress.toBuffer(),
  //       getStakeSeed(1, toWeb3JsPublicKey(signer.publicKey)).toBuffer(),
  //     ],
  //     stakePoolProgram.programId
  //   )[0];
  //   const rewardEntry = PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("reward-entry"),
  //       rewardDistributor.toBuffer(),
  //       stakeEntry.toBuffer(),
  //     ],
  //     rewardDistributorProgram.programId
  //   )[0];
  //   const ata = await anchor.utils.token.associatedAddress({
  //     mint: nftA.mintAddress,
  //     owner: toWeb3JsPublicKey(signer.publicKey),
  //   });
  //   const tokenRecord = PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("metadata"),
  //       TOKEN_METADATA_PROGRAM_ID.toBuffer(),
  //       nftA.mintAddress.toBuffer(),
  //       Buffer.from("token_record"),
  //       ata.toBuffer(),
  //     ],
  //     TOKEN_METADATA_PROGRAM_ID
  //   )[0];
  //   return await stakePoolProgram.methods
  //     .stakeProgrammable(new anchor.BN(1))
  //     .accounts({
  //       stakeEntry,
  //       rewardEntry,
  //       rewardDistributor,
  //       stakePool: stakePoolId,
  //       originalMint: nftA.mintAddress,
  //       user: signer.publicKey,
  //       userOriginalMintTokenAccount: ata,
  //       userOriginalMintTokenRecord: tokenRecord,
  //       mintMetadata: nftA.metadataAddress,
  //       mintEdition: nftA.masterEditionAddress,
  //       authorizationRules: AUTHORIZATION_RULES,
  //       sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //       authorizationRulesProgram: AUTHORIZATION_RULES_PROGRAM_ID,
  //       rewardDistributorProgram: rewardDistributorProgram.programId,
  //       systemProgram: SystemProgram.programId,
  //     })
  //     .preInstructions([
  //       ComputeBudgetProgram.setComputeUnitLimit({
  //         units: 1000000,
  //       }),
  //     ])
  //     .rpc({
  //       skipPreflight: true,
  //     });
  // });

  step("Unstake Badge for Deauthorization", async () => {
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault-authority"), nftA.mintAddress.toBuffer()],
      program.programId
    );
    [collectionStakePoolPdaAuthority] = PublicKey.findProgramAddressSync(
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
        nftA.mintAddress.toBuffer(),
      ],
      stakePoolProgram.programId
    );
    const mintPayerAta = await fetchDigitalAssetWithAssociatedToken(
      umi,
      fromWeb3JsPublicKey(nftA.mintAddress),
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
          mint: nftA.mintAddress,
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
