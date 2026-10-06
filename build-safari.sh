#!/bin/bash
# Empaqueta la extensión para Safari en dist/safari y (si Xcode está instalado)
# lanza el conversor safari-web-extension-converter sobre esa carpeta.
set -e

DIST="dist/safari"
rm -rf "$DIST"
mkdir -p "$DIST"

cp background.js content.js i18n.js sidepanel.html sidepanel.js styles.css "$DIST/"
cp manifest-safari.json "$DIST/manifest.json"
cp -R i18n "$DIST/"
cp -R images "$DIST/"

echo "Extensión copiada a $DIST"

if xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  xcrun safari-web-extension-converter "$DIST" --app-name "Universal Prompt Library" --macos-only
else
  echo "safari-web-extension-converter no está disponible (requiere Xcode completo, no solo Command Line Tools)."
  echo "Instala Xcode desde la App Store y ejecuta:"
  echo "  xcrun safari-web-extension-converter $DIST --app-name \"Universal Prompt Library\" --macos-only"
fi
