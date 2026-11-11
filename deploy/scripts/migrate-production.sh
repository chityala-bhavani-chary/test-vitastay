#!/usr/bin/env bash
# Apply additive migrate-* scripts. Never runs db:seed.
set -euo pipefail
cd "$(dirname "$0")/../../vitastay_new_back"

if [[ "${NODE_ENV:-}" == "production" && "${1:-}" != "--yes" ]]; then
  echo "Refusing to migrate production without: $0 --yes"
  exit 1
fi

node scripts/preflightEnv.js

run() {
  echo "==> $*"
  node "$@"
}

# Super Admin bootstrap is idempotent (creates the user if missing).
run database/migrate-super-admin.js
run database/migrate-tenant-fields.js
run database/migrate-hostel-approval.js
run database/migrate-hostel-databases.js
run database/migrate-hostel-logo.js
run database/migrate-notice-period.js
run database/migrate-room-active.js
run database/migrate-property-media.js
# JSON → property_media copy. Safe to re-run. Does not drop JSON columns.
run database/migrate-legacy-media.js --apply
run database/migrate-payment-orders.js

echo "Migrations finished. Do NOT run npm run db:seed."
