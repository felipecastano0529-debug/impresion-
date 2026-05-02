// Pida Pues Printer — main Electron process.
//
// Vive en el tray del sistema. Al iniciar:
//   1. Lee config local (Supabase URL/key, tenant_id, branch_id, impresora).
//   2. Si falta config, abre la ventana de Setup.
//   3. Suscribe a print_jobs vía Supabase Realtime + polling de respaldo
//      cada 15s (por si el WebSocket muere).
//   4. Cuando llega un job pending → carga datos del pedido + sede →
//      renderea HTML con el nuevo formato POS → imprime con node-thermal-printer.
//   5. Marca job como printed/failed.
//
// La estructura imita al v0.3.0 que ya funcionaba (cola compartida + tray
// status + polling backup) — lo único que cambia es el renderer de tickets.

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell } = require("electron");
const path = require("path");
const Store = require("electron-store");
const { createClient } = require("@supabase/supabase-js");
const { ThermalPrinter, PrinterTypes, CharacterSet } = require("node-thermal-printer");
const QRCode = require("qrcode");
const { renderTicket } = require("./renderer/template");

const store = new Store({
  defaults: {
    supabase_url: "",
    supabase_anon_key: "",
    tenant_id: "",
    branch_id: "",
    printer_interface: "", // ej: "printer:Bluetooth" | "tcp://192.168.1.50" | "usb"
    printer_type: "epson", // "epson" | "star"
  },
});

let tray = null;
let setupWindow = null;
let supabase = null;
let realtimeChannel = null;
let pollingTimer = null;
let connectionStatus = "disconnected"; // "connected" | "disconnected" | "error"
const processingJobs = new Set();

// macOS: que la app no aparezca en el dock; solo tray.
if (process.platform === "darwin" && app.dock) app.dock.hide();

app.whenReady().then(() => {
  createTray();

  if (!hasConfig()) {
    openSetup();
  } else {
    startListening();
  }
});

app.on("window-all-closed", (e) => {
  // Mantener el plugin vivo en el tray aunque cierren la ventana de setup.
  e.preventDefault?.();
});

function hasConfig() {
  return store.get("supabase_url") && store.get("supabase_anon_key") && store.get("tenant_id");
}

function createTray() {
  const iconPath = path.join(__dirname, "..", "assets", "tray.png");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } catch {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray) return;
  const statusLabel =
    connectionStatus === "connected" ? "● Conectado a Supabase"
      : connectionStatus === "error" ? "● Error de conexión"
        : "● Desconectado";

  const menu = Menu.buildFromTemplate([
    { label: `Pida Pues Printer v${app.getVersion()}`, enabled: false },
    { label: statusLabel, enabled: false },
    { type: "separator" },
    { label: "Abrir configuración…", click: openSetup },
    { label: "Reconectar", click: () => { stopListening(); startListening(); } },
    { label: "Imprimir test", click: printTest },
    { type: "separator" },
    { label: "Abrir panel web", click: () => shell.openExternal("https://www.pidapues.com/app") },
    { label: "Salir", click: () => { stopListening(); app.quit(); } },
  ]);
  tray.setToolTip(`Pida Pues Printer — ${statusLabel.replace("● ", "")}`);
  tray.setContextMenu(menu);
}

function setStatus(s) {
  connectionStatus = s;
  refreshTrayMenu();
  setupWindow?.webContents?.send?.("status", s);
}

function openSetup() {
  if (setupWindow) {
    setupWindow.show();
    setupWindow.focus();
    return;
  }
  setupWindow = new BrowserWindow({
    width: 560,
    height: 720,
    title: "Pida Pues Printer — Configuración",
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  setupWindow.loadFile(path.join(__dirname, "renderer", "setup.html"));
  setupWindow.on("closed", () => { setupWindow = null; });
}

ipcMain.handle("config:get", () => ({
  supabase_url: store.get("supabase_url"),
  supabase_anon_key: store.get("supabase_anon_key"),
  tenant_id: store.get("tenant_id"),
  branch_id: store.get("branch_id"),
  printer_interface: store.get("printer_interface"),
  printer_type: store.get("printer_type"),
  status: connectionStatus,
}));

ipcMain.handle("config:save", (_e, cfg) => {
  for (const k of Object.keys(cfg)) store.set(k, cfg[k]);
  stopListening();
  if (hasConfig()) startListening();
  return { ok: true };
});

ipcMain.handle("printer:test", () => printTest());

// ─────────────────────────────────────────────────────────────────────
// Supabase: realtime + polling de respaldo
// ─────────────────────────────────────────────────────────────────────

function startListening() {
  if (!hasConfig()) {
    setStatus("disconnected");
    return;
  }
  try {
    supabase = createClient(store.get("supabase_url"), store.get("supabase_anon_key"), {
      realtime: { params: { eventsPerSecond: 5 } },
    });

    realtimeChannel = supabase
      .channel(`print-jobs-${store.get("tenant_id")}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "print_jobs",
          filter: `tenant_id=eq.${store.get("tenant_id")}`,
        },
        (payload) => {
          const job = payload.new;
          if (!matchesBranch(job)) return;
          processJob(job).catch((err) => console.error("processJob:", err));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setStatus("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setStatus("error");
      });

    // Polling de respaldo cada 15s — agarra cualquier job que el realtime
    // haya perdido (WS desconectado, app dormida, etc.).
    pollingTimer = setInterval(pollPending, 15000);
    pollPending();
  } catch (err) {
    console.error("startListening:", err);
    setStatus("error");
  }
}

function stopListening() {
  if (realtimeChannel) {
    try { supabase?.removeChannel(realtimeChannel); } catch {}
    realtimeChannel = null;
  }
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  supabase = null;
  setStatus("disconnected");
}

function matchesBranch(job) {
  const cfg = store.get("branch_id");
  if (!cfg) return true; // sin branch_id en config → procesa todos los del tenant
  return !job.branch_id || job.branch_id === cfg;
}

async function pollPending() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from("print_jobs")
      .select("id, tenant_id, branch_id, order_id")
      .eq("tenant_id", store.get("tenant_id"))
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .limit(20);
    if (error) throw error;
    setStatus("connected");
    for (const job of data || []) {
      if (matchesBranch(job)) await processJob(job);
    }
  } catch (err) {
    console.error("pollPending:", err);
    setStatus("error");
  }
}

// ─────────────────────────────────────────────────────────────────────
// Procesamiento de un job: lee datos, genera HTML, imprime, marca status.
// ─────────────────────────────────────────────────────────────────────

async function processJob(job) {
  if (processingJobs.has(job.id)) return; // dedup en memoria
  processingJobs.add(job.id);
  try {
    // Re-chequear que sigue pending (otro plugin pudo haberlo agarrado).
    const { data: fresh } = await supabase
      .from("print_jobs")
      .select("status")
      .eq("id", job.id)
      .maybeSingle();
    if (fresh?.status !== "pending") return;

    // Cargar datos del pedido + items + branch settings + tenant en paralelo.
    const [orderR, itemsR, branchR, tenantR, printSettingsR] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, tenant_order_number, customer_name, customer_phone, address, address_details, notes, subtotal, delivery_fee, total, payment_method, payment_status, created_at, branch_id")
        .eq("id", job.order_id)
        .maybeSingle(),
      supabase
        .from("order_items")
        .select("product_name, variant_name, quantity, unit_price, subtotal, toppings, notes")
        .eq("order_id", job.order_id),
      job.branch_id
        ? supabase
            .from("branches")
            .select("legal_name, tax_id, logo_url, invoice_print_compact, invoice_print_logo, invoice_header_message, invoice_footer_message, invoice_qr_text")
            .eq("id", job.branch_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("tenants")
        .select("name, whatsapp, logo_url")
        .eq("id", job.tenant_id)
        .maybeSingle(),
      supabase
        .from("print_settings")
        .select("printer_name, copies, paper_width_mm, silent_mode")
        .eq("tenant_id", job.tenant_id)
        .maybeSingle(),
    ]);

    if (!orderR.data) throw new Error("order_not_found");

    const qrDataUrl = branchR.data?.invoice_qr_text
      ? await QRCode.toDataURL(branchR.data.invoice_qr_text, {
          errorCorrectionLevel: "M", margin: 1, width: 220,
          color: { dark: "#000000", light: "#ffffff" },
        }).catch(() => null)
      : null;

    const html = renderTicket({
      order: orderR.data,
      items: itemsR.data || [],
      tenant: tenantR.data || { name: "Pida Pues", logo_url: null, whatsapp: null },
      branch: branchR.data || null,
      printSettings: printSettingsR.data || { copies: 2, paper_width_mm: 80 },
      qrDataUrl,
    });

    await sendToThermal(html, printSettingsR.data || {});

    await supabase
      .from("print_jobs")
      .update({ status: "printed", printed_at: new Date().toISOString(), notes: "v0.4.0 plugin" })
      .eq("id", job.id);
  } catch (err) {
    console.error("processJob error:", err);
    try {
      await supabase
        .from("print_jobs")
        .update({ status: "failed", notes: String(err?.message || err).slice(0, 500) })
        .eq("id", job.id);
    } catch {}
  } finally {
    processingJobs.delete(job.id);
  }
}

async function sendToThermal(html, _printSettings) {
  // node-thermal-printer no acepta HTML directo — recibe comandos ESC/POS.
  // Para v0.4.0 usamos un BrowserWindow oculto que carga el HTML y dispara
  // window.print() con la impresora elegida. Esto preserva todo el styling
  // del nuevo formato (Poppins, logo, QR como imagen) y delega la traducción
  // a los drivers del SO. Es lo que ya hace el fallback browser de la web,
  // solo que ahora desde el plugin con la impresora correcta seleccionada.
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    const finish = (err) => {
      try { win.destroy(); } catch {}
      err ? reject(err) : resolve();
    };
    win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html))
      .then(() => {
        // Pequeño delay para que las imágenes (logo, QR) terminen de pintarse.
        setTimeout(() => {
          const printerName = store.get("printer_interface") || undefined;
          win.webContents.print(
            {
              silent: true,
              deviceName: printerName && printerName.startsWith("printer:")
                ? printerName.replace(/^printer:/, "")
                : undefined,
              printBackground: false,
              margins: { marginType: "none" },
              pageSize: { width: 80000, height: 297000 }, // 80mm x 297mm en micrones
            },
            (success, failureReason) => {
              success ? finish(null) : finish(new Error(failureReason || "print_failed"));
            },
          );
        }, 600);
      })
      .catch(finish);
  });
}

async function printTest() {
  const html = renderTicket({
    order: {
      id: "test", order_number: 9999, tenant_order_number: 1,
      customer_name: "Cliente de prueba", customer_phone: "+57 300 000 0000",
      address: "Carrera 123 #45-67", address_details: "Apto 101",
      notes: "Esta es una impresión de prueba",
      subtotal: 20000, delivery_fee: 3000, total: 23000,
      payment_method: "cash", payment_status: "approved",
      created_at: new Date().toISOString(), branch_id: null,
    },
    items: [
      { product_name: "Hamburguesa de prueba", variant_name: "Doble", quantity: 1, unit_price: 18000, subtotal: 20000, toppings: [{ name: "Queso extra" }], notes: null },
    ],
    tenant: { name: "Pida Pues", logo_url: null, whatsapp: null },
    branch: null,
    printSettings: { copies: 1, paper_width_mm: 80 },
    qrDataUrl: null,
  });
  try {
    await sendToThermal(html, {});
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
