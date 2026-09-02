import Array "mo:core/Array";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import MemphisAuth "mo:thebes-lib/MemphisAuth";

persistent actor Backend {

  // =========================================================
  // TASK 2 — PRIVATE NOTES
  // =========================================================

  public type Note = {
    id : Nat;
    title : Text;
    body : Text;
  };

  type OwnedNote = {
    owner : Text;
    note : Note;
  };

  // Kept for stable-upgrade compatibility with Task 1.
  var notes : [Note] = [];

  var nextId : Nat = 1;

  // Existing Task 2 private notes.
  var privateNotes : [OwnedNote] = [];

  // =========================================================
  // TASK 2 — MEMPHIS AUTH
  //
  // DO NOT CHANGE THE ORIGIN/NAMESPACE OR VERSION.
  // Existing user principals depend on these exact values.
  // =========================================================

  var gate = MemphisAuth.initFromCid(
    921,
    "notes-dapp-task1",
    1
  );

  let AUDIENCE =
    "https://memphis.mercaturaforum.com";

  func authenticatedPrincipal(
    session : Blob
  ) : async* Principal {
    switch (
      await* MemphisAuth.verifyWithAudience(
        gate,
        session,
        AUDIENCE
      )
    ) {
      case (#ok(identity)) {
        identity.principal
      };

      case (#err(_)) {
        Runtime.trap(
          "Unauthorized Memphis session"
        )
      };
    }
  };

  func authenticatedOwner(
    session : Blob
  ) : async* Text {
    let principal =
      await* authenticatedPrincipal(session);

    Principal.toText(principal)
  };

  // =========================================================
  // TASK 3 — PUBLIC SHARING
  // =========================================================

  public type FeedNote = {
    id : Nat;
    title : Text;
    body : Text;
    author : Principal;
  };

  // A note ID is globally unique, so storing the shared IDs is
  // enough. The note itself remains in privateNotes.
  var sharedNoteIds : [Nat] = [];

  func isShared(id : Nat) : Bool {
    var found = false;

    for (sharedId in sharedNoteIds.values()) {
      if (sharedId == id) {
        found := true;
      };
    };

    found
  };

  func addSharedId(id : Nat) {
    if (isShared(id)) {
      return;
    };

    sharedNoteIds := Array.tabulate<Nat>(
      sharedNoteIds.size() + 1,
      func(i : Nat) : Nat {
        if (i < sharedNoteIds.size()) {
          sharedNoteIds[i]
        } else {
          id
        }
      }
    );
  };

  func removeSharedId(id : Nat) {
    sharedNoteIds := Array.filter<Nat>(
      sharedNoteIds,
      func(sharedId : Nat) : Bool {
        sharedId != id
      }
    );
  };

  // =========================================================
  // TASK 3 — POINTS LEDGER
  // =========================================================

  let STARTING_POINTS : Nat = 100;

  public type TokenMetadata = {
    name : Text;
    symbol : Text;
    decimals : Nat8;
    creator : Text;
    totalSupply : Nat;
  };

  let TOKEN_NAME : Text = "Bootcamp Points";
  let TOKEN_SYMBOL : Text = "BCP";
  let TOKEN_DECIMALS : Nat8 = 0;
  let TOKEN_CREATOR : Text =
    "530938912d26c436bc97f488cbac19d13e26d289ca4c1242168a47be02";

  let balances =
    Map.empty<Principal, Nat>();

  let joined =
    Map.empty<Principal, Bool>();

  func ensureJoined(p : Principal) {
    switch (
      Map.get(
        joined,
        Principal.compare,
        p
      )
    ) {
      case (?_) {
        // Already received starting points.
      };

      case null {
        Map.add(
          joined,
          Principal.compare,
          p,
          true
        );

        Map.add(
          balances,
          Principal.compare,
          p,
          STARTING_POINTS
        );
      };
    };
  };

  func balanceOfPrincipal(
    p : Principal
  ) : Nat {
    switch (
      Map.get(
        balances,
        Principal.compare,
        p
      )
    ) {
      case (?balance) {
        balance
      };

      case null {
        0
      };
    }
  };

  // =========================================================
  // TASK 3 — TIP HISTORY
  // =========================================================

  public type TipRecord = {
    from : Principal;
    to : Principal;
    amount : Nat;
    timestamp : Int;
  };

  var tipHistory : [TipRecord] = [];

  func recordTip(
    from : Principal,
    to : Principal,
    amount : Nat
  ) {
    let record : TipRecord = {
      from;
      to;
      amount;
      timestamp = Time.now();
    };

    tipHistory := Array.tabulate<TipRecord>(
      tipHistory.size() + 1,
      func(i : Nat) : TipRecord {
        if (i < tipHistory.size()) {
          tipHistory[i]
        } else {
          record
        }
      }
    );
  };

  // =========================================================
  // PRIVATE NOTE CRUD
  // =========================================================

  public func createNote(
    session : Blob,
    title : Text,
    body : Text
  ) : async Note {

    let principal =
      await* authenticatedPrincipal(session);

    ensureJoined(principal);

    let owner = Principal.toText(principal);

    let note : Note = {
      id = nextId;
      title;
      body;
    };

    let owned : OwnedNote = {
      owner;
      note;
    };

    privateNotes := Array.tabulate<OwnedNote>(
      privateNotes.size() + 1,
      func(i : Nat) {
        if (i < privateNotes.size()) {
          privateNotes[i]
        } else {
          owned
        }
      }
    );

    nextId += 1;

    note
  };

  // Intentionally UPDATE because Memphis verification performs
  // contract-to-contract update calls.
  public func listNotes(
    session : Blob
  ) : async [Note] {

    let principal =
      await* authenticatedPrincipal(session);

    ensureJoined(principal);

    let owner = Principal.toText(principal);

    let mine = Array.filter<OwnedNote>(
      privateNotes,
      func(item : OwnedNote) : Bool {
        item.owner == owner
      }
    );

    Array.map<OwnedNote, Note>(
      mine,
      func(item : OwnedNote) : Note {
        item.note
      }
    )
  };

  public func updateNote(
    session : Blob,
    id : Nat,
    title : Text,
    body : Text
  ) : async Bool {

    let owner =
      await* authenticatedOwner(session);

    var found = false;

    privateNotes := Array.tabulate<OwnedNote>(
      privateNotes.size(),
      func(i : Nat) {
        let item = privateNotes[i];

        if (
          item.owner == owner and
          item.note.id == id
        ) {
          found := true;

          {
            owner = item.owner;
            note = {
              id = item.note.id;
              title;
              body;
            };
          }
        } else {
          item
        }
      }
    );

    found
  };

  public func deleteNote(
    session : Blob,
    id : Nat
  ) : async Bool {

    let owner =
      await* authenticatedOwner(session);

    let filtered = Array.filter<OwnedNote>(
      privateNotes,
      func(item : OwnedNote) : Bool {
        not (
          item.owner == owner and
          item.note.id == id
        )
      }
    );

    let deleted =
      filtered.size() != privateNotes.size();

    privateNotes := filtered;

    if (deleted) {
      removeSharedId(id);
    };

    deleted
  };

  // =========================================================
  // SHARE / UNSHARE
  // =========================================================

  public func shareNote(
    session : Blob,
    id : Nat
  ) : async Bool {

    let principal =
      await* authenticatedPrincipal(session);

    ensureJoined(principal);

    let owner =
      Principal.toText(principal);

    var ownsNote = false;

    for (item in privateNotes.values()) {
      if (
        item.owner == owner and
        item.note.id == id
      ) {
        ownsNote := true;
      };
    };

    if (not ownsNote) {
      return false;
    };

    addSharedId(id);

    true
  };

  public func unshareNote(
    session : Blob,
    id : Nat
  ) : async Bool {

    let principal =
      await* authenticatedPrincipal(session);

    ensureJoined(principal);

    let owner =
      Principal.toText(principal);

    var ownsNote = false;

    for (item in privateNotes.values()) {
      if (
        item.owner == owner and
        item.note.id == id
      ) {
        ownsNote := true;
      };
    };

    if (not ownsNote) {
      return false;
    };

    removeSharedId(id);

    true
  };

  public query func feedView()
    : async [FeedNote] {

    var feed : [FeedNote] = [];

    for (item in privateNotes.values()) {
      if (isShared(item.note.id)) {

        let feedItem : FeedNote = {
          id = item.note.id;
          title = item.note.title;
          body = item.note.body;
          author =
            Principal.fromText(item.owner);
        };

        feed := Array.tabulate<FeedNote>(
          feed.size() + 1,
          func(i : Nat) : FeedNote {
            if (i < feed.size()) {
              feed[i]
            } else {
              feedItem
            }
          }
        );
      };
    };

    feed
  };

  // =========================================================
  // BALANCE
  // =========================================================

  public func myBalance(
    session : Blob
  ) : async Nat {

    let principal =
      await* authenticatedPrincipal(session);

    ensureJoined(principal);

    balanceOfPrincipal(principal)
  };

  // =========================================================
  // TIP
  // =========================================================

  public func tip(
    session : Blob,
    to : Principal,
    amount : Nat
  ) : async Result.Result<(), Text> {

    let from =
      await* authenticatedPrincipal(session);

    ensureJoined(from);

    if (Principal.equal(from, to)) {
      return #err(
        "You cannot tip yourself"
      );
    };

    if (amount == 0) {
      return #err(
        "Tip amount must be greater than zero"
      );
    };

    let fromBalance =
      balanceOfPrincipal(from);

    if (fromBalance < amount) {
      return #err(
        "Not enough points"
      );
    };

    // A recipient becomes a ledger member when they first
    // participate in the points system.
    ensureJoined(to);

    let toBalance =
      balanceOfPrincipal(to);

    let remainingBalance =
      if (amount <= fromBalance) {
        fromBalance - amount
      } else {
        0
      };

    Map.add(
      balances,
      Principal.compare,
      from,
      remainingBalance
    );

    Map.add(
      balances,
      Principal.compare,
      to,
      toBalance + amount
    );

    recordTip(
      from,
      to,
      amount
    );

    #ok(())
  };

  // =========================================================
  // PUBLIC TIP HISTORY
  // =========================================================

  public query func tipHistoryView()
    : async [TipRecord] {
    tipHistory
  };

  // =========================================================
  // BONUS — LEDGER SEAL
  // =========================================================

  public type Seal = {
    members : Nat;
    circulation : Nat;
    expected : Nat;
    consistent : Bool;
  };

  public query func tokenMetadataView()
    : async TokenMetadata {

    let members =
      Map.size(joined);

    {
      name = TOKEN_NAME;
      symbol = TOKEN_SYMBOL;
      decimals = TOKEN_DECIMALS;
      creator = TOKEN_CREATOR;
      totalSupply =
        members * STARTING_POINTS;
    }
  };

  public query func ledgerSealView()
    : async Seal {

    var circulation : Nat = 0;

    for ((_, balance) in Map.entries(balances)) {
      circulation += balance;
    };

    let members =
      Map.size(joined);

    let expected =
      members * STARTING_POINTS;

    {
      members;
      circulation;
      expected;
      consistent =
        circulation == expected;
    }
  };
};
