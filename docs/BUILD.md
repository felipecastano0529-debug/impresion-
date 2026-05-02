# Cómo se construye el plugin

## Stack

- **Electron 28** + **Node.js 20**
- **electron-builder** (empaquetado .dmg / .exe)
- **@supabase/supabase-js** — Realtime + polling de respaldo
- **electron-store** — config local persistente
- **qrcode** — render del QR si la sede lo configuró
- **node-thermal-printer** — listada por compatibilidad futura, hoy no se usa
  (la impresión va por `BrowserWindow.webContents.print()` que usa el driver
  del SO; deja que el sistema operativo traduzca HTML → ESC/POS)

## Estructura

```
impresion-/
├── package.json              # deps + scripts + electron-builder config
├── package-lock.json         # OBLIGATORIO para que GH Actions npm ci funcione
├── README.md
├── .gitignore
├── src/
│   ├── main.js               # Electron main process: tray, Supabase, processJob
│   ├── preload.js            # IPC bridge para la setup window
│   └── renderer/
│       ├── template.js       # render del nuevo formato POS (port de printTicket.ts)
│       └── setup.html        # UI de configuración (Supabase URL, tenant, impresora)
├── assets/
│   ├── README.md             # Instrucciones para generar los íconos reales
│   ├── tray.png              # FALTA — 32×32 PNG del tray icon
│   ├── icon.icns             # FALTA — icono macOS
│   └── icon.ico              # FALTA — icono Windows
├── docs/
│   ├── BUILD.md              # este archivo
│   ├── DEPLOYMENT.md         # cómo se publica (GH Actions)
│   └── STATUS.md             # snapshot de qué está vivo y qué falta
└── .github/workflows/
    └── release.yml           # auto-build mac+win en tag printer-v*
```

## Cómo funciona el plugin (alto nivel)

1. **Inicia** y se queda en el tray del sistema (en macOS no aparece en el dock).
2. **Lee config local** (`electron-store`): URL de Supabase, anon key, tenant_id,
   branch_id (opcional), nombre de la impresora del sistema.
3. **Si falta config**, abre la ventana de Setup.
4. **Si tiene config**, se conecta a Supabase y:
   - Suscribe a `print_jobs` por `tenant_id` vía Realtime (WebSocket).
   - Inicia un polling de respaldo cada 15s (por si el WS se cae).
5. **Cuando llega un job pending**:
   - Re-chequea que sigue pending (otro plugin pudo haberlo agarrado).
   - Lee en paralelo: `orders`, `order_items`, `branches.invoice_*`, `tenants`,
     `print_settings`.
   - Genera HTML con el nuevo formato POS (Poppins, logo, header multilínea,
     copias cocina + cliente, QR opcional).
   - Lo carga en un `BrowserWindow` oculto y dispara `webContents.print()`
     con la impresora configurada.
   - Marca el job como `printed` (o `failed` con la razón).

## Build local

```bash
cd impresion-/
npm install            # baja Electron (~150 MB)
npm start              # arranca en modo desarrollo

# Solo en Mac:
npm run build:mac      # genera dist/Pida-Pues-Printer-arm64.dmg

# Solo en Windows:
npm run build:win      # genera dist/Pida-Pues-Printer-x64.exe
```

> Cross-compilation (buildar Win desde Mac) es problemático con Electron. La
> forma confiable es delegar al GitHub Actions que tiene runners Mac+Win nativos.

## Generar los íconos faltantes

Hay un README en `assets/` con instrucciones para generar `tray.png`,
`icon.icns` y `icon.ico` desde un PNG cuadrado de 1024×1024.

Mientras no estén, el tray aparece sin ícono visible (el SO usa un placeholder
gris) y el .dmg/.exe usan el ícono default de Electron.

## Modificar el formato del ticket

El render del ticket está en `src/renderer/template.js`, función `renderCopy`.
Es un **port 1:1** del archivo `src/lib/printTicket.ts` del proyecto principal
(`build-stellar-platform`). Si actualizan ese archivo allá, sincronizalo acá
para mantener identidad visual entre el preview de `/admin` y lo que sale
impreso por el plugin.

Específicamente, las funciones equivalentes son:

| Proyecto principal | Plugin |
|---|---|
| `printTicket.ts` → `renderCopy()` | `template.js` → `renderCopy()` |
| `printTicket.ts` estilos CSS (líneas 320-377) | `template.js` → en el HTML head |
