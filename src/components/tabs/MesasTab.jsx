import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import useMesas from '../../hooks/useMesas';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { formatCurrency, formatDate } from '../../lib/config';
import { printThermalReceipt } from '../../lib/thermalPrint';

const MesasTab = ({ api }) => {
  const { tables, load, close } = useMesas(api);
  const [selected, setSelected] = useState(null);

  useEffect(() => { load(); }, [load]);

  const handlePrint = (mesa) => {
    const items = (mesa.items || []).map(i => ({ qty: i.qty, name: i.name, price: i.price }));
    printThermalReceipt({
      title: 'FACTURA - DONDE PETER',
      orderNumber: mesa.table_number || mesa.customer_address || mesa.id,
      items,
      total: mesa.total || 0,
      customerName: mesa.customer_name || '',
      customerAddress: mesa.customer_address || '',
      note: mesa.note || '',
      footer: 'Gracias por su compra'
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tables.length === 0 ? <p className="text-slate-400 col-span-3 text-center py-10">No hay mesas abiertas.</p> : 
        tables.map(t => (
          <Card key={t.id} className="border-l-4 border-l-emerald-500 hover:shadow-lg transition-shadow">
            <div className="flex justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">Mesa {t.table_number || t.customer_address || t.customer_address}</h3>
                <p className="text-xs text-slate-500">{formatDate(t.opened_at)}</p>
              </div>
              <Badge color="green">Abierta</Badge>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mb-4">{formatCurrency(t.total)}</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 text-sm" onClick={() => setSelected(t)}>Detalle</Button>
              <Button variant="danger" className="flex-1 text-sm" onClick={() => close(t.id, t.total)}>Cobrar</Button>
            </div>
          </Card>
        ))}
      </div>

      {selected && (
        <Modal title={`Mesa ${selected.table_number || selected.customer_address}`} onClose={() => setSelected(null)}>
          <div className="space-y-4 mb-6">
            <ul className="divide-y divide-slate-100">
              {(selected.items || []).map((item, i) => (
                <li key={i} className="flex justify-between py-2 text-sm">
                  <span><strong className="text-indigo-600">{item.qty}x</strong> {item.name}</span>
                  <span>{formatCurrency(item.price * item.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between pt-4 border-t font-bold text-xl">
              <span>TOTAL</span>
              <span className="text-emerald-600">{formatCurrency(selected.total)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" icon={Printer} onClick={() => handlePrint(selected)}>Imprimir</Button>
            <Button variant="danger" onClick={async () => { if (await close(selected.id, selected.total)) setSelected(null); }}>Cobrar</Button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default MesasTab;
