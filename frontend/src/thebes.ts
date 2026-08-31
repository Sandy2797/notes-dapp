import {
  decodeVecRecord,
  encodeArgs,
  identity as boundaryIdentity,
  update as boundaryUpdate,
} from "@thebes/sdk";

export const BACKEND_CANISTER_ID = 92459100095509;

export type Note = { id: bigint; title: string; content: string };

function ensureSuccess(response: { status?: string; reply_hex?: string; error?: string }, fallback: string) {
  if (response.status !== "success" || !response.reply_hex) {
    throw new Error(response.error || fallback);
  }
  return response.reply_hex;
}

export function identity() {
  return boundaryIdentity();
}

export function encodeAdd(title: string, content: string) {
  return encodeArgs([title, content]);
}

export function encodeEdit(id: bigint, title: string, content: string) {
  return encodeArgs([id, title, content]);
}

export function encodeRemove(id: bigint) {
  return encodeArgs([id]);
}

export async function list(): Promise<Note[]> {
  const reply = ensureSuccess(
    await boundaryUpdate(BACKEND_CANISTER_ID, "list", encodeArgs([])),
    "Unable to load notes.",
  );
  return decodeVecRecord(reply, [
    { name: "id", type: "nat" },
    { name: "title", type: "text" },
    { name: "content", type: "text" },
  ]) as Note[];
}

export async function call(method: string, args: string) {
  return ensureSuccess(
    await boundaryUpdate(BACKEND_CANISTER_ID, method, args),
    "The notes operation failed.",
  );
}

export { encodeArgs };
