import { formatCurrency, formatDate } from './config';

export function printThermalReceipt(options = {}) {
  const {
    title = 'RECIBO',
    orderNumber = '',
    items = [],
    total = 0,
    customerName = '',
    customerAddress = '',
    note = '',
    footer = ''
  } = options;

  const dateStr = formatDate(new Date().toISOString());

  const escapeHtml = (s = '') =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const itemsHtml = items
    .map((it) => {
      const name = escapeHtml(it.name);
      const qty = it.qty || 0;
      const price = formatCurrency(it.price || 0);
      // Ajustar ancho: qty x name .... price
      return `<div style="display:flex;justify-content:space-between;font-family:monospace;font-size:12px;margin:2px 0">
        <div style="max-width:68%">${qty}x ${name}</div>
        <div style="text-align:right;min-width:80px">${price}</div>
      </div>`;
    })
    .join('\n');

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      @media print {
        @page { margin: 6mm; }
        body { -webkit-print-color-adjust: exact; }
      }
      body {
        width: 320px;
        margin: 0;
        padding: 6px;
        font-family: "Courier New", Courier, monospace;
        color: #000;
        background: #fff;
        font-size: 12px;
      }
      .center { text-align: center; }
      .header { font-weight:700; font-size:14px; margin-bottom:8px; }
      .muted { color:#666; font-size:11px; }
      hr { border: none; border-top: 1px dashed #000; margin:8px 0; }
      .total { display:flex; justify-content:space-between; font-weight:700; font-size:14px; margin-top:6px; }
      .small { font-size:11px; color:#333; }
    </style>
  </head>
  <body>
    <div class="center header">${escapeHtml(title)}</div>
    <div class="center small">${escapeHtml(dateStr)}</div>
    ${orderNumber ? `<div class="center muted">Orden: ${escapeHtml(String(orderNumber))}</div>` : ''}
    <hr/>
    ${customerName || customerAddress ? `
      <div style="margin-bottom:6px">
        ${customerName ? `<div><strong>${escapeHtml(customerName)}</strong></div>` : ''}
        ${customerAddress ? `<div class="muted">${escapeHtml(customerAddress)}</div>` : ''}
      </div>
      <hr/>
    ` : ''}
    <div>
      ${itemsHtml}
    </div>
    <hr/>
    <div class="total"><div>TOTAL</div><div>${formatCurrency(total)}</div></div>
    ${note ? `<div style="margin-top:6px" class="muted">Nota: ${escapeHtml(note)}</div>` : ''}
    ${footer ? `<div style="margin-top:10px" class="center small">${escapeHtml(footer)}</div>` : ''}
  </body>
  </html>
  `;

  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) {
    alert('No se pudo abrir ventana de impresión. Revisa el pop-up blocker.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();

  // Esperar que la ventana renderice antes de imprimir
  w.focus();
  setTimeout(() => {
    try {
      w.print();
      // No cerramos inmediatamente en todos los navegadores para evitar que print sea cancelado
      setTimeout(() => {
        try { w.close(); } catch (e) {}
      }, 800);
    } catch (e) {
      console.error('Error al imprimir', e);
    }
  }, 500);
}