import { useState, useCallback, useEffect } from 'react';

const usePedidos = (api, statusFilter = 'Pendiente', fetchInterval = null) => {
  const [orders, setOrders] = useState([]);

  const load = useCallback(async () => {
    try {
      if (statusFilter === 'Despacho') {
        const confirmed = await api.request('/orders_confirmed?select=*&order_status=neq.Despachado&order=created_at.asc');
        const confirmedArr = (confirmed || []).map(c => ({ ...c, _origin: 'confirmed' }));

        const allOrders = await api.request('/orders?select=*&order=created_at.asc');
        const tableOrders = (allOrders || []).filter(o => {
          if (o?.order_status === 'Despachado') return false;
          const ca = String(o?.customer_address || '').trim();
          return /^\d{1,2}$/.test(ca);
        }).map(o => ({ ...o, _origin: 'table' }));

        setOrders([...confirmedArr, ...tableOrders]);
      } else if (statusFilter === 'Completados') {
        const data = await api.request('/orders_confirmed?select=*&order_status=eq.Despachado&order=created_at.desc&limit=30');
        setOrders(data || []);
      } else {
        const data = await api.request('/orders?select=*&order_status=eq.Pendiente&order=created_at.desc');
        const onlyToTakeAway = (data || []).filter(o => {
          const ca = String(o?.customer_address || '').trim();
          return !(/^\d{1,2}$/.test(ca));
        });
        setOrders(onlyToTakeAway);
      }
    } catch (e) {
      console.error('Error en load pedidos:', e);
    }
  }, [api, statusFilter]);

  const updateStatus = async (id, updates) => {
    await api.request(`/orders?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    await load();
  };

  const cancelOrder = async (id, origin) => {
    const table = origin === 'confirmed' ? 'orders_confirmed' : 'orders';
    await api.request(`/${table}?id=eq.${id}`, { method: 'DELETE' });
    await load();
  };

  const dispatchOrder = async (order) => {
    try {
      if (order._origin === 'confirmed') {
        await api.request(`/orders_confirmed?id=eq.${order.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ order_status: 'Despachado' })
        });
      } else {
        await api.request(`/orders?id=eq.${order.id}`, { 
          method: 'PATCH', 
          body: JSON.stringify({ order_status: 'Despachado' }) 
        });
        const payload = { ...order, order_status: 'Despachado' };
        delete payload.id;
        delete payload._origin;
        if (!payload.created_at) payload.created_at = new Date().toISOString();
        await api.request('/orders_confirmed', { method: 'POST', body: JSON.stringify(payload) });
      }
      await load();
    } catch (e) {
      console.error('Error al despachar:', e);
    }
  };

  useEffect(() => {
    load();
    if (fetchInterval) {
      const i = setInterval(load, fetchInterval);
      return () => clearInterval(i);
    }
  }, [load, fetchInterval]);

  return { orders, load, updateStatus, dispatchOrder, cancelOrder };
};

export default usePedidos;