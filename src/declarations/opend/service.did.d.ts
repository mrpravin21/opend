import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface _SERVICE {
  'canMint' : ActorMethod<[], boolean>,
  'completePurchase' : ActorMethod<[Principal, Principal, Principal], string>,
  'getCyclesBalance' : ActorMethod<[], bigint>,
  'getListedNFTPrice' : ActorMethod<[Principal], bigint>,
  'getListedNFTs' : ActorMethod<[], Array<Principal>>,
  'getOpenDCanisterID' : ActorMethod<[], Principal>,
  'getOriginalOwner' : ActorMethod<[Principal], Principal>,
  'getOwnedNFTs' : ActorMethod<[Principal], Array<Principal>>,
  'getRequiredCyclesForMint' : ActorMethod<[], bigint>,
  'isListed' : ActorMethod<[Principal], boolean>,
  'listItem' : ActorMethod<[Principal, bigint], string>,
  'mint' : ActorMethod<[Uint8Array | number[], string], Principal>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
