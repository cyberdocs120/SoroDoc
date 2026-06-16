#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, log};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Allowance(Address, Address),
    Balance(Address),
    Nonce(Address),
    State(Address),
    Admin,
}

#[contract]
pub struct Token;

#[contractimpl]
impl Token {
    /// Initialize the token contract with an administrator and metadata.
    /// 
    /// @sorodoc:category Admin
    /// @sorodoc:since v0.1.0
    pub fn initialize(e: Env, admin: Address, decimal: u32, name: Symbol, symbol: Symbol) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized")
        }
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&symbol_short!("decimal"), &decimal);
        e.storage().instance().set(&symbol_short!("name"), &name);
        e.storage().instance().set(&symbol_short!("symbol"), &symbol);
    }

    /// Transfer tokens from one account to another.
    /// 
    /// @sorodoc:example-highlight
    pub fn transfer(e: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        
        let mut balance_from = Self::balance(e.clone(), from.clone());
        if balance_from < amount {
            panic!("insufficient balance")
        }
        
        balance_from -= amount;
        let mut balance_to = Self::balance(e.clone(), to.clone());
        balance_to += amount;
        
        e.storage().persistent().set(&DataKey::Balance(from), &balance_from);
        e.storage().persistent().set(&DataKey::Balance(to), &balance_to);
        
        log!(&e, "transfer {} from {} to {}", amount, from, to);
    }

    /// Get the balance of an account.
    pub fn balance(e: Env, id: Address) -> i128 {
        e.storage().persistent().get(&DataKey::Balance(id)).unwrap_or(0)
    }

    /// Burn tokens from an account.
    /// 
    /// @sorodoc:category Admin
    pub fn burn(e: Env, from: Address, amount: i128) {
        from.require_auth();
        let mut balance = Self::balance(e.clone(), from.clone());
        if balance < amount {
            panic!("insufficient balance")
        }
        balance -= amount;
        e.storage().persistent().set(&DataKey::Balance(from), &balance);
    }
}
