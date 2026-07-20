#!/usr/bin/env bash
# Back-compat shim. The real entrypoint is `npm run dev` (see ui/scripts/dev.sh),
# which self-elevates, builds anything missing, and starts the console.
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/dev.sh" "$@"
