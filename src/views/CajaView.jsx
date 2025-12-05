import { useState } from 'react';
import { Utensils, ShoppingBag, Clock, DollarSign } from 'lucide-react';
import MesasTab from '../components/tabs/MesasTab';
import ProductosTab from '../components/tabs/ProductosTab';
import PedidosTab from '../components/tabs/PedidosTab';
import TurnoTab from '../components/tabs/TurnoTab';

const CajaView = ({ api, token }) => {
  const [tab, setTab] = useState('mesas');
  const tabs = {
    mesas: { icon: Utensils, label: 'Mesas', Comp: MesasTab },
    productos: { icon: ShoppingBag, label: 'Productos', Comp: ProductosTab },
    pedidos: { icon: Clock, label: 'Pedidos', Comp: PedidosTab },
    turno: { icon: DollarSign, label: 'Caja', Comp: TurnoTab }
  };
  const ActiveComp = tabs[tab].Comp;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {Object.entries(tabs).map(([k, v]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${tab === k ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
            <v.icon size={18} /> {v.label}
          </button>
        ))}
      </div>
      <ActiveComp api={api} token={token} />
    </div>
  );
};

export default CajaView;