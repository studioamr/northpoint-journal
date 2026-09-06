#!/bin/bash
# Todo de una: ícono → binario universal → .app → DMG
set -e
cd "$(dirname "$0")"
swiftc make-icon.swift -o make-icon -framework Cocoa && ./make-icon && iconutil -c icns np.iconset -o np.icns && rm -rf np.iconset make-icon
swiftc -O -target arm64-apple-macos11  main.swift -o np_arm -framework Cocoa -framework WebKit -framework UserNotifications
swiftc -O -target x86_64-apple-macos11 main.swift -o np_x86 -framework Cocoa -framework WebKit -framework UserNotifications
lipo -create np_arm np_x86 -output "NORTHPOINT" && rm -f np_arm np_x86
./build-app.sh
./build-dmg.sh
