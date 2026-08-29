#!/bin/sh
set -eu

mkdir -p public

SDK_RUNTIME="node_modules/@thebes/sdk/runtime"

cp "$SDK_RUNTIME/boundary.js" public/boundary.js
cp "$SDK_RUNTIME/passkey.js" public/passkey.js

python3 - <<'PY'
from pathlib import Path

path = Path("public/passkey.js")
s = path.read_text()

# Production deployment:
# The app is served from memphis.mercaturaforum.com,
# so WebAuthn must use that RP ID.
old_localhost = 'const RP_ID = "localhost";'
new_memphis = 'const RP_ID = "memphis.mercaturaforum.com";'

if old_localhost in s:
    s = s.replace(old_localhost, new_memphis)

# Fix the receipt fetch if an SDK version contains the malformed expression.
old_receipt = 'fetchBOUNDARY + "/api/receipt?hash=" + hash)'
new_receipt = 'fetch(BOUNDARY + "/api/receipt?hash=" + hash)'

if old_receipt in s:
    s = s.replace(old_receipt, new_receipt)

path.write_text(s)

print("SDK sync patch applied successfully.")
print("WebAuthn RP_ID: memphis.mercaturaforum.com")
PY
