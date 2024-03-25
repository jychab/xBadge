use anchor_lang::error_code;

#[error_code]
pub enum CustomError {
    #[msg("Signer is not a verified creator or update authority of the Nft")]
    AuthorityMismatch,
    #[msg("Metadata does not belong to Mint")]
    MintMetadataMismatch,
    #[msg("Mint is not a collection Nft")]
    NotCollectionNft,
    #[msg("Mint does not have a collection")]
    NoCollectionFound,
    #[msg("Collection does not match given stake pool")]
    StakePoolMismatch,
    #[msg("Unable to deauthorize mint because mint is still staked")]
    MintIsStillStaked,
}
