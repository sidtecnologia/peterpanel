import { useState, useCallback } from 'react';

const SHIFT_STATE_KEY = 'shift_state';

const useTurno = (api) => {
  const [shift, setShift] = useState({ isOpen: false, start: null, expenses: [], summary: null });

  const persistShift = useCallback((newShift) => {
    try {
      const toSave = {
        ...newShift,
        start: newShift.start ? (newShift.start instanceof Date ? newShift.start.toISOString() : newShift.start) : null
      };
      localStorage.setItem(SHIFT_STATE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('Error saving shift state', e);
    }
  }, []);

  const loadStatus = useCallback(() => {
    try {
      const raw = localStorage.getItem(SHIFT_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setShift({
          isOpen: !!parsed.isOpen,
          start: parsed.start ? new Date(parsed.start) : null,
                 expenses: parsed.expenses || [],
                 summary: parsed.summary || null
        });
        return;
      }
    } catch (e) {
      console.error('Error reading shift state', e);
    }

    const start = localStorage.getItem('shift_start');
    setShift(prev => ({ ...prev, isOpen: !!start, start: start ? new Date(start) : prev.start }));
  }, []);

  const toggle = useCallback((forceClose = false) => {
    setShift(prev => {
      if (prev.isOpen) {
        if (!forceClose && !confirm('¿Cerrar turno?')) return prev;
        const closed = { ...prev, isOpen: false };
        persistShift(closed);
        return { isOpen: false, start: null, expenses: [], summary: null };
      } else {
        const now = new Date();
        const opened = { ...prev, isOpen: true, start: now };
        try { localStorage.setItem('shift_start', now.toISOString()); } catch (e) {}
        persistShift(opened);
        return opened;
      }
    });
  }, [persistShift]);

  const loadExpenses = useCallback(async () => {
    try {
      const raw = JSON.parse(localStorage.getItem(SHIFT_STATE_KEY) || '{}');
      const startISO = raw.start || (shift.start ? shift.start.toISOString() : null);
      if (!startISO) return;
      const data = await api.request(`/out_money?select=*&time=gte.${startISO}`);
      setShift(prev => {
        const updated = { ...prev, expenses: data || [] };
        persistShift(updated);
        return updated;
      });
    } catch (e) {
      console.error('Error loading expenses', e);
    }
  }, [api, shift.start, persistShift]);

  const addExpense = useCallback(async (data) => {
    await api.request('/out_money', { method: 'POST', body: JSON.stringify({ ...data, time: new Date().toISOString() }) });
    await loadExpenses();
  }, [api, loadExpenses]);

  const removeExpense = useCallback(async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await api.request(`/out_money?id=eq.${id}`, { method: 'DELETE' });
      await loadExpenses();
    } catch (e) {
      console.error('Error deleting expense', e);
    }
  }, [api, loadExpenses]);

  const calculateSummary = useCallback(async () => {
    try {
      const raw = JSON.parse(localStorage.getItem(SHIFT_STATE_KEY) || '{}');
      const startISO = raw.start || (shift.start ? shift.start.toISOString() : null);
      if (!startISO) return null;

      // Traemos items de mesas también para el conteo de productos
      const [salesRes, tablesRes] = await Promise.all([
        api.request(`/orders_confirmed?select=total_amount,order_items,created_at&created_at=gte.${startISO}`),
                                                      api.request(`/table_sessions?select=total,items,status&status=eq.closed&closed_at=gte.${startISO}`)
      ]);

      const salesArr = salesRes || [];
      const tablesArr = tablesRes || [];

      const totalSales = salesArr.reduce((s, o) => s + (o.total_amount || 0), 0);
      const totalTables = tablesArr.reduce((s, t) => s + (t.total || 0), 0);

      let persisted = {};
      try { persisted = JSON.parse(localStorage.getItem(SHIFT_STATE_KEY) || '{}'); } catch (e) { persisted = {}; }
      const expensesArr = persisted.expenses || shift.expenses || [];
      const totalExpenses = (expensesArr || []).reduce((s, e) => s + (e.cant || 0), 0);

      // Calcular top productos unificando Domicilios y Mesas
      const counts = {};

      const processItems = (itemList) => {
        let items = [];
        if (!itemList) return;
        if (typeof itemList === 'string') {
          try { items = JSON.parse(itemList); } catch (e) { items = []; }
        } else {
          items = itemList;
        }

        (items || []).forEach(it => {
          // Normalizar nombre o ID
          const key = it.name || String(it.product_id || 'Var');
          const qty = Number(it.qty || it.quantity || 0);
          if (!counts[key]) counts[key] = 0;
          counts[key] += qty;
        });
      };

      // Procesar Domicilios
      salesArr.forEach(o => processItems(o.order_items));
      // Procesar Mesas
      tablesArr.forEach(t => processItems(t.items));

      const topProducts = Object.entries(counts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty) // Orden descendente
      .slice(0, 15);

      const summary = {
        totalSales,
        totalTables,
        totalExpenses,
        net: (totalSales + totalTables) - totalExpenses,
                                       topProducts
      };

      setShift(prev => {
        const updated = { ...prev, summary };
        persistShift(updated);
        return updated;
      });

      return summary;
    } catch (e) {
      console.error('Error calculating summary', e);
      throw e;
    }
  }, [api, shift.expenses, shift.start, persistShift]);

  return { shift, loadStatus, toggle, loadExpenses, addExpense, removeExpense, calculateSummary };
};

export default useTurno;
