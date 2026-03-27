import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Printer } from 'lucide-react';
import usePedidos from '../../hooks/usePedidos';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { formatCurrency, formatDate } from '../../lib/config';
import { printThermalReceipt } from '../../lib/thermalPrint';

const PedidosTab = ({ api }) => {
  const { orders, load, updateStatus } = usePedidos(api, 'Pendiente');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedHist, setSelectedHist] = useState(null);

  useEffect(() => { load(); }, [load]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await api.request('/orders_confirmed?select=*&order=created_at.desc');
      setHistory(data || []);
    } catch (e) {
      console.error('Error cargando historial', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
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
      title: '--- CALLEJEROS ---',
      orderNumber: o.id,
      items,
      total: o.total_amount || 0,
      customerName: o.customer_name || '',
      customerAddress: o.customer_address || '',
      note: o.observation || '',
      footer: 'GRACIAS POR PREFERIRNOS'
    });
  };

  const handleDespacho = async (o) => {
    try {
      await updateStatus(o.id, { order_status: 'Despachado' }, true);
      await fetchHistory();
    } catch (e) {
      console.error('Error al actualizar estado a despachado', e);
    }
  };

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
        <h3 className="text-lg font-bold">Domicilios Entrantes</h3>
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
          <h3 className="text-lg font-bold">Historial | Pedidos Confirmados</h3>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={refreshHistory} disabled={loadingHistory}>Actualizar</Button>
          </div>
        </div>

        {history.length === 0 ? <p className="text-slate-400 text-center py-10">No hay pedidos Confirmados.</p> :
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
              {h.order_status !== 'Despachado' && (
                <Button variant="primary" onClick={() => handleDespacho(h)}>Pedido Listo</Button>
              )}
            </div>
          </Card>
        ))}
      </div>

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
            {selectedHist.order_status !== 'Despachado' && (
              <Button variant="primary" onClick={() => { handleDespacho(selectedHist); setSelectedHist(null); }}>Pedir domiciliario</Button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PedidosTab;