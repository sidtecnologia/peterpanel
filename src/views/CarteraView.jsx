import { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { FileText } from 'lucide-react';
import Badge from '../components/ui/Badge';
import { formatCurrency } from '../lib/config';


const CarteraView = ({ api }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState([]); // combined entries
  const [loading, setLoading] = useState(false);

  // Helper para construir filtros de fecha para each endpoint
  const buildOrdersConfirmedUrl = (start, end) => {
    let url = `/orders_confirmed?select=*&order=created_at.desc`;
    if (start) url += `&created_at=gte.${start}T00:00:00`;
    if (end) url += `&created_at=lte.${end}T23:59:59`;
    return url;
  };

  const buildTableSessionsUrl = (start, end) => {
    let url = `/table_sessions?select=*&status=eq.closed&order=closed_at.desc`;
    if (start) url += `&closed_at=gte.${start}T00:00:00`;
    if (end) url += `&closed_at=lte.${end}T23:59:59`;
    return url;
  };

  const load = async () => {
    setLoading(true);
    try {
      // Pedir ambas fuentes en paralelo
      const [ordersConfirmedRes, tableSessionsRes] = await Promise.all([
        api.request(buildOrdersConfirmedUrl(startDate, endDate)),
        api.request(buildTableSessionsUrl(startDate, endDate))
      ]);

      const ordersConfirmed = ordersConfirmedRes || [];
      const tableSessions = tableSessionsRes || [];

      // Mapear orders_confirmed como tipo 'web'
      const webEntries = (ordersConfirmed || []).map(o => ({
        id: o.id,
        type: 'Llevar',
        created_at: o.created_at,
        customer: o.customer_name || '',
        state: o.order_status || o.payment_status || '',
        total: Number(o.total_amount || 0),
        raw: o
      }));

      // Mapear table_sessions como tipo 'mesa' (usar closed_at como fecha)
      const mesaEntries = (tableSessions || []).map(t => ({
        id: t.id,
        type: 'mesa',
        created_at: t.closed_at || t.opened_at || null,
        customer: t.table_number ? `Mesa ${t.table_number}` : (t.customer_address || `Mesa ${t.id}`),
        state: 'Mesa Cobrada',
        total: Number(t.total || 0),
        raw: t
      }));

      // Combinar y ordenar por fecha descendente
      const combined = [...webEntries, ...mesaEntries].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });

      setData(combined);
    } catch (e) {
      console.error('Error cargando datos de cartera', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, startDate, endDate]);

  const total = data.reduce((sum, entry) => sum + (Number(entry.total || 0)), 0);

  const exportCsv = () => {
    const header = ['Tipo,ID,Fecha,Cliente,Estado,Total'];
    const rows = (data || []).map(d => {
      const fecha = d.created_at ? new Date(d.created_at).toISOString() : '';
      return `${d.type},${d.id},${fecha},"${(d.customer||'').replace(/"/g, '""')}",${(d.state||'').replace(/,/g,'')},${d.total}`;
    });
    const csv = header.concat(rows).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `cartera_${startDate || 'desde_inicio'}_${endDate || 'hasta_fin'}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h2 className="text-2xl font-bold">Cartera</h2>
        <div className="text-right bg-white p-3 rounded-xl border shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Total</p>
          <p className="text-2xl font-bold text-indigo-600">{formatCurrency(total)}</p>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-4 mb-6 items-end">
          <div className="flex flex-col">
            <label className="text-xs text-slate-500 mb-1">Fecha inicio</label>
            <input type="date" className="border rounded px-3 py-2" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-slate-500 mb-1">Fecha fin</label>
            <input type="date" className="border rounded px-3 py-2" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="secondary" onClick={load} disabled={loading}>Filtrar</Button>
            <Button variant="secondary" icon={FileText} onClick={exportCsv} disabled={loading || data.length === 0}>CSV</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Tipo / Estado</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data || []).map((d) => (
                <tr key={`${d.type}_${d.id}`} className="hover:bg-slate-50">
                  <td className="p-3">{d.created_at ? new Date(d.created_at).toLocaleString() : '-'}</td>
                  <td className="p-3"><Badge color={d.type === 'mesa' ? 'green' : (d.type === 'Llevar' ? 'yellow' : 'red')}>{d.type === 'mesa' ? 'Mesa' : 'Llevar'}</Badge> <span className="ml-2">{d.state}</span></td>
                  <td className="p-3 text-right">{formatCurrency(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default CarteraView;