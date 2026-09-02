import { IDL } from "@icp-sdk/core/candid";
import { Principal } from "@icp-sdk/core/principal";

export const BACKEND_CANISTER_ID = 31220421087937;

const BASE = "";

export type Note = {
  id: bigint;
  title: string;
  body: string;
};

export type FeedNote = {
  id: bigint;
  title: string;
  body: string;
  author: string;
};

export type TipRecord = {
  from: string;
  to: string;
  amount: bigint;
  timestamp: bigint;
};

export type LedgerSeal = {
  members: bigint;
  circulation: bigint;
  expected: bigint;
  consistent: boolean;
};

export type TokenMetadata = {
  name: string;
  symbol: string;
  decimals: number;
  creator: string;
  totalSupply: bigint;
};

export type TipResult =
  | { ok: null }
  | { err: string };

const NoteIDL = IDL.Record({
  id: IDL.Nat,
  title: IDL.Text,
  body: IDL.Text,
});

const FeedNoteIDL = IDL.Record({
  id: IDL.Nat,
  title: IDL.Text,
  body: IDL.Text,
  author: IDL.Principal,
});

const TipRecordIDL = IDL.Record({
  from: IDL.Principal,
  to: IDL.Principal,
  amount: IDL.Nat,
  timestamp: IDL.Int,
});

const LedgerSealIDL = IDL.Record({
  members: IDL.Nat,
  circulation: IDL.Nat,
  expected: IDL.Nat,
  consistent: IDL.Bool,
});

const TokenMetadataIDL = IDL.Record({
  name: IDL.Text,
  symbol: IDL.Text,
  decimals: IDL.Nat8,
  creator: IDL.Text,
  totalSupply: IDL.Nat,
});

const TipResultIDL = IDL.Variant({
  ok: IDL.Null,
  err: IDL.Text,
});

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(clean.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

function encode(types: IDL.Type[], values: unknown[]): string {
  return bytesToHex(IDL.encode(types, values));
}

function decode<T>(types: IDL.Type[], hex: string): T {
  const values = IDL.decode(types, hexToBytes(hex));

  if (values.length !== 1) {
    throw new Error(
      `Expected exactly one Candid return value, received ${values.length}`
    );
  }

  return values[0] as T;
}

export function encodeEmpty(): string {
  return encode([], []);
}

function sessionBlob(sessionTokenHex: string): Uint8Array {
  return hexToBytes(sessionTokenHex);
}

export function encodeCreateNote(title: string, body: string): string {
  return encode(
    [IDL.Text, IDL.Text],
    [title, body]
  );
}

export function encodeUpdateNote(
  id: bigint,
  title: string,
  body: string
): string {
  return encode(
    [IDL.Nat, IDL.Text, IDL.Text],
    [id, title, body]
  );
}

export function encodeDeleteNote(id: bigint): string {
  return encode(
    [IDL.Nat],
    [id]
  );
}

export function decodeNote(hex: string): Note {
  return decode<Note>([NoteIDL], hex);
}

export function decodeNotes(hex: string): Note[] {
  return decode<Note[]>([IDL.Vec(NoteIDL)], hex);
}

export function decodeBool(hex: string): boolean {
  return decode<boolean>([IDL.Bool], hex);
}

function demoSender(): string {
  const key = `thebes-demo-sender:${BACKEND_CANISTER_ID}`;

  let sender = localStorage.getItem(key);

  if (!sender) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);

    sender = bytesToHex(bytes);
    localStorage.setItem(key, sender);
  }

  return sender;
}

const RETRIES = 3;

function isTransient(status: number, body: string): boolean {
  return (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /validator unreachable|no healthy validator|unhealthy/i.test(body)
  );
}

async function fetchWithRetry(
  url: string,
  init?: RequestInit
): Promise<any> {
  let lastError = "";

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, 400 * attempt)
      );
    }

    try {
      const response = await fetch(url, init);
      const text = await response.text();

      if (
        !response.ok &&
        isTransient(response.status, text)
      ) {
        lastError =
          `HTTP ${response.status}: ${text.slice(0, 200)}`;
        continue;
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error(
          `Malformed network response: ${text.slice(0, 200)}`
        );
      }
    } catch (error) {
      lastError = String(error);
    }
  }

  throw new Error(
    `The network is briefly unreachable. Please try again. (${lastError})`
  );
}

export async function queryRaw(
  method: string,
  argHex: string
): Promise<string> {
  const response = await fetchWithRetry(
    `${BASE}/api/query`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        canister_id: BACKEND_CANISTER_ID,
        method,
        arg: argHex,
        sender: demoSender(),
      }),
    }
  );

  if (response.status !== "success") {
    throw new Error(
      response.error || `Query "${method}" failed`
    );
  }

  return response.reply || "";
}

async function submitCall(
  method: string,
  argHex: string,
  sender: string,
  nonce: number
): Promise<any> {
  const response = await fetch(
    `${BASE}/api/call`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        canister_id: BACKEND_CANISTER_ID,
        method,
        arg: argHex,
        sender,
        nonce,
      }),
    }
  );

  const text = await response.text();

  if (
    !response.ok &&
    isTransient(response.status, text)
  ) {
    throw new Error(
      "The network is briefly unreachable. Please try again."
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Malformed call response: ${text.slice(0, 200)}`
    );
  }
}

export async function callRaw(
  method: string,
  argHex: string
): Promise<string> {
  const sender = demoSender();

  const nonceReply = await fetchWithRetry(
    `${BASE}/api/next_nonce?sender=${sender}`,
    {
      cache: "no-store",
    }
  );

  if (typeof nonceReply.next_nonce !== "number") {
    throw new Error(
      "Malformed next_nonce response"
    );
  }

  let result = await submitCall(
    method,
    argHex,
    sender,
    nonceReply.next_nonce
  );

  if (
    !result.queued &&
    typeof result.error === "string" &&
    /nonce .* already used/i.test(result.error)
  ) {
    const match =
      result.error.match(/last seen:\s*(\d+)/i);

    const recoveredNonce = match
      ? Number(match[1]) + 1
      : nonceReply.next_nonce + 1;

    result = await submitCall(
      method,
      argHex,
      sender,
      recoveredNonce
    );
  }

  if (!result.queued || !result.message_hash) {
    throw new Error(
      result.error || `Call "${method}" was rejected`
    );
  }

  return pollReceipt(result.message_hash);
}

async function pollReceipt(
  hashHex: string
): Promise<string> {
  const deadline = Date.now() + 30_000;
  let transientPolls = 0;

  while (Date.now() < deadline) {
    try {
      const result = await fetchWithRetry(
        `${BASE}/api/receipt?hash=${hashHex}`
      );

      if (result.found) {
        if (result.status === "success") {
          return result.reply || "";
        }

        throw new Error(
          result.error || "Call failed on chain"
        );
      }
    } catch (error) {
      transientPolls++;

      if (transientPolls > 10) {
        throw error;
      }
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 500)
    );
  }

  throw new Error(
    "Timed out waiting for the chain's receipt"
  );
}

export async function createNote(
  sessionTokenHex: string,
  title: string,
  body: string
): Promise<Note> {
  const reply = await callRaw(
    "createNote",
    encode(
      [IDL.Vec(IDL.Nat8), IDL.Text, IDL.Text],
      [sessionBlob(sessionTokenHex), title, body]
    )
  );

  return decodeNote(reply);
}

export async function listNotes(
  sessionTokenHex: string
): Promise<Note[]> {
  const reply = await callRaw(
    "listNotes",
    encode(
      [IDL.Vec(IDL.Nat8)],
      [sessionBlob(sessionTokenHex)]
    )
  );

  return decodeNotes(reply);
}

export async function updateNote(
  sessionTokenHex: string,
  id: bigint,
  title: string,
  body: string
): Promise<boolean> {
  const reply = await callRaw(
    "updateNote",
    encode(
      [IDL.Vec(IDL.Nat8), IDL.Nat, IDL.Text, IDL.Text],
      [sessionBlob(sessionTokenHex), id, title, body]
    )
  );

  return decodeBool(reply);
}

export async function deleteNote(
  sessionTokenHex: string,
  id: bigint
): Promise<boolean> {
  const reply = await callRaw(
    "deleteNote",
    encode(
      [IDL.Vec(IDL.Nat8), IDL.Nat],
      [sessionBlob(sessionTokenHex), id]
    )
  );

  return decodeBool(reply);
}

// =========================================================
// TASK 3 — SHARE, FEED AND POINTS LEDGER
// =========================================================

export async function shareNote(
  sessionTokenHex: string,
  id: bigint
): Promise<boolean> {
  const reply = await callRaw(
    "shareNote",
    encode(
      [IDL.Vec(IDL.Nat8), IDL.Nat],
      [sessionBlob(sessionTokenHex), id]
    )
  );

  return decodeBool(reply);
}

export async function unshareNote(
  sessionTokenHex: string,
  id: bigint
): Promise<boolean> {
  const reply = await callRaw(
    "unshareNote",
    encode(
      [IDL.Vec(IDL.Nat8), IDL.Nat],
      [sessionBlob(sessionTokenHex), id]
    )
  );

  return decodeBool(reply);
}

export async function feedView(): Promise<FeedNote[]> {
  const reply = await queryRaw(
    "feedView",
    encodeEmpty()
  );

  const decoded = decode<
    Array<{
      id: bigint;
      title: string;
      body: string;
      author: { toText(): string };
    }>
  >(
    [IDL.Vec(FeedNoteIDL)],
    reply
  );

  return decoded.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    author: item.author.toText(),
  }));
}

export async function myBalance(
  sessionTokenHex: string
): Promise<bigint> {
  const reply = await callRaw(
    "myBalance",
    encode(
      [IDL.Vec(IDL.Nat8)],
      [sessionBlob(sessionTokenHex)]
    )
  );

  return decode<bigint>(
    [IDL.Nat],
    reply
  );
}

export async function tip(
  sessionTokenHex: string,
  to: string,
  amount: bigint
): Promise<TipResult> {
  const reply = await callRaw(
    "tip",
    encode(
      [
        IDL.Vec(IDL.Nat8),
        IDL.Principal,
        IDL.Nat,
      ],
      [
        sessionBlob(sessionTokenHex),
        Principal.fromText(to),
        amount,
      ]
    )
  );

  return decode<TipResult>(
    [TipResultIDL],
    reply
  );
}

export async function tipHistoryView(): Promise<TipRecord[]> {
  const reply = await queryRaw(
    "tipHistoryView",
    encodeEmpty()
  );

  const decoded = decode<
    Array<{
      from: { toText(): string };
      to: { toText(): string };
      amount: bigint;
      timestamp: bigint;
    }>
  >(
    [IDL.Vec(TipRecordIDL)],
    reply
  );

  return decoded.map((item) => ({
    from: item.from.toText(),
    to: item.to.toText(),
    amount: item.amount,
    timestamp: item.timestamp,
  }));
}

export async function tokenMetadataView(): Promise<TokenMetadata> {
  const reply = await queryRaw(
    "tokenMetadataView",
    encodeEmpty()
  );

  return decode<TokenMetadata>(
    [TokenMetadataIDL],
    reply
  );
}

export async function ledgerSealView(): Promise<LedgerSeal> {
  const reply = await queryRaw(
    "ledgerSealView",
    encodeEmpty()
  );

  return decode<LedgerSeal>(
    [LedgerSealIDL],
    reply
  );
}

type MemphisPasskeyRuntime = {
  issueScopedSession: (
    sessionTokenHex: string,
    origin: string
  ) => Promise<{
    scoped_token: Uint8Array;
    scoped_token_hex: string;
  }>;
};

export async function issueNotesScopedSession(
  masterSessionTokenHex: string
): Promise<string> {
  const runtime = (
    window as unknown as {
      MemphisPasskey?: MemphisPasskeyRuntime;
    }
  ).MemphisPasskey;

  if (!runtime?.issueScopedSession) {
    throw new Error(
      "Memphis scoped-session runtime is unavailable."
    );
  }

  const result = await runtime.issueScopedSession(
    masterSessionTokenHex,
    window.location.origin
  );

  if (!result.scoped_token_hex) {
    throw new Error(
      "Memphis did not return a scoped session token."
    );
  }

  return result.scoped_token_hex;
}
