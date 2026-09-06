#!/bin/bash
# Ensambla "NORTHPOINT JOURNAL.app" desde el binario compilado + la plataforma web.
set -e
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
APP="NORTHPOINT.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web"
cp "NORTHPOINT" "$APP/Contents/MacOS/NORTHPOINT"
chmod +x "$APP/Contents/MacOS/NORTHPOINT"
cp "$ROOT/index.html" "$APP/Contents/Resources/web/"
cp -R "$ROOT/css" "$ROOT/js" "$APP/Contents/Resources/web/"
cp np.icns "$APP/Contents/Resources/np.icns"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>NORTHPOINT</string>
  <key>CFBundleDisplayName</key><string>NORTHPOINT</string>
  <key>CFBundleIdentifier</key><string>com.northpoint.journal</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>NORTHPOINT</string>
  <key>CFBundleIconFile</key><string>np</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>© 2026 NorthPoint</string>
</dict>
</plist>
PLIST
printf 'APPL????' > "$APP/Contents/PkgInfo"
codesign --force --deep --sign - "$APP" 2>/dev/null && echo "firmado ad-hoc" || echo "(sin codesign)"
echo "listo: $APP"
