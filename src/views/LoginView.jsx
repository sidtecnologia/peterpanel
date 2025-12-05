import { useState } from 'react';
import { Utensils, XCircle } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const LoginView = ({ onLogin, loading, error }) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [role, setRole] = useState('caja');

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <div className="text-center mb-8"><div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"><Utensils className="text-indigo-600" size={32}/></div><h1 className="text-2xl font-bold">Comida Rápida</h1></div>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-6 flex items-center gap-2"><XCircle size={16}/> {error}</div>}
        <div className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg" placeholder="Email"/>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full px-4 py-2 border rounded-lg" placeholder="Contraseña"/>
          <div className="grid grid-cols-3 gap-2">{['caja', 'despacho', 'cartera'].map(r => <button key={r} onClick={() => setRole(r)} className={`py-2 text-sm rounded capitalize ${role === r ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>{r}</button>)}</div>
          <Button onClick={() => onLogin(email, pass, role)} className="w-full" disabled={loading}>{loading ? '...' : 'Ingresar'}</Button>
        </div>
      </Card>
    </div>
  );
};

export default LoginView;