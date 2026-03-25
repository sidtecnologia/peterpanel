import { useState, useCallback } from 'react';



const useMesas = (api) => {
  const [tables, setTables] = useState([]);

  const load = useCallback(async () => {
    // 1) Obtener sesiones abiertas
    const sessions = await api.request('/table_sessions?select=*&status=eq.open&order=opened_at.asc');
    const sessArray = sessions || [];

    if (sessArray.length === 0) {
      setTables([]);
      return;
    }

    // 2) Obtener customer_address de orders (sin asumir relación por id)
    let orders = [];
    try {
      // Traemos solo customer_address para procesarlo en cliente
      orders = await api.request('/orders?select=customer_address');
    } catch (e) {
      console.error('Error fetching orders for mesas filter', e);
      orders = [];
    }

    // 3) Construir set de customer_address válidos (1 o 2 dígitos, < 99)
    const validAddresses = new Set();
    (orders || []).forEach(o => {
      const ca = o?.customer_address;
      if (ca === null || ca === undefined) return;

      // Normalizar a string
      const s = String(ca).trim();
      if (/^\d{1,2}$/.test(s)) {
        const n = Number(s);
        if (Number.isInteger(n) && n >= 0 && n < 99) {
          // Guardar como string para comparación con session.table_number/customer_address
          validAddresses.add(s);
        }
      }
    });

    // 4) Filtrar sesiones: si session.table_number o session.customer_address coincide con un customer_address válido
    const filtered = sessArray.filter(s => {
      // Extraer posibles identificadores de mesa de la sesión
      const tn = s?.table_number;
      const ca = s?.customer_address;

      // Normalizar a string y comprobar en set
      if (tn !== undefined && tn !== null) {
        if (validAddresses.has(String(tn).trim())) return true;
      }
      if (ca !== undefined && ca !== null) {
        if (validAddresses.has(String(ca).trim())) return true;
      }

      // Si no coincide con órdenes numéricas, no mostrar esta sesión en Mesas
      return false;
    });

    setTables(filtered);
  }, [api]);

  const close = async (id, total) => {
    if (confirm(`¿Cerrar y cobrar mesa por ${total}?`)) {
      await api.request(`/table_sessions?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'closed', closed_at: new Date().toISOString() })
      });
      await load();
      return true;
    }
    return false;
  };

  return { tables, load, close };
};

export default useMesas;