#!/bin/zsh
# Crea «Alfred.app» sulla scrivania: un pulsante che apre Alfred in una finestra propria di Chrome.
# Uso: zsh app-mac/crea_app.sh [immagine quadrata .png per l'icona]
set -e
QUI="${0:A:h}"
IMMAGINE="${1:-$QUI/../web/icone/icona-512.png}"
APP="$HOME/Desktop/Alfred.app"
INDIRIZZO="https://menconinico-spec.github.io/alfred/"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cat > "$APP/Contents/MacOS/Alfred" <<AVVIO
#!/bin/zsh
# Apre Alfred nel profilo abituale di Chrome (dove l'accesso è già fatto), senza barra degli indirizzi.
exec open -na "Google Chrome" --args --app="$INDIRIZZO"
AVVIO
chmod +x "$APP/Contents/MacOS/Alfred"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Alfred</string>
  <key>CFBundleDisplayName</key><string>Alfred</string>
  <key>CFBundleIdentifier</key><string>it.alfred.gestionale.avvio</string>
  <key>CFBundleExecutable</key><string>Alfred</string>
  <key>CFBundleIconFile</key><string>Alfred</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
</dict></plist>
PLIST

# Icona nelle misure richieste da macOS
TMP="$(mktemp -d)/Alfred.iconset"; mkdir -p "$TMP"
for m in 16 32 128 256 512; do
  sips -z $m $m "$IMMAGINE" --out "$TMP/icon_${m}x${m}.png" >/dev/null
  d=$((m * 2)); sips -z $d $d "$IMMAGINE" --out "$TMP/icon_${m}x${m}@2x.png" >/dev/null
done
iconutil -c icns "$TMP" -o "$APP/Contents/Resources/Alfred.icns"
touch "$APP"
echo "Creata: $APP"
