import React, { useState, useEffect } from 'react';
import { User, LogOut, Utensils } from 'lucide-react';
import useApi from './hooks/useApi';
import { CONFIG, API_URLS } from './lib/config';
import CajaView from './views/CajaView';
import DespachoView from './views/DespachoView';
import CarteraView from './views/CarteraView';
import LoginView from './views/LoginView';

export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem('sb_token');
    const r = localStorage.getItem('app_role');
    if (t && r) { setSession({ access_token: t }); setRole(r); }
  }, []);

  const api = useApi(session?.access_token);

  const login = async (email, password, selectedRole) => {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch(`${API_URLS.AUTH}/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SB_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || "Error de auth");

    localStorage.setItem('sb_token', data.access_token);
    localStorage.setItem('app_role', selectedRole);

    setSession(data);
    setRole(selectedRole);
  } catch (e) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
};

  const logout = () => {
    // Eliminar solo las credenciales de sesión, preservar keys como shift_state para mantener datos del turno
    try {
      localStorage.removeItem('sb_token');
      localStorage.removeItem('app_role');
      // Mantener SHIFT_STATE_KEY deliberadamente para preservar turno abierto/historial
    } catch (e) {
      console.error('Error during logout cleanup', e);
    }
    setSession(null);
    setRole(null);
  };

  if (!session) return <LoginView onLogin={login} loading={loading} error={error} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3"><div className="bg-indigo-600 p-1.5 rounded text-white"><Utensils size={20}/></div><span className="font-bold text-xl hidden sm:block">Comida Rápida</span><span className="bg-slate-100 text-xs px-2 py-1 rounded uppercase font-bold">{role}</span></div>
          <div className="flex gap-4 items-center"><span className="hidden sm:flex gap-2 text-sm text-slate-500"><User size={16}/> {session.user?.email}</span><button onClick={logout} className="text-slate-400 hover:text-red-500"><LogOut size={20}/></button></div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {role === 'caja' && <CajaView api={api} token={session.access_token} />}
        {role === 'despacho' && <DespachoView api={api} />}
        {role === 'cartera' && <CarteraView api={api} />}
      </main>
    </div>
  );
}