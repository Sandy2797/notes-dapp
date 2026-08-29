import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import MemphisAuth "mo:thebes-lib/MemphisAuth";

persistent actor Backend {

  type Note = {
    id : Nat;
    title : Text;
    content : Text;
  };

  type UserNotes = {
    notes : [Note];
    nextId : Nat;
  };

  // Memphis production identity contract.
  // The frontend derives the app principal from location.origin,
  // which is https://memphis.mercaturaforum.com on the deployed gateway.
  var gate = MemphisAuth.initFromCid(
    921,
    "https://memphis.mercaturaforum.com",
    0,
  );

  // Principal -> that user's notes.
  var users : Map.Map<Principal, UserNotes> =
    Map.empty<Principal, UserNotes>();

  func authenticate(token : Blob) : async Result.Result<Principal, Text> {
    switch (await MemphisAuth.verify(gate, token)) {
      case (#ok(identity)) {
        #ok(identity.principal)
      };
      case (#err(error)) {
        #err(debug_show (error))
      };
    }
  };

  public func add(
    token : Blob,
    title : Text,
    content : Text,
  ) : async Result.Result<Nat, Text> {

    switch (await authenticate(token)) {
      case (#err(error)) {
        #err(error)
      };

      case (#ok(principal)) {
        switch (Map.get(users, Principal.compare, principal)) {
          case null {
            let note : Note = {
              id = 0;
              title = title;
              content = content;
            };

            Map.add(
              users,
              Principal.compare,
              principal,
              {
                notes = [note];
                nextId = 1;
              },
            );

            #ok(0)
          };

          case (?user) {
            let id = user.nextId;

            let note : Note = {
              id = id;
              title = title;
              content = content;
            };

            Map.add(
              users,
              Principal.compare,
              principal,
              {
                notes = Array.concat(user.notes, [note]);
                nextId = id + 1;
              },
            );

            #ok(id)
          };
        };
      };
    };
  };

  // IMPORTANT:
  // This is intentionally NOT a query.
  // Authentication requires an inter-canister call to Memphis.
  public func list(
    token : Blob,
  ) : async Result.Result<[Note], Text> {

    switch (await authenticate(token)) {
      case (#err(error)) {
        #err(error)
      };

      case (#ok(principal)) {
        switch (Map.get(users, Principal.compare, principal)) {
          case null {
            #ok([])
          };

          case (?user) {
            #ok(user.notes)
          };
        };
      };
    };
  };

  public func edit(
    token : Blob,
    id : Nat,
    title : Text,
    content : Text,
  ) : async Result.Result<Bool, Text> {

    switch (await authenticate(token)) {
      case (#err(error)) {
        #err(error)
      };

      case (#ok(principal)) {
        switch (Map.get(users, Principal.compare, principal)) {
          case null {
            #ok(false)
          };

          case (?user) {
            var found = false;

            let updated = Array.map(
              user.notes,
              func(note : Note) : Note {
                if (note.id == id) {
                  found := true;

                  {
                    id = note.id;
                    title = title;
                    content = content;
                  }
                } else {
                  note
                }
              },
            );

            if (found) {
              Map.add(
                users,
                Principal.compare,
                principal,
                {
                  notes = updated;
                  nextId = user.nextId;
                },
              );
            };

            #ok(found)
          };
        };
      };
    };
  };

  public func remove(
    token : Blob,
    id : Nat,
  ) : async Result.Result<Bool, Text> {

    switch (await authenticate(token)) {
      case (#err(error)) {
        #err(error)
      };

      case (#ok(principal)) {
        switch (Map.get(users, Principal.compare, principal)) {
          case null {
            #ok(false)
          };

          case (?user) {
            let oldLength = user.notes.size();

            let remaining = Array.filter(
              user.notes,
              func(note : Note) : Bool {
                note.id != id
              },
            );

            let found = remaining.size() < oldLength;

            if (found) {
              Map.add(
                users,
                Principal.compare,
                principal,
                {
                  notes = remaining;
                  nextId = user.nextId;
                },
              );
            };

            #ok(found)
          };
        };
      };
    };
  };
};
