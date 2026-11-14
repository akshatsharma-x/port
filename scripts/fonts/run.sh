#!/bin/sh
# Runs the font bake with the project venv if it exists (see scripts/fonts/bake.py).
set -e
cd "$(dirname "$0")/../.."
if [ -x .venv/bin/python ]; then PY=.venv/bin/python; else PY=python3; fi
"$PY" -c "import fontTools, brotli" 2>/dev/null || {
  echo "fontTools + brotli missing. Run:  python3 -m venv .venv && .venv/bin/pip install fonttools brotli" >&2
  exit 1
}
"$PY" scripts/fonts/bake.py
# Hubot Sans fallbacks, measured per display step in the installed Chrome
node scripts/fonts/display-fallbacks.mjs
# the hero name's width model (wdth fit, DESIGN.md §7.4), measured the same way
npx tsx scripts/fonts/name-fit.ts
