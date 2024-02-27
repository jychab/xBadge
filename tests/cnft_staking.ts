import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { CnftStaking } from "../target/types/cnft_staking";
import { Helius } from "helius-sdk";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

export function bufferToArray(buffer: Buffer): number[] {
  const nums = [];
  for (let i = 0; i < buffer.length; i++) {
    nums.push(buffer[i]);
  }
  return nums;
}

describe("cnft_staking", () => {
  const prod = false;
  const heliusApiKey = "67cc99fc-f14e-499c-9507-48127506901f";
  const heliusEndpoint = `https://${
    prod ? "mainnet" : "devnet"
  }.helius-rpc.com/?api-key=${heliusApiKey}`;

  const owner = anchor.web3.Keypair.fromSecretKey(
    Buffer.from([
      225, 66, 240, 160, 100, 176, 216, 156, 98, 248, 136, 34, 108, 179, 97, 33,
      245, 103, 165, 252, 153, 131, 20, 190, 60, 85, 11, 240, 176, 184, 50, 183,
      208, 37, 214, 8, 236, 36, 232, 48, 167, 48, 193, 156, 104, 55, 81, 126,
      209, 94, 147, 84, 22, 209, 65, 127, 206, 246, 2, 145, 207, 168, 186, 29,
    ])
  );
  // Configure the client to use the local cluster.
  anchor.setProvider(
    new anchor.AnchorProvider(
      new anchor.web3.Connection(heliusEndpoint),
      new anchor.Wallet(owner),
      { commitment: "confirmed" }
    )
  );

  const program = anchor.workspace.CnftStaking as Program<CnftStaking>;

  const helius = new Helius(heliusApiKey, "devnet");

  it("Is initialized!", async () => {
    // Add your test here.
    const [newOwner] = anchor.web3.PublicKey.findProgramAddressSync(
      [owner.publicKey.toBuffer()],
      program.programId
    );

    let assetId = "HcuF1qLrQGmCmbnCWDUYh1pjP1kWQ87r9iRZM2dqXTZF";

    const rpcAsset = await helius.rpc.getAsset({ id: assetId });

    let assetProof = await helius.rpc.getAssetProof({
      id: assetId,
    });
    if (!assetProof?.proof || assetProof.proof.length === 0) {
      throw new Error("Proof is empty");
    }
    let proofPath = assetProof.proof.map((node: string) => ({
      pubkey: new anchor.web3.PublicKey(node),
      isSigner: false,
      isWritable: false,
    }));
    console.log("Successfully got proof path from RPC.");

    const leafNonce = rpcAsset.compression.leaf_id;
    const [treeAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
      [new anchor.web3.PublicKey(assetProof.tree_id).toBuffer()],
      new anchor.web3.PublicKey("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY")
    );

    let ix = await program.methods
      .unstake({
        root: bufferToArray(bs58.decode(assetProof.root)),
        dataHash: bufferToArray(
          bs58.decode(rpcAsset.compression.data_hash.trim())
        ),
        creatorHash: bufferToArray(
          bs58.decode(rpcAsset.compression.creator_hash.trim())
        ),
        index: leafNonce,
        nonce: new BN(leafNonce),
      })
      .accounts({
        treeAuthority,
        stakeAccount: newOwner,
        merkleTree: new anchor.web3.PublicKey(assetProof.tree_id),
        logWrapper: new anchor.web3.PublicKey(
          "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
        ),
        compressionProgram: new anchor.web3.PublicKey(
          "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
        ),
        bubblegumProgram: new anchor.web3.PublicKey(
          "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
        ),
      })
      .remainingAccounts(proofPath)
      .signers([owner])
      .rpc({
        skipPreflight: true,
      });
  });
});
