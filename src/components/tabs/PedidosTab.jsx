import { useEffect, useState } from 'react';
import { CheckCircle, Trash2, Eye, Printer, Send, Clock, CheckCircle2 } from 'lucide-react';
import usePedidos from '../../hooks/usePedidos';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { formatCurrency, formatDate } from '../../lib/config';
import { printThermalReceipt } from '../../lib/thermalPrint';

const PedidosTab = ({ api }) => {
  const [activeTab, setActiveTab] = useState('Pendiente');
  const { orders, load, updateStatus, dispatchOrder, cancelOrder } = usePedidos(api, activeTab);
  const [selected, setSelected] = useState(null);

  useEffect(() => { load(); }, [load, activeTab]);

  const handlePrint = (o) => {
    const items = typeof o.order_items === 'string' ? JSON.parse(o.order_items) : o.order_items;
    printThermalReceipt({
      title: 'ORDEN DE VENTA',
      orderNumber: o.id,
      items: items.map(i => ({ qty: i.qty, name: i.name, price: i.price })),
      total: o.total_amount || o.total,
      customerName: o.customer_name,
      customerAddress: o.customer_address,
      footer: '¡Gracias por su preferencia!'
    });
  };

  const parseItems = (o) => {
    if (!o?.order_items) return [];
    return typeof o.order_items === 'string' ? JSON.parse(o.order_items) : o.order_items;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit mb-4">
        <Button 
          variant={activeTab === 'Pendiente' ? 'primary' : 'ghost'} 
          onClick={() => setActiveTab('Pendiente')}
          icon={Clock}
        >
          Para Confirmar
        </Button>
        <Button 
          variant={activeTab === 'Completados' ? 'success' : 'ghost'} 
          onClick={() => setActiveTab('Completados')}
          icon={CheckCircle2}
        >
          Ya Despachados
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map(o => (
          <Card key={o.id} className={`border-l-4 ${activeTab === 'Pendiente' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-slate-800">{o.customer_name}</h3>
                <p className="text-xs font-black text-indigo-600 uppercase">{o.customer_address}</p>
              </div>
              <Badge color={activeTab === 'Pendiente' ? 'yellow' : 'green'}>
                {activeTab === 'Pendiente' ? 'Pendiente' : 'Despachado'}
              </Badge>
            </div>

            <div className="text-sm text-slate-500 mb-4 h-12 overflow-hidden italic">
              {parseItems(o).map(i => `${i.qty}x ${i.name}`).join(', ')}
            </div>

            <div className="flex flex-wrap gap-2">
              {activeTab === 'Pendiente' && (
                <>
                  <Button variant="success" className="flex-1" icon={CheckCircle} onClick={() => updateStatus(o.id, { order_status: 'Preparado' })}>
                    Confirmar
                  </Button>
                  <Button variant="primary" icon={Send} onClick={() => dispatchOrder(o)} title="Despachar Directo" />
                </>
              )}
              <Button variant="secondary" icon={Printer} onClick={() => handlePrint(o)} />
              <Button variant="secondary" icon={Eye} onClick={() => setSelected(o)} />
              <Button variant="danger" icon={Trash2} onClick={() => { if(confirm('¿Eliminar pedido?')) cancelOrder(o.id, o._origin); }} />
            </div>
          </Card>
        ))}
      </div>

      {selected && (
        <Modal title={`Detalle Pedido #${selected.id}`} onClose={() => setSelected(null)}>
          <div className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">{formatDate(selected.created_at)}</span>
              <span className="font-bold text-emerald-600 text-lg">{formatCurrency(selected.total_amount)}</span>
            </div>
            <ul className="divide-y max-h-60 overflow-y-auto">
              {parseItems(selected).map((item, i) => (
                <li key={i} className="py-2 flex justify-between">
                  <span><strong className="text-indigo-600">{item.qty}x</strong> {item.name}</span>
                  <span>{formatCurrency(item.price * item.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-4">
              <Button variant="secondary" className="flex-1" onClick={() => { handlePrint(selected); setSelected(null); }}>Imprimir</Button>
              {activeTab === 'Pendiente' && (
                <Button variant="success" className="flex-1" onClick={() => { dispatchOrder(selected); setSelected(null); }}>Despachar Ahora</Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PedidosTab;