import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Transaction {
  'id' : bigint,
  'to' : Principal,
  'from' : Principal,
  'description' : string,
  'timestamp' : bigint,
  'amount' : bigint,
}
export interface _SERVICE {
  'balanceOf' : ActorMethod<[Principal], bigint>,
  'getSymbol' : ActorMethod<[], string>,
  'getTransactions' : ActorMethod<[Principal], Array<Transaction>>,
  'payOut' : ActorMethod<[], string>,
  'transfer' : ActorMethod<[Principal, bigint], string>,
  'transferWithDescription' : ActorMethod<[Principal, bigint, string], string>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
