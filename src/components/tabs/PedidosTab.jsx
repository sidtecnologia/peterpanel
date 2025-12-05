import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Printer } from 'lucide-react';
import usePedidos from '../../hooks/usePedidos';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { formatCurrency, formatDate } from '../../lib/config';
import { printThermalReceipt } from '../../lib/thermalPrint';

// Tiempo que se oculta el botón domiciliario (ms)
const DOMI_HIDE_MS = 10 * 60 * 1000;

const PedidosTab = ({ api }) => {
  const { orders, load, updateStatus } = usePedidos(api, 'Pendiente');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedHist, setSelectedHist] = useState(null);
  const [domiMap, setDomiMap] = useState({}); // orderId -> timestamp

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Cargar historial de pedidos cobrados (orders_confirmed)
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        // Se obtiene listado de pedidos confirmados/cobrados
        const data = await api.request('/orders_confirmed?select=*&order=created_at.desc');
        setHistory(data || []);
      } catch (e) {
        console.error('Error cargando historial', e);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();

    // Inicializar domiMap desde localStorage
    const map = {};
    (JSON.parse(localStorage.getItem('domi_sent_map') || '{}') || {});
    // Also check individual keys fallback (in case saved separately)
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('domic_sent_')) {
        const id = k.replace('domic_sent_', '');
        const ts = Number(localStorage.getItem(k) || 0);
        if (ts) map[id] = ts;
      }
    });
    // If there is a serialized map, merge it
    try {
      const serialized = JSON.parse(localStorage.getItem('domi_sent_map') || '{}');
      Object.assign(map, serialized);
    } catch (e) { /* ignore */ }
    setDomiMap(map);
  }, [api]);

  const handleConfirm = (o) => updateStatus(o.id, { payment_status: 'Confirmado', order_status: 'Pendiente' });
  const handleReject = (o) => updateStatus(o.id, { payment_status: 'Rechazado' });

  const parseItems = (o) => {
    if (!o) return [];
    if (typeof o.order_items === 'string') {
      try { return JSON.parse(o.order_items); } catch (e) { return []; }
    }
    return o.order_items || [];
  };

  const handlePrintOrder = (o) => {
    const items = parseItems(o).map(i => ({ qty: i.qty, name: i.name, price: i.price }));
    printThermalReceipt({
      title: 'FACTURA - DONDE PETER',
      orderNumber: o.id,
      items,
      total: o.total_amount || 0,
      customerName: o.customer_name || '',
      customerAddress: o.customer_address || '',
      note: o.observation || '',
      footer: 'Gracias por su compra'
    });
  };

  const handleDomiciliario = (o) => {
    // Construir mensaje con información útil
    const items = parseItems(o);
    const lines = items.map(i => `${i.qty}x ${i.name}`).join(', ');
    const total = formatCurrency(o.total_amount || 0);
    const message = `Recojo pedido:
ID: ${o.id}
Cliente: ${o.customer_name || ''}
Dirección: ${o.customer_address || ''}
Teléfono: ${o.customer_phone || o.customer_tel || ''}
Items: ${lines}
Total: ${total}
Por favor confirmar recepción.`;

    // Abrir WhatsApp Web con mensaje (no número fijo): usa wa.me/?text=
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    // Guardar timestamp en localStorage y en estado para ocultar botón 10 minutos
    const ts = Date.now();
    const key = `domic_sent_${o.id}`;
    try {
      localStorage.setItem(key, String(ts));
      // Also keep a serialized map to ease restore
      const existingSerialized = JSON.parse(localStorage.getItem('domi_sent_map') || '{}');
      existingSerialized[o.id] = ts;
      localStorage.setItem('domi_sent_map', JSON.stringify(existingSerialized));
    } catch (e) { /* ignore */ }

    setDomiMap(prev => ({ ...prev, [o.id]: ts }));
  };

  const isDomiHidden = (orderId) => {
    const ts = domiMap[orderId] || Number(localStorage.getItem(`domic_sent_${orderId}`) || 0);
    if (!ts) return false;
    return (Date.now() - ts) < DOMI_HIDE_MS;
  };

  // Opcional: permitir refrescar historial
  const refreshHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await api.request('/orders_confirmed?select=*&order=created_at.desc');
      setHistory(data || []);
    } catch (e) {
      console.error('Error actualizando historial', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Pedidos Entrantes</h3>
        {orders.length === 0 ? <p className="text-slate-400 text-center py-10">No hay pedidos entrantes.</p> :
        orders.map(o => (
          <Card key={o.id} className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">#{String(o.id).slice(0,8)}</span>
                <span className="text-sm text-slate-500">{formatDate(o.created_at)}</span>
              </div>
              <h4 className="font-bold text-lg">{o.customer_name}</h4>
              <p className="text-slate-600 text-sm">{o.customer_address}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge color="yellow">Pendiente Pago</Badge>
                <span className="font-bold text-lg">{formatCurrency(o.total_amount)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="success" icon={CheckCircle} onClick={() => handleConfirm(o)}>Confirmar</Button>
              <Button variant="danger" icon={XCircle} onClick={() => handleReject(o)}>Rechazar</Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="pt-6 border-t">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Historial - Pedidos Cobrados</h3>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={refreshHistory} disabled={loadingHistory}>Actualizar</Button>
          </div>
        </div>

        {history.length === 0 ? <p className="text-slate-400 text-center py-10">No hay pedidos cobrados.</p> :
        history.map(h => (
          <Card key={h.id} className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">#{String(h.id).slice(0,8)}</span>
                <span className="text-sm text-slate-500">{formatDate(h.created_at)}</span>
              </div>
              <h4 className="font-bold text-lg">{h.customer_name}</h4>
              <p className="text-slate-600 text-sm">{h.customer_address}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge color={h.order_status === 'Despachado' ? 'green' : 'gray'}>{h.order_status || 'Cobrado'}</Badge>
                <span className="font-bold text-lg">{formatCurrency(h.total_amount)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setSelectedHist(h)}>Detalle</Button>
              <Button variant="secondary" icon={Printer} onClick={() => handlePrintOrder(h)}>Imprimir</Button>
              {!isDomiHidden(h.id) && <Button variant="primary" onClick={() => handleDomiciliario(h)}>Pedir domiciliario</Button>}
            </div>
          </Card>
        ))}
      </div>

      {/* Modal detalle pedido entrante (si lo deseas para orders) */}
      {selected && (
        <Modal title={`Pedido ${selected.id}`} onClose={() => setSelected(null)}>
          <div className="space-y-4 mb-6">
            <ul className="divide-y divide-slate-100">
              {parseItems(selected).map((item, i) => (
                <li key={i} className="flex justify-between py-2 text-sm">
                  <span><strong className="text-indigo-600">{item.qty}x</strong> {item.name}</span>
                  <span>{formatCurrency(item.price * item.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between pt-4 border-t font-bold text-xl">
              <span>TOTAL</span>
              <span className="text-emerald-600">{formatCurrency(selected.total_amount)}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSelected(null)}>Cerrar</Button>
            <Button variant="secondary" onClick={() => { handlePrintOrder(selected); setSelected(null); }}>Imprimir</Button>
          </div>
        </Modal>
      )}

      {/* Modal detalle pedido historial */}
      {selectedHist && (
        <Modal title={`Pedido ${selectedHist.id}`} onClose={() => setSelectedHist(null)}>
          <div className="space-y-4 mb-6">
            <ul className="divide-y divide-slate-100">
              {parseItems(selectedHist).map((item, i) => (
                <li key={i} className="flex justify-between py-2 text-sm">
                  <span><strong className="text-indigo-600">{item.qty}x</strong> {item.name}</span>
                  <span>{formatCurrency(item.price * item.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between pt-4 border-t font-bold text-xl">
              <span>TOTAL</span>
              <span className="text-emerald-600">{formatCurrency(selectedHist.total_amount)}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSelectedHist(null)}>Cerrar</Button>
            <Button variant="secondary" onClick={() => { handlePrintOrder(selectedHist); setSelectedHist(null); }}>Imprimir</Button>
            {!isDomiHidden(selectedHist.id) && <Button variant="primary" onClick={() => { handleDomiciliario(selectedHist); setSelectedHist(null); }}>Pedir domiciliario</Button>}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PedidosTab;