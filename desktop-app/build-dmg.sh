#!/bin/bash
# Empaqueta la app en un DMG con enlace a Aplicaciones → ../download/NORTHPOINT-JOURNAL.dmg
set -e
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
APP="NORTHPOINT.app"
VOL="NORTHPOINT"
OUT="$ROOT/download/NORTHPOINT.dmg"
STAGE="dmg-stage"; rm -rf "$STAGE"; mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
rm -f "$OUT"
hdiutil create -srcfolder "$STAGE" -volname "$VOL" -fs HFS+ -format UDZO -ov "$OUT" >/dev/null
rm -rf "$STAGE"
echo "DMG: $OUT ($(du -h "$OUT" | cut -f1))"
