# Pida Pues Printer

Plugin de impresión de Pida Pues. Vive en el tray del sistema, escucha la
cola `print_jobs` en Supabase y manda los tickets a la impresora térmica
con el nuevo formato POS (Poppins, logo de la sede, header multilínea,
QR opcional, copias cocina + cliente).

- macOS arm64 (Apple Silicon): `Pida-Pues-Printer-arm64.dmg`
- Windows x64: `Pida-Pues-Printer-x64.exe`

## Descarga

La forma fácil: ve a [/app → App impresora](https://www.pidapues.com/app)
en tu panel y toca el botón de descarga. La página apunta siempre a la
última versión.

Releases: https://github.com/felipecastano0529-debug/impresion-/releases

## Instalación

- **macOS**: doble click en el `.dmg` → arrastra a Aplicaciones. Primera vez,
  click derecho → Abrir → Abrir igual (la app no está firmada con cert de Apple).
- **Windows**: ejecuta el `.exe` → si SmartScreen avisa, "Más información →
  Ejecutar de todas formas".

## Configuración

Al abrir el plugin se queda en el tray del sistema. Click derecho en el
ícono → "Abrir configuración" y completá:

| Campo | De dónde sacarlo |
|---|---|
| Supabase Project URL | Supabase Studio → Settings → API |
| Supabase Anon Key | Supabase Studio → Settings → API |
| Tenant ID | Tu panel /app → URL contiene tu tenant_id |
| Branch ID (opcional) | Tu panel /app → Sedes — copiá el UUID |
| Nombre impresora | `printer:NombreExacto` según sistema operativo |

Después tocá "Imprimir test" para validar.

## Qué imprime (formato v0.4.0)

Lee de Supabase:
- `orders` + `order_items` (datos del pedido)
- `branches.invoice_*` (logo, header, footer, QR de la sede)
- `tenants.logo_url` (fallback de logo)
- `print_settings` (cuántas copias, ancho papel)

Estructura del ticket:
- Logo de la sede (o tenant si no hay) en blanco/negro
- Header multilínea (nombre legal, dirección, contacto)
- NIT si está configurado
- Etiqueta de copia (`** COPIA COCINA **` / `** COPIA CLIENTE **`)
- Pedido No., Fecha, Cliente, Teléfono, Dirección
- Notas del pedido si hay
- Items con variantes, modificadores y notas
- Subtotal, Domicilio, **TOTAL** (resaltado)
- Método de pago + estado
- Footer message (multilínea)
- QR opcional (si la sede lo configuró)

## Stack técnico

- Electron 28 + Node.js 20
- `@supabase/supabase-js` — Realtime + polling de respaldo (15s)
- Print: BrowserWindow oculto + `webContents.print()` con la impresora
  configurada (deja al SO traducir HTML → ESC/POS)
- `electron-store` — config local persistente
- `electron-builder` — empaquetado .dmg / .exe

## Desarrollo

```bash
npm install
npm start           # arranca en modo desarrollo
npm run build:mac   # empaqueta .dmg (necesita correr en Mac)
npm run build:win   # empaqueta .exe (necesita correr en Windows)
```

## Releases

Pusheá un tag con prefijo `printer-v`:

```bash
git tag printer-v0.4.0
git push origin printer-v0.4.0
```

GitHub Actions builda en paralelo macOS + Windows y sube los binarios al
release del mismo tag.
