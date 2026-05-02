# Snapshot de qué está vivo y qué falta

Última actualización: 2026-05-02 (sesión Claude Opus 4.7)

## ✅ Todo en producción

### Backend (`build-stellar-platform`)
- 5 Fases de online conversion priorities + invoicing del otro agente
  commiteadas, pusheadas a `main` y **deployadas en Vercel**.
  Último deploy: `Ready Production` (commit `4ffd4cd`).
- 11 migraciones SQL **aplicadas a Supabase producción**
  (`wjjnxhmsbqbbgdontwxi`):
  - `place_order` RPC con recálculo server-side (Fase 0)
  - Invoicing schema + RPCs (3 migraciones del otro agente)
  - Nequi en enum `payment_method` (Fase 2)
  - Pixel IDs en `tenants` (Fase 3)
  - `get_order_for_tracking` extendido con pixel IDs (Fase 3 fix)
  - 'scheduled' en `order_status` (Fase 5)
  - `place_order` extendido con `_scheduled_for` (Fase 5)
  - Worker pg_cron `activate-scheduled-orders` corriendo cada minuto (Fase 5)
  - `cancel_order_by_customer` acepta scheduled (Fase 5)

### Plugin (`impresion-`)
- **v0.5.0 publicado** — release `printer-v0.5.0` con 2 binarios:
  - ✅ `Pida-Pues-Printer-arm64.dmg` (Mac Apple Silicon)
  - ✅ `Pida-Pues-Printer-x64.exe` (Windows)
  - ⏳ `Pida-Pues-Printer-x64.dmg` (Mac Intel) — buildeando lento, se sube
    automático cuando termine el job en GitHub Actions
- Source vive en el **repo principal** en `electron-app/` (no en este repo).
  Este repo (`impresion-`) sigue siendo solo de distribución de binarios.
- Workflow que builda + publica está en
  `build-stellar-platform/.github/workflows/release-printer.yml` y se dispara
  manual desde Actions con `workflow_dispatch`.

## ⚠️ Pendiente — necesita acción del usuario

### 1. Test piloto del plugin v0.5.0 en hardware real
Los binarios están publicados pero nadie los descargó, instaló y probó imprimir
contra una térmica de un restaurante real. Recomendación:
1. Bajar `Pida-Pues-Printer-arm64.dmg` (o `.exe`) del release
   `printer-v0.5.0` en una caja de un restaurante piloto.
2. Configurar (login con email del owner, seleccionar sede e impresora).
3. Tocar "Imprimir ticket de prueba".
4. Hacer un pedido real desde `/r/<slug>` y verificar que sale el formato
   nuevo en la térmica (logo de la sede, header, copia cocina + cliente,
   QR si está configurado).

### 2. Para que el QR salga en los tickets
Configurar en /admin → InvoiceSettings:
- `legal_name` (razón social)
- `tax_id` (NIT, si aplica)
- `invoice_header_message` (multilínea, dirección + contacto)
- `invoice_footer_message` (multilínea, mensaje de despedida)
- `invoice_qr_text` (URL o texto que codifica el QR)
- Subir logo en `branches.logo_url` o `tenants.logo_url`

Sin esto el ticket sale igual pero sin esos datos.

### 3. Code signing del plugin (largo plazo)
- macOS: certificado de Apple Developer ($99/año) + notarización
- Windows: certificado EV o standard
Sin esto, primera apertura muestra advertencia (manejable con click derecho
→ Abrir en Mac, "Más información → Ejecutar igual" en Win).

### 4. Tests SQL Fase 0 (opcional)
Los tests negativos de `place_order` están en
`build-stellar-platform/supabase/tests/place_order_negatives.sql`.
Para correrlos contra prod:
```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/place_order_negatives.sql
```
No son críticos porque la migración ya está aplicada y funcionando, pero
sirven para confirmar las protecciones (precio manipulado, cross-tenant,
agotado, etc.).

## 🔗 URLs importantes

| Cosa | URL |
|---|---|
| Source plugin | `build-stellar-platform/electron-app/` (repo principal) |
| Releases plugin | https://github.com/felipecastano0529-debug/impresion-/releases |
| Latest plugin | https://github.com/felipecastano0529-debug/impresion-/releases/latest |
| Workflow | https://github.com/felipecastano0529-debug/build-stellar-platform/actions/workflows/release-printer.yml |
| Producción | https://www.pidapues.com |
| Vercel project | felipes-projects-3bd9a2f6/build-stellar-platform |
| Supabase project | `wjjnxhmsbqbbgdontwxi` |

## 📁 Archivos clave del plugin

| Archivo | Qué hace |
|---|---|
| `electron-app/src/main/main.ts` | Loop principal: tray, Supabase, processJob, render del nuevo formato POS |
| `electron-app/src/main/preload.ts` | IPC bridge para la setup window |
| `electron-app/src/renderer/App.tsx` | UI de configuración (login, settings) |
| `electron-app/package.json` | deps + electron-builder config |
| `.github/workflows/release-printer.yml` | Auto-build y publish (en repo principal) |
