use anchor_lang::error_code;

#[error_code]
pub enum CustomError {
    #[msg("Signer is not one of the verified creator for the collection")]
    AuthorityMismatch,
    #[msg("Metadata does not belong to Mint")]
    MintMetadataMismatch,
    #[msg("Collection Mint is not a collection nft")]
    NotCollectionNft,
    #[msg("Mint does not have a collection")]
    NoCollectionFound,
    #[msg("Badge collection does not match given stake pool")]
    StakePoolMismatch,
}
