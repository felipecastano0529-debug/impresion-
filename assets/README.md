# Iconos del plugin

Faltan los binarios reales — agregalos antes del primer release:

- `tray.png` — 32×32 PNG (ícono del tray del sistema)
- `icon.icns` — macOS icon (1024×1024 base, exportado a .icns con `iconutil`)
- `icon.ico` — Windows icon (256×256 PNG empaquetado a .ico)

Mientras no estén, el tray usa el ícono vacío del SO y `electron-builder`
puede fallar al buildar el .dmg/.exe — si pasa, agregá los archivos.

Para generar rápido desde un PNG cuadrado de 1024×1024:

```bash
# .icns desde Mac
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
cp icon.png             icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
mv icon.icns assets/

# .ico desde la web (https://convertio.co/png-ico/) o ImageMagick:
# magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```
