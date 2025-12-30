import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface NFT {
  'getAsset' : ActorMethod<[], Uint8Array | number[]>,
  'getCanisterId' : ActorMethod<[], Principal>,
  'getName' : ActorMethod<[], string>,
  'getOwner' : ActorMethod<[], Principal>,
  'transferOwnership' : ActorMethod<[Principal], string>,
}
export interface _SERVICE extends NFT {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
