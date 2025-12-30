export const idlFactory = ({ IDL }) => {
  const Transaction = IDL.Record({
    'id' : IDL.Nat,
    'to' : IDL.Principal,
    'from' : IDL.Principal,
    'description' : IDL.Text,
    'timestamp' : IDL.Int,
    'amount' : IDL.Nat,
  });
  return IDL.Service({
    'balanceOf' : IDL.Func([IDL.Principal], [IDL.Nat], ['query']),
    'getSymbol' : IDL.Func([], [IDL.Text], ['query']),
    'getTransactions' : IDL.Func(
        [IDL.Principal],
        [IDL.Vec(Transaction)],
        ['query'],
      ),
    'payOut' : IDL.Func([], [IDL.Text], []),
    'transfer' : IDL.Func([IDL.Principal, IDL.Nat], [IDL.Text], []),
    'transferWithDescription' : IDL.Func(
        [IDL.Principal, IDL.Nat, IDL.Text],
        [IDL.Text],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
