#!/usr/bin/env bash
# Regenerate the User Guide PDF from the HTML source using headless Edge (Windows).
# Usage:  ./docs/user-guide/build-pdf.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WINDIR="$(cygpath -w "$DIR")"

EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -f "$EDGE" ] || EDGE="/c/Program Files/Microsoft/Edge/Application/msedge.exe"
[ -f "$EDGE" ] || { echo "Microsoft Edge not found." >&2; exit 1; }

# A writable, Windows-style profile dir (Edge needs a real path, not an MSYS /tmp).
PROFILE_UNIX="$DIR/.edge-profile"
mkdir -p "$PROFILE_UNIX"
PROFILE_WIN="$(cygpath -w "$PROFILE_UNIX")"

"$EDGE" --headless=new --disable-gpu --no-pdf-header-footer \
  --user-data-dir="$PROFILE_WIN" \
  --print-to-pdf="$WINDIR\\telcovantage-erp-user-guide.pdf" \
  "file:///$WINDIR\\telcovantage-erp-user-guide.html"

# Edge can return before the file is flushed; wait briefly and confirm.
for _ in 1 2 3 4 5; do
  [ -f "$DIR/telcovantage-erp-user-guide.pdf" ] && break
  sleep 1
done

if [ -f "$DIR/telcovantage-erp-user-guide.pdf" ]; then
  echo "Generated: $DIR/telcovantage-erp-user-guide.pdf"
else
  echo "PDF was not produced." >&2
  exit 1
fi
