import { decodeVecRecord, encodeArgs, query as boundaryQuery, update as boundaryUpdate } from '@thebes/sdk';

export const BACKEND_CANISTER_ID = 92459100095509;

export type Note = { id: bigint; title: string; content: string };

export function encodeNoteArgs(token: string, ...values: unknown[]): string {
  return encodeArgs([token, ...values]);
}

export async function list(token: string): Promise<Note[]> {
  const response = await boundaryQuery(BACKEND_CANISTER_ID, 'list', encodeNoteArgs(token));
  if (response.status !== 'success' || !response.reply_hex) throw new Error(response.error || 'Unable to load notes.');
  return decodeVecRecord(response.reply_hex, [
    { name: 'id', type: 'nat' },
    { name: 'title', type: 'text' },
    { name: 'content', type: 'text' },
  ]) as Note[];
}

export async function add(token: string, title: string, content: string): Promise<bigint> {
  const response = await boundaryUpdate(BACKEND_CANISTER_ID, 'add', encodeNoteArgs(token, title, content));
  if (response.status !== 'success' || !response.reply_hex) throw new Error(response.error || 'Unable to save note.');
  const [note] = decodeVecRecord(response.reply_hex, [{ name: 'id', type: 'nat' }]);
  return note?.id as bigint;
}

export async function edit(token: string, id: bigint, title: string, content: string): Promise<boolean> {
  const response = await boundaryUpdate(BACKEND_CANISTER_ID, 'edit', encodeNoteArgs(token, id, title, content));
  if (response.status !== 'success' || !response.reply_hex) throw new Error(response.error || 'Unable to update note.');
  return response.reply_hex.length > 0;
}

export async function remove(token: string, id: bigint): Promise<boolean> {
  const response = await boundaryUpdate(BACKEND_CANISTER_ID, 'remove', encodeNoteArgs(token, id));
  if (response.status !== 'success' || !response.reply_hex) throw new Error(response.error || 'Unable to delete note.');
  return response.reply_hex.length > 0;
}

export { encodeArgs };
