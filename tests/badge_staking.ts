import { BadgeStaking } from "../target/types/badge_staking";
import {
  MPL_TOKEN_METADATA_PROGRAM_ID,
  createNft,
  fetchDigitalAssetWithAssociatedToken,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import {
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
import { stakePool } from "../deps/cardinal-staking/src";

describe("badge_staking", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  // Managed Token Semifungible token creation
  // const prod = false;
  // const underdogApiEndpoint = prod
  //   ? "https://mainnet.underdogprotocol.com/v2"
  //   : "https://devnet.underdogprotocol.com/v2";
  // const underdogApiKey = "9c8ee3b29c0286.25ad082a2c1d4d5485c37020dd79ae7b";
  // const underdogConfig = {
  //   headers: {
  //     Authorization: `Bearer ${underdogApiKey}`,
  //   },
  // };

  //
  // Program APIs.
  //
  const CARDINAL_STAKE_POOL_PROGRAM_ID = new PublicKey(
    "2gvBmibwtBnbkLExmgsijKy6hGXJneou8X6hkyWQvYnF"
  );
  const program = anchor.workspace.BadgeStaking as Program<BadgeStaking>;

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

  let collectionMintAddress;
  before("Create a colletion nft", async () => {
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
  });

  it("Create a collection nft & Initialize a stake pool", async () => {
    const [collectionMetadataAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        toWeb3JsPublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBuffer(),
        new PublicKey(collectionMintAddress).toBuffer(),
      ],
      toWeb3JsPublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)
    );

    const identifierId = PublicKey.findProgramAddressSync(
      [Buffer.from("identifier")],
      stakePoolProgram.programId
    )[0];
    const identifierData =
      await stakePoolProgram.account.identifier.fetchNullable(identifierId);

    const identifier =
      identifierData !== null ? identifierData.count : new anchor.BN(1);

    const transaction = new Transaction();
    if (!identifierData) {
      const ix = await stakePoolProgram.methods
        .initIdentifier()
        .accounts({
          identifier: identifierId,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([toWeb3JsKeypair(signer)])
        .instruction();
      transaction.add(ix);
    }

    const stakePoolId = PublicKey.findProgramAddressSync(
      [Buffer.from("stake-pool"), identifier.toArrayLike(Buffer, "le", 8)],
      stakePoolProgram.programId
    )[0];

    const [collectionStakePoolPdaAuthority] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("collection-stake-pool"),
        toWeb3JsPublicKey(collectionMintAddress).toBuffer(),
        stakePoolId.toBuffer(),
      ],
      program.programId
    );

    const collectionPayerAta = await fetchDigitalAssetWithAssociatedToken(
      umi,
      collectionMintAddress,
      signer.publicKey
    );

    transaction.add(
      await program.methods
        .initialize({
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
        .instruction()
    );
    try {
      await program.provider.sendAndConfirm(transaction, [
        toWeb3JsKeypair(signer),
      ]);
    } catch (e) {
      console.log(e);
    }

    const collectionStakePoolAccount =
      await program.account.collectionStakePoolAccount.fetch(
        collectionStakePoolPdaAuthority
      );
    console.log(collectionStakePoolAccount);
    const stakeAccountData = await stakePoolProgram.account.stakePool.fetch(
      stakePoolId
    );
    console.log(stakeAccountData);
  });
});
