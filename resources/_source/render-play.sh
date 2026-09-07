#!/bin/zsh
# render-play.sh -- build resources/function-meaningless-dialogue.pdf from
# resources/_source/meaning-functionless-dialogue.md
set -euo pipefail

REPO="/Users/preterite/Sites/preterition-revised"
SRC="$REPO/resources/_source/meaning-functionless-dialogue.md"
OUT="$REPO/resources/meaning-functionless-dialogue.pdf"
BUILD="$REPO/resources/_source/build"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

rm -rf "$BUILD"; mkdir -p "$BUILD"
cp "$REPO"/fonts/CrimsonPro-*.woff2 "$BUILD/"
cp "$REPO/resources/_source/play-print.css" "$BUILD/"

pandoc -f markdown+hard_line_breaks -t html5 --standalone \
  --lua-filter="$REPO/resources/_source/verse-lines.lua" \
  --css=play-print.css \
  --metadata pagetitle="The Meaning of Functionless Dialogue" \
  -o "$BUILD/play.html" "$SRC"

"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=8000 \
  --print-to-pdf="$OUT" "file://$BUILD/play.html" 2>/dev/null

echo "built: $OUT"
