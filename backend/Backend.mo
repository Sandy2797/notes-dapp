import Array "mo:core/Array";

persistent actor Backend {

  type Note = {
    id : Nat;
    title : Text;
    content : Text;
  };

  var notes : [Note] = [];
  var nextId : Nat = 0;

  public func add(title : Text, content : Text) : async Nat {
    let id = nextId;

    let note : Note = {
      id = id;
      title = title;
      content = content;
    };

    notes := Array.concat(notes, [note]);
    nextId += 1;

    id
  };

  public query func list() : async [Note] {
    notes
  };

  public func edit(id : Nat, title : Text, content : Text) : async Bool {
    var found = false;

    notes := Array.map(
      notes,
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

    found
  };

  public func remove(id : Nat) : async Bool {
    let oldLength = notes.size();

    notes := Array.filter(
      notes,
      func(note : Note) : Bool {
        note.id != id
      },
    );

    notes.size() < oldLength
  };
};
