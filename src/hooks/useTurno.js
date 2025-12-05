import { useState, useCallback } from 'react';

const SHIFT_STATE_KEY = 'shift_state';

const useTurno = (api) => {
  const [shift, setShift] = useState({ isOpen: false, start: null, expenses: [], summary: null });

  // Persistir estado completo en localStorage
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

  // Cargar estado desde localStorage en cualquier momento (idempotente)
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

    // Fallback: compatibilidad con key antigua 'shift_start'
    const start = localStorage.getItem('shift_start');
    setShift(prev => ({ ...prev, isOpen: !!start, start: start ? new Date(start) : prev.start }));
  }, []);

  // Abrir / Cerrar turno
  // forceClose: si true no pide confirmación y cierra el turno (usado desde modal de confirmación)
  const toggle = useCallback((forceClose = false) => {
    setShift(prev => {
      if (prev.isOpen) {
        if (!forceClose && !confirm('¿Cerrar turno?')) return prev;
        // Cerrar turno: marcar isOpen false pero mantener el historial/persistencia del turno en localStorage
        const closed = { ...prev, isOpen: false };
        // Persistir el estado final (podría ser usado como histórico)
        persistShift(closed);
        // NOTA: NO eliminamos SHIFT_STATE_KEY aquí para que la info del turno quede disponible tras logout/browser close.
        return { isOpen: false, start: null, expenses: [], summary: null };
      } else {
        const now = new Date();
        const opened = { ...prev, isOpen: true, start: now };
        // Guardar también compatibilidad con key antigua
        try { localStorage.setItem('shift_start', now.toISOString()); } catch (e) {}
        persistShift(opened);
        return opened;
      }
    });
  }, [persistShift]);

  // Cargar egresos del turno (usa start desde la última versión persistida para evitar condiciones de carrera)
  const loadExpenses = useCallback(async () => {
    // Leer start desde localStorage por si hubo cambios fuera de este closure
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

  const calculateSummary = useCallback(async () => {
    try {
      const raw = JSON.parse(localStorage.getItem(SHIFT_STATE_KEY) || '{}');
      const startISO = raw.start || (shift.start ? shift.start.toISOString() : null);
      if (!startISO) return null;

      const [salesRes, tablesRes] = await Promise.all([
        api.request(`/orders_confirmed?select=total_amount,order_items,created_at&created_at=gte.${startISO}`),
        api.request(`/table_sessions?select=total&status=eq.closed&closed_at=gte.${startISO}`)
      ]);

      const salesArr = salesRes || [];
      const tablesArr = tablesRes || [];

      const totalSales = salesArr.reduce((s, o) => s + (o.total_amount || 0), 0);
      const totalTables = tablesArr.reduce((s, t) => s + (t.total || 0), 0);

      // Cargar gastos desde storage-persisted shift (para consistencia)
      let persisted = {};
      try { persisted = JSON.parse(localStorage.getItem(SHIFT_STATE_KEY) || '{}'); } catch (e) { persisted = {}; }
      const expensesArr = persisted.expenses || shift.expenses || [];
      const totalExpenses = (expensesArr || []).reduce((s, e) => s + (e.cant || 0), 0);

      // Calcular top productos
      const counts = {};
      (salesArr || []).forEach(o => {
        let items = [];
        if (!o.order_items) items = [];
        else if (typeof o.order_items === 'string') {
          try { items = JSON.parse(o.order_items); } catch (e) { items = []; }
        } else items = o.order_items;
        (items || []).forEach(it => {
          const key = it.name || String(it.product_id || 'unknown');
          const qty = Number(it.qty || it.quantity || 0);
          if (!counts[key]) counts[key] = 0;
          counts[key] += qty;
        });
      });

      const topProducts = Object.entries(counts)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);

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

  return { shift, loadStatus, toggle, loadExpenses, addExpense, calculateSummary };
};

export default useTurno;