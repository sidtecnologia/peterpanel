import { useState, useCallback } from 'react';

const SHIFT_STATE_KEY = 'shift_state';

const useTurno = (api) => {
  const [shift, setShift] = useState({ isOpen: false, start: null, expenses: [], summary: null });

  const persistShift = useCallback((newShift) => {
    localStorage.setItem(SHIFT_STATE_KEY, JSON.stringify({
      ...newShift,
      start: newShift.start?.toISOString ? newShift.start.toISOString() : newShift.start
    }));
  }, []);

  const loadStatus = useCallback(() => {
    const raw = localStorage.getItem(SHIFT_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      setShift({
        isOpen: !!parsed.isOpen,
        start: parsed.start ? new Date(parsed.start) : null,
        expenses: parsed.expenses || [],
        summary: parsed.summary || null
      });
    }
  }, []);

  const toggle = useCallback((forceClose = false) => {
    setShift(prev => {
      const newState = forceClose ? { isOpen: false, start: null, expenses: [], summary: null } : { ...prev, isOpen: !prev.isOpen, start: !prev.isOpen ? new Date() : null };
      persistShift(newState);
      return newState;
    });
  }, [persistShift]);

  const loadExpenses = useCallback(async () => {
    const data = await api.request('/out_money?order=time.desc');
    setShift(prev => {
      const updated = { ...prev, expenses: data || [] };
      persistShift(updated);
      return updated;
    });
  }, [api, persistShift]);

  const calculateSummary = useCallback(async () => {
    try {
      const [sales, tables] = await Promise.all([
        api.request('/orders_confirmed?select=total_amount,order_items'),
        api.request('/table_sessions?select=total,items&status=eq.closed')
      ]);

      const totalSales = (sales || []).reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
      const totalTables = (tables || []).reduce((acc, t) => acc + Number(t.total || 0), 0);
      const totalExpenses = shift.expenses.reduce((acc, e) => acc + Number(e.cant || 0), 0);

      const counts = {};
      const process = (items) => {
        const parsed = typeof items === 'string' ? JSON.parse(items) : items;
        (parsed || []).forEach(it => {
          const name = it.name || 'Varios';
          counts[name] = (counts[name] || 0) + Number(it.qty || 1);
        });
      };

      sales.forEach(o => process(o.order_items));
      tables.forEach(t => process(t.items));

      const summary = {
        totalSales, totalTables, totalExpenses,
        net: (totalSales + totalTables) - totalExpenses,
        topProducts: Object.entries(counts).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 15)
      };

      setShift(prev => {
        const updated = { ...prev, summary };
        persistShift(updated);
        return updated;
      });
      return summary;
    } catch (e) {
      console.error(e);
    }
  }, [api, shift.expenses, persistShift]);

  return { shift, loadStatus, toggle, loadExpenses, calculateSummary };
};

export default useTurno;