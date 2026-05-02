# Cómo se despliega el plugin (releases)

## Flujo automático (lo normal)

1. Hacer cambios en el código (en branch `source/v0.4.0` o crear nueva).
2. Commit + push.
3. Pushear un tag con prefijo `printer-v`:

   ```bash
   git tag printer-v0.4.1
   git push origin printer-v0.4.1
   ```

4. **GitHub Actions detecta el tag** y dispara el workflow `release.yml`:
   - Job 1: `macos-latest` builda `Pida-Pues-Printer-arm64.dmg` (~3 min)
   - Job 2: `windows-latest` builda `Pida-Pues-Printer-x64.exe` (~5 min)
   - Ambos jobs corren en paralelo.
5. Cuando los builds terminan, **suben los binarios** al release del mismo tag
   en este mismo repo (`felipecastano0529-debug/impresion-`).
6. Los usuarios pueden bajar la nueva versión desde:
   `https://github.com/felipecastano0529-debug/impresion-/releases/latest`

## Verificar que el build pasó

```bash
gh run list --limit 3                 # ver últimos workflows
gh run watch <run-id>                 # ver un workflow en vivo
gh release view printer-v0.4.0         # ver assets del release
```

## Re-disparar un build (mismo tag)

Si un build falla y querés re-correr **sin cambiar el código**:

```bash
git tag -d printer-v0.4.0
git push origin :refs/tags/printer-v0.4.0
git tag printer-v0.4.0
git push origin printer-v0.4.0
```

Si tenés que cambiar código, mejor crear `printer-v0.4.1`.

## Releases publicados

| Versión | Estado | Notas |
|---|---|---|
| `printer-v0.1.0` | publicado (origen anterior, source no disponible) | versión inicial del otro agente |
| `printer-v0.3.0` | publicado (origen anterior, source no disponible) | "Polling de respaldo + cola compartida + indicador de estado tray" |
| `printer-v0.4.0` | **Latest** — publicado por este workflow | Nuevo formato POS (Poppins, logo, QR), reconstruido desde cero porque el source de los anteriores no existía en GitHub |

## Donde vive cada cosa

- **Source code**: este repo, branch `source/v0.4.0`.
- **Releases / binarios**: este mismo repo, sección Releases.
- **Workflow**: este repo, `.github/workflows/release.yml`.
- **Página de descarga para usuarios**: el panel `/app` del proyecto principal
  (`build-stellar-platform`) tiene un botón "App impresora" que apunta a la
  release `latest` de este repo.

## Caveats actuales

- **Sin code signing**: macOS y Windows muestran advertencia la primera vez.
  Para resolverlo se necesita un certificado de Apple Developer ($99/año) y
  uno de Windows (varios precios). Con eso configurado en `electron-builder`
  + secrets en GitHub Actions, los binarios saldrían firmados y notarizados.
- **Íconos faltantes**: el .dmg/.exe usan el ícono default de Electron hasta
  que se agreguen `assets/tray.png`, `icon.icns`, `icon.ico` (ver `BUILD.md`).
- **Branch de source**: vive en `source/v0.4.0` (no en `main`). Cuando se
  estabilice, conviene mergearlo a `main` y mover la rama de trabajo a
  `source/v0.4.x` o similar para futuras iteraciones.
