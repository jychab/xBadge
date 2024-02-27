use anchor_lang::prelude::*;
use mpl_bubblegum::ID;

#[derive(Clone)]
pub struct Bubblegum;

impl anchor_lang::Id for Bubblegum {
    fn id() -> Pubkey {
        ID
    }
}
