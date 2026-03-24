import { useState, useCallback } from 'react';

const useMesas = (api) => {
  const [tables, setTables] = useState([]);

  const load = useCallback(async () => {
    const sessions = await api.request('/table_sessions?select=*&status=eq.open&order=table_number.asc');
    setTables(sessions || []);
  }, [api]);

  const close = async (id, total) => {
    if (window.confirm(`¿Cerrar mesa y marcar como pagado por ${total}?`)) {
      await api.request(`/table_sessions?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          status: 'closed', 
          closed_at: new Date().toISOString() 
        })
      });
      await load();
      return true;
    }
    return false;
  };

  return { tables, load, close };
};

export default useMesas;