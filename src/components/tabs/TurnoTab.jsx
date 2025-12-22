import { useEffect, useState } from 'react';
import { DollarSign, RefreshCw, Printer, Trash2 } from 'lucide-react';
import useTurno from '../../hooks/useTurno';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { formatCurrency, formatDate } from '../../lib/config';
import { printThermalReceipt } from '../../lib/thermalPrint';

const TurnoTab = ({ api }) => {
  const { shift, loadStatus, toggle, loadExpenses, addExpense, removeExpense, calculateSummary } = useTurno(api);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (shift.isOpen) {
      loadExpenses();
    }
  }, [shift.isOpen, loadExpenses]);

  const handleRequestClose = async () => {
    setIsCalculating(true);
    try {
      await calculateSummary();
      setShowCloseModal(true);
    } catch (e) {
      alert('Error al calcular resumen. Revisa consola.');
      console.error(e);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleConfirmClose = async () => {
    toggle(true);
    setShowCloseModal(false);
  };

  const handlePrintSummary = () => {
    const s = shift.summary || {};
    const items = [];
    items.push({ qty: '', name: 'Domicilios Confirmados', price: s.totalSales || 0 });
    items.push({ qty: '', name: 'Mesas Cobradas', price: s.totalTables || 0 });
    items.push({ qty: '', name: 'Egresos', price: -(s.totalExpenses || 0) });
    const top = (s.topProducts || []).map(tp => ({ qty: tp.qty, name: tp.name, price: 0 }));
    printThermalReceipt({
      title: 'RESUMEN DE TURNO',
      orderNumber: shift.start ? formatDate(shift.start) : '',
                        items: [...items, ...top],
                        total: s.net || 0,
                        customerName: '',
                        customerAddress: '',
                        note: '',
                        footer: 'Resumen generado por sistema'
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <Card>
    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><DollarSign className="text-amber-500" /> Control de Turno</h3>
    <div className="flex justify-between items-center mb-6 bg-slate-50 p-4 rounded-lg">
    <div>
    <p className="text-sm text-slate-500">Estado Actual</p>
    <p className={`font-bold ${shift.isOpen ? 'text-emerald-600' : 'text-red-500'}`}>{shift.isOpen ? `Abierto (${formatDate(shift.start)})` : 'Cerrado'}</p>
    </div>
    <Button variant={shift.isOpen ? 'danger' : 'success'} onClick={() => shift.isOpen ? handleRequestClose() : toggle()}>{shift.isOpen ? (isCalculating ? 'Cargando...' : 'Cerrar') : 'Abrir'}</Button>
    </div>

    {shift.isOpen && (
      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); addExpense({ name: fd.get('name'), cant: Number(fd.get('cant')), detail: fd.get('detail'), position: fd.get('position') }); e.target.reset(); }} className="space-y-3">
      <h4 className="font-medium text-slate-700">Registrar Gasto</h4>
      <input name="name" placeholder="Responsable (Nombre)" required className="w-full border rounded p-2 text-sm" />
      <div className="flex gap-2"><input name="position" placeholder="Cargo" className="flex-1 border rounded p-2 text-sm" /><input name="cant" type="number" placeholder="Valor" required className="flex-1 border rounded p-2 text-sm" /></div>
      <input name="detail" placeholder="Motivo / Detalle del gasto" className="w-full border rounded p-2 text-sm" />
      <Button className="w-full" variant="secondary" type="submit">Registrar</Button>
      </form>
    )}
    </Card>

    <Card>
    <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">Resumen de Caja</h3><Button variant="ghost" onClick={async () => { setIsCalculating(true); try { await calculateSummary(); } catch (e) { console.error(e); } finally { setIsCalculating(false); } }}><RefreshCw size={16} /></Button></div>
    {shift.isOpen && shift.summary ? (
      <div className="space-y-3">
      <div className="flex justify-between p-2 hover:bg-slate-50 rounded"><span className="text-slate-600">Domicilios Confirmados</span><span className="font-medium">{formatCurrency(shift.summary.totalSales)}</span></div>
      <div className="flex justify-between p-2 hover:bg-slate-50 rounded"><span className="text-slate-600">Mesas Cobradas</span><span className="font-medium">{formatCurrency(shift.summary.totalTables)}</span></div>

      <div className="p-2 bg-red-50 text-red-700 rounded">
      <div className="flex justify-between font-bold mb-2">
      <span>Total Egresos</span>
      <span>-{formatCurrency(shift.summary.totalExpenses)}</span>
      </div>
      <div className="mt-2 space-y-2">
      {(shift.expenses || []).length > 0 ? (shift.expenses.map(exp => (
        <div key={exp.id} className="text-xs border-b border-red-100 pb-2 last:border-0">
        <div className="flex justify-between items-start">
        <div className="flex flex-col">
        <span className="font-bold uppercase text-[10px] text-red-800">Resp: {exp.name}</span>
        <span className="italic">Motivo: {exp.detail || 'Sin motivo'}</span>
        </div>
        <div className="flex items-center gap-2">
        <span className="font-bold">{formatCurrency(exp.cant)}</span>
        <button type="button" onClick={() => removeExpense(exp.id)} className="p-1 hover:bg-red-200 rounded text-red-700"><Trash2 size={14}/></button>
        </div>
        </div>
        </div>
      ))) : <span className="text-xs opacity-60 italic">Sin egresos registrados</span>}
      </div>
      </div>

      <div className="flex justify-between pt-3 border-t font-bold text-xl text-emerald-600"><span>NETO</span><span>{formatCurrency(shift.summary.net)}</span></div>

      <div className="mt-4 pt-4 border-t">
      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Más vendidos (Global)</h4>
      {(shift.summary.topProducts || []).map((p, idx) => (
        <div key={idx} className="text-xs flex justify-between py-1 border-b border-dashed border-slate-100 last:border-0">
        <span>{p.name}</span>
        <span className="font-medium bg-slate-100 px-1 rounded">{p.qty}u</span>
        </div>
      ))}
      </div>

      <div className="mt-4 flex gap-2">
      <Button variant="secondary" icon={Printer} onClick={handlePrintSummary}>Imprimir resumen</Button>
      </div>
      </div>
    ) : <p className="text-slate-400 text-center py-10">{shift.isOpen ? 'Resumen no disponible. Actualice.' : 'Turno cerrado.'}</p>}
    </Card>

    {showCloseModal && shift.summary && (
      <Modal title="Resumen antes de cerrar turno" onClose={() => setShowCloseModal(false)}>
      <div className="space-y-4 mb-6">
      <div className="flex justify-between p-2"><span>Domicilios</span><strong>{formatCurrency(shift.summary.totalSales)}</strong></div>
      <div className="flex justify-between p-2"><span>Mesas</span><strong>{formatCurrency(shift.summary.totalTables)}</strong></div>
      <div className="flex justify-between p-2 text-red-600"><span>Egresos</span><strong>-{formatCurrency(shift.summary.totalExpenses)}</strong></div>
      <div className="flex justify-between p-2 border-t font-bold text-xl text-emerald-600"><span>NETO</span><span>{formatCurrency(shift.summary.net)}</span></div>
      </div>
      <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={() => setShowCloseModal(false)}>Cancelar</Button>
      <Button variant="danger" onClick={handleConfirmClose}>Confirmar cierre</Button>
      </div>
      </Modal>
    )}
    </div>
  );
};

export default TurnoTab;
