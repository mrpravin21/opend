import Cycles "mo:base/ExperimentalCycles";
import Debug "mo:base/Debug";
import NFTActorClass "../NFT/nft";
import Principal "mo:base/Principal";
import HashMap  "mo:base/HashMap";
import List "mo:base/List";
import Iter "mo:base/Iter";


persistent actor OpenD {

    private type Listing = {
      itemOwner: Principal;
      itemPrice: Nat;
    };

    private transient var mapOfNFTs = HashMap.HashMap<Principal, NFTActorClass.NFT>(1, Principal.equal, Principal.hash);
    private transient var mapOfOwners = HashMap.HashMap<Principal, List.List<Principal>>(1, Principal.equal, Principal.hash);
    private transient var mapOfListings = HashMap.HashMap<Principal, Listing>(1, Principal.equal, Principal.hash);

    public shared(msg) func mint(imgData: [Nat8], name: Text) : async Principal {
      let owner : Principal = msg.caller;

      // Minimum cycles required: 2 trillion for NFT creation + 500 billion buffer
      let requiredCycles : Nat = 2_500_000_000_000;
      let currentBalance = Cycles.balance();
      
      Debug.print(debug_show("Current cycles balance: " # debug_show(currentBalance)));
      Debug.print(debug_show("Required cycles: " # debug_show(requiredCycles)));
      
      if (currentBalance < requiredCycles) {
        Debug.print("Insufficient cycles for minting. Current: " # debug_show(currentBalance) # ", Required: " # debug_show(requiredCycles));
        // Return an error by throwing
        // In Motoko, we use a Result type pattern, but for simplicity, we'll check before adding cycles
        return Principal.fromText("aaaaa-aa"); // Invalid principal as error indicator
      };

      // Add cycles for creating the new NFT canister 
      // Installation fee: 500 billion for 13-node subnets, 1.3 trillion for 34-node subnets
      // Using 2 trillion cycles to ensure enough cycles after installation fee is deducted and for initial operations
      Cycles.add(2_000_000_000_000);
      
      // Check cycles again after adding (they should be available now)
      if (Cycles.balance() < 2_000_000_000_000) {
        Debug.print("Cycles not available after add. Balance: " # debug_show(Cycles.balance()));
        return Principal.fromText("aaaaa-aa"); // Invalid principal as error indicator
      };
      
      let newNFT = await NFTActorClass.NFT(name, owner, imgData);
      Debug.print(debug_show("Cycles balance after minting: " # debug_show(Cycles.balance())));

      let newNFTPrincipal = await newNFT.getCanisterId();

      mapOfNFTs.put(newNFTPrincipal, newNFT);
      addToOwnershipMap(owner, newNFTPrincipal);

      return newNFTPrincipal

    };

    private func addToOwnershipMap(owner: Principal, nftId: Principal) {
        var ownedNFTs : List.List<Principal> = switch (mapOfOwners.get(owner)) {
          case null List.nil<Principal>();
          case (?result) result;
        };

        ownedNFTs := List.push(nftId, ownedNFTs);
        mapOfOwners.put(owner, ownedNFTs);

    };

    public query func getOwnedNFTs(user: Principal) : async [Principal] {
      var userNFTs : List.List<Principal> = switch (mapOfOwners.get(user)) {
        case null List.nil<Principal>();
        case (?result) result;
      };

      return List.toArray(userNFTs);
    };

    public query func getListedNFTs() : async [Principal] {
      let ids = Iter.toArray(mapOfListings.keys());
      return ids;
    };

    public shared(msg) func listItem(id: Principal, price: Nat) : async Text {
      var item : NFTActorClass.NFT = switch (mapOfNFTs.get(id)) {
        case null return "NFT does not exist.";
        case (?result) result;
      };

      let owner = await item.getOwner();
      if (Principal.equal(owner, msg.caller)) {
        let newListing : Listing = {
          itemOwner = owner;
          itemPrice = price;
        };
        mapOfListings.put(id, newListing);
        return "Success";
      } else {
        return "You don't own the NFT."
      }
    };

    public query func getOpenDCanisterID() : async Principal {
      return Principal.fromActor(OpenD);
    };

    public query func getCyclesBalance() : async Nat {
      return Cycles.balance();
    };

    // Check if there are enough cycles to mint a new NFT
    public query func canMint() : async Bool {
      let requiredCycles : Nat = 2_500_000_000_000; // 2 trillion for NFT + 500 billion buffer
      return Cycles.balance() >= requiredCycles;
    };

    // Get the minimum cycles required for minting
    public query func getRequiredCyclesForMint() : async Nat {
      return 2_500_000_000_000; // 2 trillion for NFT + 500 billion buffer
    };

    public query func isListed(id: Principal) : async Bool {
      if (mapOfListings.get(id) == null) {
        return false;
      } else{
        return true;
      }
    };

    public query func getOriginalOwner(id: Principal) : async Principal {
      var listing : Listing = switch (mapOfListings.get(id)) {
        case null return Principal.fromText("");
        case (?result) result;
      };

      return listing.itemOwner;
    };

    public query func getListedNFTPrice(id: Principal) : async Nat {
      var listing : Listing = switch (mapOfListings.get(id)) {
        case null return 0;
        case (?result) result;
      };

      return listing.itemPrice;

    };

    public shared(_msg) func completePurchase(id: Principal, ownerId: Principal, newOwnerId: Principal) : async Text {
      var purchasedNFT : NFTActorClass.NFT = switch (mapOfNFTs.get(id)) {
        case null return "NFT does not exist";
        case (?result) result
      };

      let transferResult = await purchasedNFT.transferOwnership(newOwnerId);
      if (transferResult == "Success") {
        mapOfListings.delete(id);
        var ownedNFTs : List.List<Principal> = switch (mapOfOwners.get(ownerId)) {
          case null List.nil<Principal>();
          case (?result) result;
        };
        ownedNFTs := List.filter(ownedNFTs, func (listItemId: Principal) : Bool {
          return listItemId != id;
        });
        mapOfOwners.put(ownerId, ownedNFTs);

        addToOwnershipMap(newOwnerId, id);
        return "Success";
      } else {
        Debug.print("hello");
        return transferResult;
        
      }
    };
};
