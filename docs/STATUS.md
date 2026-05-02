# Snapshot de qué está vivo y qué falta

Última actualización: 2026-05-02 (sesión Claude Opus 4.7)

## ✅ Lo que está hecho y publicado

### Plugin v0.4.0
- Source: `source/v0.4.0` en este repo, pusheado a GitHub.
- Build: GitHub Actions corrió mac+win exitoso.
- Release: `printer-v0.4.0` Latest, con `Pida-Pues-Printer-arm64.dmg`
  (105 MB) y `Pida-Pues-Printer-x64.exe` publicados.
- Workflow `.github/workflows/release.yml` configurado para auto-build en
  cualquier `printer-v*` tag futuro.

### Proyecto principal (`build-stellar-platform`)
- 5 fases de **online conversion priorities** mergeadas a `main` y pusheadas:
  - Fase 0: RPC `place_order` (78df73f)
  - Fase 1: OG meta dinámico para crawlers (8b3240f)
  - Fase 2: Nequi via Bold (bcd57be)
  - Fase 3: Pixels Meta/GA4/TikTok + fix tracking (9c8664c, bd11ead)
  - Fase 4: Live tracking courier (03a63a6)
  - Fase 5: Pedidos programados (e37c873)
  - Fase 5 fix: Sección "Programados" en OrdersBoard (04dca1c)
- Vercel: deploy automático disparado al push (no verificado en vivo
  porque el sandbox bloqueó `vercel ls`).

## ⚠️ Pendiente — necesita acción del usuario

### 1. Aplicar migraciones SQL a Supabase producción
**Crítico** — están commiteadas en el repo pero NO han corrido contra la DB.
Lista de migraciones nuevas (orden de aplicación):

```
supabase/migrations/20260502160000_create_place_order_rpc.sql
supabase/migrations/20260502170100_create_invoices.sql       (del usuario)
supabase/migrations/20260502170200_invoice_consecutive_audit.sql (del usuario)
supabase/migrations/20260502170300_invoice_rpcs.sql          (del usuario)
supabase/migrations/20260502180000_add_nequi_payment_method.sql
supabase/migrations/20260502190000_add_tenant_pixels.sql
supabase/migrations/20260502190100_extend_get_order_tracking_pixels.sql
supabase/migrations/20260502200000_scheduled_orders_enum.sql
supabase/migrations/20260502200100_scheduled_orders_validation.sql
supabase/migrations/20260502200200_scheduled_activator_cron.sql
supabase/migrations/20260502200300_extend_cancel_for_scheduled.sql
```

Aplicarlas:
```bash
cd build-stellar-platform/
supabase db push
```

Sin esto:
- El RPC `place_order` no existe → CheckoutModal con flag on falla.
- Pixels no se pueden configurar (campos en `tenants` no existen).
- Pedidos programados no funcionan (enum sin 'scheduled', RPC no existe, cron no programado).
- Live courier tracking devuelve 404 siempre (`get_order_for_tracking` viejo no expone pixels).

### 2. Tests SQL no ejecutados
Los tests negativos de `place_order` están escritos pero no corridos:
```bash
psql "$SUPABASE_DB_URL" -f build-stellar-platform/supabase/tests/place_order_negatives.sql
```

### 3. Íconos del plugin
Faltan `assets/tray.png`, `assets/icon.icns`, `assets/icon.ico`. Hay un README
en `assets/` con instrucciones para generarlos desde un PNG cuadrado de 1024×1024.

### 4. Code signing del plugin
- macOS: certificado de Apple Developer ($99/año) + notarización.
- Windows: certificado EV o standard.
- Sin esto, primera apertura muestra advertencia de seguridad (manejable
  con click derecho → Abrir en Mac, "Más información → Ejecutar igual" en Win).

### 5. Test piloto del plugin v0.4.0 en una sede real
Antes de distribuirlo a todas las sedes:
1. Bajar `Pida-Pues-Printer-arm64.dmg` o `.exe` de la release.
2. Instalar en una caja de un restaurante piloto.
3. Configurar (Supabase URL, anon key, tenant_id, branch_id, impresora).
4. Tocar "Imprimir test" — verificar que sale el formato nuevo bien.
5. Hacer un pedido real desde `/r/<slug>` y verificar que se imprime al
   confirmar el pedido en `/app`.

### 6. Compatibilidad con v3 (a confirmar con usuario)
El v0.4.0 fue **reconstruido desde cero** porque el source del v0.3.0 nunca
estuvo en GitHub. La estructura imita lo que las release notes del v3
mencionaron ("polling backup + cola + indicador tray"). Si querés alinear
exacto al código del v3:
1. Descargar el .dmg del v3.
2. Extraer con `hdiutil attach` + `npx asar extract`.
3. Comparar y portar lo que falte.

Comandos detallados en la conversación que llevó a esta sesión.

## 🔍 Archivos clave para retomar

| Archivo | Qué hace |
|---|---|
| `src/main.js` | Loop principal del plugin |
| `src/renderer/template.js` | Render del formato POS |
| `src/renderer/setup.html` | UI de configuración |
| `package.json` (sección "build") | Config de electron-builder |
| `.github/workflows/release.yml` | Auto-build mac+win |
| `docs/BUILD.md` | Cómo compilar localmente |
| `docs/DEPLOYMENT.md` | Cómo publicar releases |
| `docs/STATUS.md` | Este archivo |

## 🔗 URLs importantes

- Source: https://github.com/felipecastano0529-debug/impresion-/tree/source/v0.4.0
- Release latest: https://github.com/felipecastano0529-debug/impresion-/releases/latest
- Workflows: https://github.com/felipecastano0529-debug/impresion-/actions
- Proyecto principal: https://github.com/felipecastano0529-debug/build-stellar-platform
- Supabase project: `wjjnxhmsbqbbgdontwxi` (ver `build-stellar-platform/supabase/config.toml`)
- Producción: https://www.pidapues.com
