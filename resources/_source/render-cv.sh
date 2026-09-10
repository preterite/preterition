#!/bin/zsh
# render-cv.sh -- build resources/edwards-cv.pdf from resources/edwards-cv.md
#
# pandoc to standalone html5 against cv-print.css, then print through
# print-with-pagedjs.py. The print step is NOT Chrome's --print-to-pdf: that
# fires at load and cannot wait for paged.js to lay the document out, and
# --virtual-time-budget makes it worse by fast-forwarding timers. The helper
# drives Chrome over the DevTools protocol and prints only once pagination has
# settled. It also passes --allow-file-access-from-files, without which
# paged.js cannot read the stylesheet over XHR from a file:// origin.
#
# Cooper Hewitt, JetBrains Mono and the paged.js polyfill are copied into the
# scratch build so nothing is fetched at render time. Kings Caslon and Big
# Caslon CC are Creative Cloud system fonts reached by family name and CANNOT
# be staged: this render reproduces only on a machine where they are installed.
# That is a deliberate tradeoff, not an oversight.
set -euo pipefail

REPO="/Users/preterite/Sites/preterition-revised"
SRC="$REPO/resources/edwards-cv.md"
OUT="$REPO/resources/edwards-cv.pdf"
BUILD="$REPO/resources/_source/build-cv"

rm -rf "$BUILD"; mkdir -p "$BUILD"
cp "$REPO"/resources/_source/CooperHewitt-*.woff "$BUILD/"
cp "$REPO"/fonts/JetBrainsMono-Regular.woff2 "$BUILD/"
cp "$REPO/resources/_source/cv-print.css" "$BUILD/"
cp "$REPO/resources/_source/paged.polyfill.js" "$BUILD/"

pandoc -f markdown -t html5 --standalone \
  --css=cv-print.css \
  -H "$REPO/resources/_source/cv-head.html" \
  --metadata pagetitle="Mike Edwards -- Curriculum Vitae" \
  -o "$BUILD/cv.html" "$SRC"

python3 "$REPO/resources/_source/print-with-pagedjs.py" "$BUILD/cv.html" "$OUT"

echo "built: $OUT"
