#!/bin/sh
# docs/mock/*.html を PNG に書き出す（2 倍解像度）。Google Chrome を使う。
set -eu
cd "$(dirname "$0")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1280,800 --virtual-time-budget=8000 \
  --screenshot="$PWD/../screen.png" "file://$PWD/screen.html" 2>/dev/null
echo "書き出し: docs/screen.png"
