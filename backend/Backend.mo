import Array "mo:core/Array";
import Principal "mo:core/Principal";

persistent actor Backend {
  type Note = { id : Nat; title : Text; content : Text };
  type StoredNote = { owner : Principal; note : Note };

  var notes : [StoredNote] = [];
  var nextId : Nat = 0;

  public shared ({ caller }) func add(title : Text, content : Text) : async Nat {
    let id = nextId;
    notes := Array.concat(notes, [{ owner = caller; note = { id; title; content } }]);
    nextId += 1;
    id
  };

  public shared ({ caller }) func list() : async [Note] {
    Array.map(
      Array.filter(notes, func(stored : StoredNote) : Bool { stored.owner == caller }),
      func(stored : StoredNote) : Note { stored.note },
    )
  };

  public shared ({ caller }) func edit(id : Nat, title : Text, content : Text) : async Bool {
    var found = false;
    notes := Array.map(notes, func(stored : StoredNote) : StoredNote {
      if (stored.owner == caller and stored.note.id == id) {
        found := true;
        { owner = caller; note = { id; title; content } }
      } else stored
    });
    found
  };

  public shared ({ caller }) func remove(id : Nat) : async Bool {
    var removed = false;
    notes := Array.filter(notes, func(stored : StoredNote) : Bool {
      if (stored.owner == caller and stored.note.id == id) {
        removed := true;
        false
      } else true
    });
    removed
  };
};
