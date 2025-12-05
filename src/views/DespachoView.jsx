import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import usePedidos from '../hooks/usePedidos';
import { RefreshCw } from 'lucide-react';
import { formatDate } from '../lib/config';

const DespachoView = ({ api }) => {
  
  const { orders, load, updateStatus, dispatchOrder } = usePedidos(api, 'Despacho', 5000);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Cocina</h2><Button onClick={load} variant="secondary" icon={RefreshCw}>Actualizar</Button></div>
      <div className="space-y-4">
        {orders.length === 0 ? <p className="text-center text-slate-400 py-10">Todo despachado.</p> : orders.map(o => (
          <Card key={o.id} className="border-l-4 border-l-orange-500">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div>
                <div className="flex gap-2 mb-1"><span className="text-xs font-bold bg-orange-100 text-orange-800 px-2 rounded">#{String(o.id).slice(0,6)}</span><span className="text-xs text-slate-400">{formatDate(o.created_at)}</span></div>
                <h3 className="text-lg font-bold">{o.customer_name}</h3>
                {o.observation && <div className="bg-yellow-50 text-yellow-800 p-2 rounded text-sm mb-2 mt-1">Note: {o.observation}</div>}
                <div className="text-sm text-slate-600">{typeof o.order_items === 'string' ? JSON.parse(o.order_items).map(i=>`${i.qty}x ${i.name}`).join(', ') : (o.order_items||[]).map(i=>`${i.qty}x ${i.name}`).join(', ')}</div>
                {/* Mostrar indicación si viene de mesa */}
                {o._origin === 'table' && <div className="mt-2 text-xs text-slate-500">Origen: Mesa {o.customer_address}</div>}
              </div>
              <Button onClick={() => dispatchOrder(o)}>Despachar</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DespachoView;