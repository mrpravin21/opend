import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Debug "mo:base/Debug";
import Iter "mo:base/Iter";
import List "mo:base/List";
import Time "mo:base/Time";
import Array "mo:base/Array";
import Text "mo:base/Text";

persistent actor Token {

  private transient let owner : Principal = Principal.fromText("hi2ea-dyiq5-v36f2-a7hiy-r7uqb-jbq5d-tn5a4-2rqpw-tuxhh-sdr7v-lqe");
  private transient let totalSupply : Nat = 1000000000;
  private transient let symbol : Text = "DANGs";

  private type Transaction = {
    id: Nat;
    timestamp: Int;
    amount: Nat;
    from: Principal;
    to: Principal;
    description: Text;
  };

  private var balanceEntries : [(Principal, Nat)] = [];
  private transient var balances = HashMap.HashMap<Principal, Nat>(1, Principal.equal, Principal.hash);
  if (balances.size() < 1) {
    balances.put(owner, totalSupply);
  };

  private var transactionEntries : [(Principal, [Transaction])] = [];
  private transient var transactions = HashMap.HashMap<Principal, List.List<Transaction>>(1, Principal.equal, Principal.hash);
  private var nextTransactionId : Nat = 0;
    
  public query func balanceOf(who: Principal) : async Nat {

    let balance : Nat = switch (balances.get(who)) {
      case null 0;
      case (?result) result;
    };

    return balance;
  };

  public query func getSymbol() : async Text {
    return symbol;
  };

  private func addTransaction(from: Principal, to: Principal, amount: Nat, description: Text) {
    let transactionId = nextTransactionId;
    nextTransactionId += 1;
    let now = Time.now();
    
    // Add to recipient's transactions (credit) - seller sees "Amount credited for NFT sold to <buyer>"
    var recipientTransactions = switch (transactions.get(to)) {
      case null List.nil<Transaction>();
      case (?result) result;
    };
    // Helper function to check if description starts with a prefix
    func startsWith(text: Text, prefix: Text): Bool {
      if (Text.size(text) < Text.size(prefix)) {
        return false;
      };
      // Convert both to arrays and compare first characters
      let textChars = Iter.toArray(Text.toIter(text));
      let prefixChars = Iter.toArray(Text.toIter(prefix));
      if (textChars.size() < prefixChars.size()) {
        return false;
      };
      var matches = true;
      var i = 0;
      for (prefixChar in prefixChars.vals()) {
        if (i >= textChars.size() or textChars[i] != prefixChar) {
          matches := false;
        };
        i += 1;
      };
      return matches;
    };
    
    // Check if this is a quiz reward (from owner, description starts with "Quiz reward")
    let isQuizReward = Principal.equal(from, owner) and 
                       description != "Tokens claimed from faucet" and
                       startsWith(description, "Quiz reward");
    
    let creditDescription = if (Principal.equal(from, owner) and description == "Tokens claimed from faucet") {
      description
    } else if (isQuizReward) {
      "Tokens earned from quiz"
    } else {
      "Amount credited for NFT sold to " # Principal.toText(from)
    };
    let creditTransaction : Transaction = {
      id = transactionId;
      timestamp = now;
      amount = amount;
      from = from;
      to = to;
      description = creditDescription;
    };
    recipientTransactions := List.push(creditTransaction, recipientTransactions);
    transactions.put(to, recipientTransactions);
    
    // Add to sender's transactions (debit) if different from recipient
    if (not Principal.equal(from, to)) {
      var senderTransactions = switch (transactions.get(from)) {
        case null List.nil<Transaction>();
        case (?result) result;
      };
      let debitDescription = if (Principal.equal(from, owner) and description == "Tokens claimed from faucet") {
        description
      } else if (description == "Token transfer") {
        "Amount debited for token transfer to " # Principal.toText(to)
      } else {
        "Amount debited for " # description
      };
      let debitTransaction : Transaction = {
        id = transactionId;
        timestamp = now;
        amount = amount;
        from = from;
        to = to;
        description = debitDescription;
      };
      senderTransactions := List.push(debitTransaction, senderTransactions);
      transactions.put(from, senderTransactions);
    };
  };

  public shared(msg) func payOut() : async Text {
    Debug.print(debug_show(msg.caller));
    if (balances.get(msg.caller) == null) {
      let amount = 10000;
      // Transfer from owner's balance (faucet) to the caller
      let ownerBalance = await balanceOf(owner);
      if (ownerBalance >= amount) {
        let newOwnerBalance : Nat = ownerBalance - amount;
        balances.put(owner, newOwnerBalance);
        
        let toBalance = await balanceOf(msg.caller);
        let newToBalance = toBalance + amount;
        balances.put(msg.caller, newToBalance);
        
        addTransaction(owner, msg.caller, amount, "Tokens claimed from faucet");
        
        return "Success";
      } else {
        return "Insufficient Funds"
      }
    } else {
      return "Already Claimed"
    }
  };

  // Reward function for quiz points - transfers tokens from owner's balance
  public shared(msg) func rewardQuiz(amount: Nat) : async Text {
    Debug.print(debug_show(msg.caller));
    let ownerBalance = await balanceOf(owner);
    if (ownerBalance >= amount) {
      let newOwnerBalance : Nat = ownerBalance - amount;
      balances.put(owner, newOwnerBalance);
      
      let toBalance = await balanceOf(msg.caller);
      let newToBalance = toBalance + amount;
      balances.put(msg.caller, newToBalance);
      
      addTransaction(owner, msg.caller, amount, "Quiz reward - " # debug_show(amount) # " points claimed");
      
      return "Success";
    } else {
      return "Insufficient Funds"
    }
  };

  public shared(msg) func transfer(to: Principal, amount: Nat) : async Text {
    let fromBalance = await balanceOf(msg.caller);
    if (fromBalance > amount) {
      let newFromBalance : Nat = fromBalance - amount;
      balances.put(msg.caller, newFromBalance);

      let toBalance = await balanceOf(to);
      let newToBalance = toBalance + amount;
      balances.put(to, newToBalance);

      addTransaction(msg.caller, to, amount, "Token transfer");
      
      return "Success";
    } else {
      return "Insufficient Funds"
    }
  };

  public shared(msg) func transferWithDescription(to: Principal, amount: Nat, description: Text) : async Text {
    let fromBalance = await balanceOf(msg.caller);
    if (fromBalance > amount) {
      let newFromBalance : Nat = fromBalance - amount;
      balances.put(msg.caller, newFromBalance);

      let toBalance = await balanceOf(to);
      let newToBalance = toBalance + amount;
      balances.put(to, newToBalance);

      addTransaction(msg.caller, to, amount, description);
      
      return "Success";
    } else {
      return "Insufficient Funds"
    }
  };

  public query func getTransactions(user: Principal) : async [Transaction] {
    var userTransactions = switch (transactions.get(user)) {
      case null List.nil<Transaction>();
      case (?result) result;
    };
    return List.toArray(userTransactions);
  };

  system func preupgrade() {
    balanceEntries := Iter.toArray(balances.entries());
    var tempEntries : [(Principal, [Transaction])] = [];
    for ((k, v) in transactions.entries()) {
      tempEntries := Array.append(tempEntries, [(k, List.toArray(v))]);
    };
    transactionEntries := tempEntries;
  };

  system func postupgrade() {
    balances := HashMap.fromIter<Principal, Nat>(balanceEntries.vals(), 1, Principal.equal, Principal.hash);
    if (balances.size() < 1) {
      balances.put(owner, totalSupply);
    };
    var tempTransactions = HashMap.HashMap<Principal, List.List<Transaction>>(1, Principal.equal, Principal.hash);
    for ((k, v) in transactionEntries.vals()) {
      tempTransactions.put(k, List.fromArray(v));
    };
    transactions := tempTransactions;
    transactionEntries := [];
  };

};


