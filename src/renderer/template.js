// Render del ticket POS — port directo del nuevo formato del proyecto principal
// (src/lib/printTicket.ts -> renderCopy + estilos). Si actualizan el formato
// allá, sincronizarlo acá. Mantener identidad visual entre el preview de
// /admin y lo que sale impreso.
//
// Genera HTML completo (no fragmento) listo para que un BrowserWindow oculto
// haga window.print() con la impresora térmica configurada.

const PAYMENT_LABELS = {
  cash: "Efectivo",
  card: "Tarjeta",
  card_on_delivery: "Datáfono",
  transfer: "Transferencia",
  wompi: "Wompi",
  bold: "Bold",
  nequi: "Nequi",
};

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function formatCOP(n) {
  const v = Math.round(Number(n) || 0);
  return "$" + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDate(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${dd}-${mm}-${yyyy} ${h}:${min} ${ampm}`;
}

function renderCopy({ order, items, tenant, branch, copyLabel, qrDataUrl }) {
  const dateStr = formatDate(order.created_at);
  const dailyNum = order.tenant_order_number
    ? `P-${String(order.tenant_order_number).padStart(3, "0")}`
    : `#${order.order_number}`;

  const showLogo = branch?.invoice_print_logo !== false;
  const logoUrl = branch?.logo_url || tenant.logo_url || null;
  const logoHtml = showLogo && logoUrl
    ? `<div class="ip-logo-wrap"><img class="ip-logo" src="${escapeHtml(logoUrl)}" alt="" onerror="this.parentElement.style.display='none'" /></div>`
    : "";

  const headerLines = branch?.invoice_header_message
    ? branch.invoice_header_message.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    : [tenant.name];
  const headerHtml = headerLines.map((line, i) =>
    `<div class="${i === 0 ? "ip-header-primary" : "ip-header-line"}">${escapeHtml(line)}</div>`,
  ).join("");

  const legalHtml = branch?.legal_name
    ? `<div class="ip-legal">${escapeHtml(branch.legal_name)}${branch.tax_id ? " · NIT " + escapeHtml(branch.tax_id) : ""}</div>`
    : "";

  const itemsHtml = items.map((it) => {
    const tops = Array.isArray(it.toppings) && it.toppings.length
      ? `<div class="ip-item-mods">+ ${it.toppings.map((t) => escapeHtml(t.name || "")).join(", ")}</div>`
      : "";
    const noteHtml = it.notes ? `<div class="ip-item-mods">⚠ ${escapeHtml(it.notes)}</div>` : "";
    const variant = it.variant_name ? ` <span class="ip-variant">(${escapeHtml(it.variant_name)})</span>` : "";
    return `<tr class="ip-item-row">
      <td class="ip-left ip-item-name">
        <div>${escapeHtml(it.product_name)}${variant}</div>
        ${tops}${noteHtml}
      </td>
      <td class="ip-center">${it.quantity}</td>
      <td class="ip-right">${formatCOP(it.subtotal)}</td>
    </tr>`;
  }).join("");

  const paymentLabel = PAYMENT_LABELS[order.payment_method] || order.payment_method;

  const footerHtml = branch?.invoice_footer_message
    ? branch.invoice_footer_message.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        .map((line) => `<div>${escapeHtml(line)}</div>`).join("")
    : `<div>¡Gracias por tu compra!</div>`;

  const qrHtml = qrDataUrl && branch?.invoice_qr_text
    ? `<div class="ip-qr-wrap">
         <img src="${qrDataUrl}" class="ip-qr-img" alt="" />
         <div class="ip-qr-caption">${escapeHtml(branch.invoice_qr_text)}</div>
       </div>`
    : "";

  return `
    <div class="invoice-print invoice-print-80mm">
      ${logoHtml}
      <div class="ip-header">${headerHtml}</div>
      ${legalHtml}
      <div class="ip-copy-label">${escapeHtml(copyLabel)}</div>
      <div class="ip-divider">${"-".repeat(40)}</div>

      <table class="ip-meta">
        <tbody>
          <tr><td>Pedido No.</td><td class="ip-right"><strong>${escapeHtml(dailyNum)}</strong></td></tr>
          <tr><td>Fecha:</td><td class="ip-right">${escapeHtml(dateStr)}</td></tr>
          <tr><td>Cliente:</td><td class="ip-right">${escapeHtml(order.customer_name || "------")}</td></tr>
          <tr><td>Teléfono:</td><td class="ip-right">${escapeHtml(order.customer_phone || "------")}</td></tr>
          <tr><td colspan="2" class="ip-addr">${escapeHtml(order.address || "")}${order.address_details ? "<br><span class='ip-muted'>" + escapeHtml(order.address_details) + "</span>" : ""}</td></tr>
        </tbody>
      </table>

      ${order.notes ? `<div class="ip-divider">${"-".repeat(40)}</div><div class="ip-notes"><strong>Notas:</strong> ${escapeHtml(order.notes)}</div>` : ""}

      <div class="ip-divider">${"-".repeat(40)}</div>

      <table class="ip-items">
        <thead>
          <tr>
            <th class="ip-left">Producto</th>
            <th class="ip-center">Cant.</th>
            <th class="ip-right">Precio</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div class="ip-divider">${"-".repeat(40)}</div>

      <table class="ip-totals">
        <tbody>
          <tr><td>Subtotal</td><td class="ip-right">${formatCOP(order.subtotal)}</td></tr>
          ${order.delivery_fee > 0 ? `<tr><td>Domicilio</td><td class="ip-right">${formatCOP(order.delivery_fee)}</td></tr>` : ""}
          <tr class="ip-total-row"><td><strong>TOTAL</strong></td><td class="ip-right"><strong>${formatCOP(order.total)}</strong></td></tr>
        </tbody>
      </table>

      <div class="ip-divider">${"-".repeat(40)}</div>

      <table class="ip-payment">
        <tbody>
          <tr><td>Método de pago:</td><td class="ip-right">${escapeHtml(paymentLabel)}</td></tr>
          <tr><td>Estado:</td><td class="ip-right">${escapeHtml(order.payment_status)}</td></tr>
        </tbody>
      </table>

      <div class="ip-divider">${"-".repeat(40)}</div>

      <div class="ip-footer">${footerHtml}</div>
      ${qrHtml}
    </div>
  `;
}

function renderTicket({ order, items, tenant, branch, printSettings, qrDataUrl }) {
  const widthMm = printSettings?.paper_width_mm || 80;
  const compact = branch?.invoice_print_compact === true;
  const baseFont = compact ? 9 : 11;

  const copies = Math.max(1, Math.min(5, printSettings?.copies || 2));
  const labels = copies === 1
    ? ["** TICKET **"]
    : copies === 2
      ? ["** COPIA COCINA **", "** COPIA CLIENTE **"]
      : Array.from({ length: copies }, (_, i) => `** COPIA ${i + 1}/${copies} **`);

  const copiesHtml = labels.map((lbl, i) => {
    const isLast = i === labels.length - 1;
    const copy = renderCopy({ order, items, tenant, branch, copyLabel: lbl, qrDataUrl });
    return isLast
      ? copy
      : copy + '<div class="cut">— — — — — corte — — — — —</div><div class="page-break"></div>';
  }).join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Ticket #${order.order_number}</title>
<style>
  @page { size: ${widthMm}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000;
    font-family: 'Poppins', system-ui, 'Courier New', monospace;
    font-size: ${baseFont}px; line-height: 1.4; }
  .invoice-print { width: ${Math.max(40, widthMm - 4)}mm; padding: 2mm; }
  .invoice-print table { width: 100%; border-collapse: collapse; }
  .invoice-print td, .invoice-print th { padding: 0; vertical-align: top; }
  .invoice-print .ip-right { text-align: right; }
  .invoice-print .ip-center { text-align: center; }
  .invoice-print .ip-left { text-align: left; }
  .invoice-print .ip-muted { color: #666; }

  .invoice-print .ip-divider {
    text-align: center; letter-spacing: 1px; color: #000; margin: 3px 0;
    font-family: 'Courier New', monospace; white-space: nowrap; overflow: hidden;
  }
  .invoice-print .ip-logo-wrap { text-align: center; margin-bottom: 4px; }
  .invoice-print .ip-logo {
    max-height: ${compact ? 50 : 70}px; max-width: 90%; object-fit: contain;
    filter: grayscale(1) contrast(1.3);
  }
  .invoice-print .ip-header { text-align: center; line-height: 1.3; }
  .invoice-print .ip-header-primary { font-weight: 700; font-size: ${baseFont + 2}px; }
  .invoice-print .ip-header-line { font-size: ${baseFont - 1}px; }
  .invoice-print .ip-legal { text-align: center; font-size: ${baseFont - 2}px; color: #444; margin-top: 2px; }
  .invoice-print .ip-copy-label { text-align: center; font-size: ${baseFont - 2}px; color: #555; margin-top: 2px; letter-spacing: 1px; }
  .invoice-print .ip-meta td, .invoice-print .ip-payment td { padding: 1px 0; }
  .invoice-print .ip-addr { padding-top: 2px !important; line-height: 1.3; }
  .invoice-print .ip-notes { font-size: ${baseFont - 1}px; padding: 2px 0; }
  .invoice-print .ip-items th {
    font-weight: 700; padding-bottom: 3px; border-bottom: 1px dotted #888;
  }
  .invoice-print .ip-items .ip-item-row td { padding: 2px 0; }
  .invoice-print .ip-item-mods { font-size: ${baseFont - 2}px; color: #444; padding-left: 4px; }
  .invoice-print .ip-variant { color: #555; font-size: ${baseFont - 1}px; }
  .invoice-print .ip-totals td { padding: 1px 0; }
  .invoice-print .ip-total-row td { padding-top: 4px; border-top: 1px solid #000; font-size: ${baseFont + 1}px; }
  .invoice-print .ip-footer { text-align: center; margin-top: 4px; line-height: 1.4; font-size: ${baseFont - 1}px; }
  .invoice-print .ip-qr-wrap { text-align: center; margin-top: 6px; }
  .invoice-print .ip-qr-img { display: inline-block; width: ${compact ? 90 : 110}px; height: ${compact ? 90 : 110}px; }
  .invoice-print .ip-qr-caption { font-size: ${baseFont - 2}px; color: #555; word-break: break-all; margin-top: 2px; }

  .cut { border-top: 1px dashed #000; margin: 8px 0; text-align: center; font-size: ${baseFont - 2}px; color: #555; }
  .page-break { break-after: page; page-break-after: always; height: 0; }
</style></head>
<body>
  ${copiesHtml}
</body></html>`;
}

module.exports = { renderTicket };
