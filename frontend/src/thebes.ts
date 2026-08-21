import { IDL } from '@icp-sdk/core/candid';
export const BACKEND_CANISTER_ID = 92459100095509;

const BASE = "";

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) =>
    x.toString(16).padStart(2, "0")
  ).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 ? "0" + hex : hex;
  const out = new Uint8Array(clean.length / 2);

  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(
      clean.slice(i * 2, i * 2 + 2),
      16
    );
  }

  return out;
}

function uleb(n: bigint): number[] {
  const out: number[] = [];

  for (;;) {
    const byte = Number(n & 0x7fn);
    n >>= 7n;

    if (n === 0n) {
      out.push(byte);
      return out;
    }

    out.push(byte | 0x80);
  }
}

function ulebDecode(
  buf: Uint8Array,
  off: number
): [bigint, number] {
  let result = 0n;
  let shift = 0n;

  for (;;) {
    const byte = buf[off++];

    if (byte === undefined) {
      throw new Error("candid: truncated uleb128");
    }

    result |= BigInt(byte & 0x7f) << shift;

    if ((byte & 0x80) === 0) {
      return [result, off];
    }

    shift += 7n;
  }
}

function slebDecode(
  buf: Uint8Array,
  off: number
): [bigint, number] {
  let result = 0n;
  let shift = 0n;

  for (;;) {
    const byte = buf[off++];

    if (byte === undefined) {
      throw new Error("candid: truncated sleb128");
    }

    result |= BigInt(byte & 0x7f) << shift;
    shift += 7n;

    if ((byte & 0x80) === 0) {
      if (byte & 0x40) {
        result -= 1n << shift;
      }

      return [result, off];
    }
  }
}

const MAGIC = [0x44, 0x49, 0x44, 0x4c];

const TYPE_TEXT = 0x71;
const TYPE_NAT = 0x7d;

export function encodeText(text: string): string {
  const bytes: number[] = [
    ...MAGIC,
    0,
    1,
    TYPE_TEXT,
  ];

  encodeTextValue(bytes, text);

  return bytesToHex(new Uint8Array(bytes));
}
function encodeTextValue(
  bytes: number[],
  value: string
) {
  const utf8 = new TextEncoder().encode(value);

  bytes.push(...uleb(BigInt(utf8.length)));
  bytes.push(...utf8);
}

function encodeNatValue(
  bytes: number[],
  value: bigint
) {
  bytes.push(...uleb(value));
}

export function encodeEmpty(): string {
  return bytesToHex(
    new Uint8Array([
      ...MAGIC,
      0,
      0,
    ])
  );
}

export function encodeAdd(
  title: string,
  content: string
): string {
  const bytes: number[] = [
    ...MAGIC,

    // Type table count
    0,

    // Argument count
    2,

    // text, text
    TYPE_TEXT,
    TYPE_TEXT,
  ];

  encodeTextValue(bytes, title);
  encodeTextValue(bytes, content);

  return bytesToHex(new Uint8Array(bytes));
}

export function encodeEdit(
  id: bigint,
  title: string,
  content: string
): string {
  const bytes: number[] = [
    ...MAGIC,

    0,

    // 3 arguments
    3,

    // nat, text, text
    TYPE_NAT,
    TYPE_TEXT,
    TYPE_TEXT,
  ];

  encodeNatValue(bytes, id);
  encodeTextValue(bytes, title);
  encodeTextValue(bytes, content);

  return bytesToHex(new Uint8Array(bytes));
}

export function encodeRemove(id: bigint): string {
  const bytes: number[] = [
    ...MAGIC,
    0,
    1,
    TYPE_NAT,
  ];

  encodeNatValue(bytes, id);

  return bytesToHex(new Uint8Array(bytes));
}

function decodeBool(
  buf: Uint8Array,
  off: number
): boolean {
  let ty: bigint;

  [ty, off] = slebDecode(buf, off);

  if (ty === -2n) return true;
  if (ty === -1n) return false;

  throw new Error(
    `candid: expected bool, got ${ty}`
  );
}

function decodeNat(
  buf: Uint8Array,
  off: number
): bigint {
  let ty: bigint;

  [ty, off] = slebDecode(buf, off);

  if (ty !== -3n) {
    throw new Error(
      `candid: expected nat, got ${ty}`
    );
  }

  const [value] = ulebDecode(buf, off);
  return value;
}

function decodeText(
  buf: Uint8Array,
  off: number
): [string, number] {
  let ty: bigint;

  [ty, off] = slebDecode(buf, off);

  if (ty !== -15n) {
    throw new Error(
      `candid: expected text, got ${ty}`
    );
  }

  let length: bigint;

  [length, off] = ulebDecode(buf, off);

  const end = off + Number(length);

  return [
    new TextDecoder().decode(
      buf.slice(off, end)
    ),
    end,
  ];
}


function decodeReply(
  hex: string
): string | bigint | boolean {
  const buf = hexToBytes(hex);

  if (
    buf.length < 6 ||
    buf[0] !== 0x44 ||
    buf[1] !== 0x49 ||
    buf[2] !== 0x44 ||
    buf[3] !== 0x4c
  ) {
    throw new Error("candid: bad magic");
  }

  let off = 4;


  let argCount: bigint;
  [argCount, off] = ulebDecode(buf, off);

  if (argCount !== 1n) {
    throw new Error(
      "candid: expected one return value"
    );
  }

  const typePosition = off;

  let ty: bigint;
  [ty, off] = slebDecode(buf, off);

  switch (ty) {
    case -3n:
      return decodeNat( buf, typePosition);

    case -2n:
    case -1n:
      return decodeBool(
        buf,
        typePosition
      );

    case -15n: {
      const [value] = decodeText(
        buf,
        typePosition
      );

      return value;
    }

    default:
      throw new Error(
        `candid: unsupported reply type ${ty}`
      );
  }
}

export type Note = {
  id: bigint;
  title: string;
  content: string;
};

function demoSender(): string {
  const KEY =
    `thebes-demo-sender:${BACKEND_CANISTER_ID}`;

  let sender =
    localStorage.getItem(KEY);

  if (!sender) {
    const bytes =
      new Uint8Array(8);

    crypto.getRandomValues(bytes);

    sender = bytesToHex(bytes);

    localStorage.setItem(
      KEY,
      sender
    );
  }

  return sender;
}

const RETRIES = 3;

function isTransient(
  status: number,
  body: string
): boolean {
  return (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /validator unreachable|no healthy validator|unhealthy/i.test(
      body
    )
  );
}

async function fetchWithRetry(
  url: string,
  init?: RequestInit
): Promise<any> {
  let lastErr = "";

  for (
    let attempt = 0;
    attempt <= RETRIES;
    attempt++
  ) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          400 * attempt
        )
      );
    }

    try {
      const response =
        await fetch(url, init);

      const text =
        await response.text();

      if (
        !response.ok &&
        isTransient(
          response.status,
          text
        )
      ) {
        lastErr =
          `HTTP ${response.status}: ${text.slice(0, 200)}`;

        continue;
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error(
          `malformed reply: ${text.slice(0, 200)}`
        );
      }
    } catch (error) {
      lastErr = String(error);
    }
  }

  throw new Error(
    `the network is briefly unreachable — please try again (${lastErr})`
  );
}

export async function query(
  method: string,
  argHex: string
): Promise<string> {
  const response =
    await fetchWithRetry(
      `${BASE}/api/query`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body: JSON.stringify({
          canister_id:
            BACKEND_CANISTER_ID,
          method,
          arg: argHex,
          sender:
            demoSender(),
        }),
      }
    );

  if (
    response.status !== "success"
  ) {
    throw new Error(
      response.error ||
        "query failed"
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
  const response =
    await fetch(
      `${BASE}/api/call`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body: JSON.stringify({
          canister_id:
            BACKEND_CANISTER_ID,
          method,
          arg: argHex,
          sender,
          nonce,
        }),
      }
    );

  const text =
    await response.text();

  if (
    !response.ok &&
    isTransient(
      response.status,
      text
    )
  ) {
    throw new Error(
      "the network is briefly unreachable — please try again"
    );
  }

  return JSON.parse(text);
}

export async function call(
  method: string,
  argHex: string
): Promise<string> {
  const sender =
    demoSender();

  const nonceResponse =
    await fetchWithRetry(
      `${BASE}/api/next_nonce?sender=${sender}`,
      {
        cache: "no-store",
      }
    );

  if (
    typeof nonceResponse.next_nonce !==
    "number"
  ) {
    throw new Error(
      "malformed next_nonce reply"
    );
  }

  let response =
    await submitCall(
      method,
      argHex,
      sender,
      nonceResponse.next_nonce
    );

  if (
    !response.queued &&
    typeof response.error ===
      "string" &&
    /nonce .* already used/i.test(
      response.error
    )
  ) {
    const match =
      response.error.match(
        /last seen:\s*(\d+)/i
      );

    const recovered =
      match
        ? Number(match[1]) + 1
        : nonceResponse.next_nonce + 1;

    response =
      await submitCall(
        method,
        argHex,
        sender,
        recovered
      );
  }

  if (
    !response.queued ||
    !response.message_hash
  ) {
    throw new Error(
      response.error ||
        "call rejected"
    );
  }

  return pollReceipt(
    response.message_hash
  );
}

async function pollReceipt(
  hashHex: string
): Promise<string> {
  const deadline =
    Date.now() + 30_000;

  let transientPolls = 0;

  while (
    Date.now() < deadline
  ) {
    try {
      const response =
        await fetchWithRetry(
          `${BASE}/api/receipt?hash=${hashHex}`
        );

      if (response.found) {
        if (
          response.status ===
          "success"
        ) {
          return response.reply || "";
        }

        throw new Error(
          response.error ||
            "call failed on chain"
        );
      }
    } catch (error) {
      transientPolls++;

      if (
        transientPolls > 10
      ) {
        throw error;
      }
    }

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 500)
    );
  }

  throw new Error(
    "timed out waiting for the chain's receipt"
  );
}

export async function add(
  title: string,
  content: string
): Promise<bigint> {
  const reply =
    await call(
      "add",
      encodeAdd(
        title,
        content
      )
    );

  const decoded =
function readCandidTypeTable(
  buf: Uint8Array,
  off: number,
  count: bigint
): bigint[] {
  const table: bigint[] = [];

  for (let i = 0n; i < count; i++) {
    let type: bigint;
    [type, off] = slebDecode(buf, off);

    table.push(type);

    /*
     * A record type contains:
     *
     *   field count
     *   field hash
     *   field type
     *
     * Our Note record has 3 fields.
     */
    if (type === -20n) {
      let fieldCount: bigint;
      [fieldCount, off] = ulebDecode(buf, off);

      for (let j = 0n; j < fieldCount; j++) {
        let hash: bigint;
        [hash, off] = ulebDecode(buf, off);

        let fieldType: bigint;
        [fieldType, off] = slebDecode(buf, off);

        /*
         * Field types in our Note are primitive text/nat,
         * so no additional type-table data is needed.
         */
        void hash;
        void fieldType;
      }
    }
  }

  return table;
}   

 decodeReply(reply);

  if (
    typeof decoded !==
    "bigint"
  ) {
    throw new Error(
      "invalid add response"
    );
  }

  return decoded;
}

export async function edit(
  id: bigint,
  title: string,
  content: string
): Promise<boolean> {
  const reply =
    await call(
      "edit",
      encodeEdit(
        id,
        title,
        content
      )
    );

  const decoded =
    decodeReply(reply);

  if (
    typeof decoded !==
    "boolean"
  ) {
    throw new Error(
      "invalid edit response"
    );
  }

  return decoded;
}

export async function remove(
  id: bigint
): Promise<boolean> {
  const reply =
    await call(
      "remove",
      encodeRemove(id)
    );

  const decoded =
    decodeReply(reply);

  if (
    typeof decoded !==
    "boolean"
  ) {
    throw new Error(
      "invalid remove response"
    );
  }

  return decoded;
}

export async function list(): Promise<Note[]> {
  const reply =
    await query(
      "list",
      encodeEmpty()
    );

  return decodeNoteList(reply);
}

function decodeNoteList(hex: string): Note[] {
  const NoteIDL = IDL.Record({
    content: IDL.Text,
    id: IDL.Nat,
    title: IDL.Text,
  });

  const ListIDL = IDL.Vec(NoteIDL);

  const decoded = IDL.decode(
    [ListIDL],
    hexToBytes(hex)
  );

  const rawNotes = decoded[0] as Array<{
    content: string;
    id: bigint;
    title: string;
  }>;

  return rawNotes.map((note) => ({
    id: note.id,
    title: note.title,
    content: note.content,
  }));
}
