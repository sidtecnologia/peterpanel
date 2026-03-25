import { useState, useCallback, useEffect } from 'react';


const usePedidos = (api, statusFilter = 'Pendiente', fetchInterval = null) => {
  const [orders, setOrders] = useState([]);

  const load = useCallback(async () => {
    try {
      if (statusFilter === 'Despacho') {
        // 1) Pedidos confirmados (fuente principal) que no estén despachados
        const confirmed = await api.request('/orders_confirmed?select=*&order_status=neq.Despachado&order=created_at.asc');
        const confirmedArr = (confirmed || []).map(c => ({ ...c, _origin: 'confirmed' }));

        // 2) Pedidos de la tabla orders (potenciales mesas) que no estén despachados
        const allOrders = await api.request('/orders?select=*&order=created_at.asc');
        const tableOrders = (allOrders || []).filter(o => {
          // excluir ya despachados si existe el campo order_status
          if (o && o.order_status === 'Despachado') return false;

          const ca = o?.customer_address;
          if (ca === null || ca === undefined) return false;
          const s = String(ca).trim();
          if (/^\d{1,2}$/.test(s)) {
            const n = Number(s);
            return Number.isInteger(n) && n >= 0 && n < 99;
          }
          return false;
        }).map(o => ({ ...o, _origin: 'table' }));

        // 3) Evitar duplicados por id: si aparece en confirmed lo ignoramos de tableOrders
        const confirmedIds = new Set((confirmedArr || []).map(c => c.id));
        const combined = [
          ...(confirmedArr || []),
          ...(tableOrders || []).filter(o => !confirmedIds.has(o.id))
        ];

        setOrders(combined);
        return;
      }

      // Comportamiento previo para otros filtros (p. ej. 'Pendiente')
      let endpoint = `/orders?select=*&order=created_at.desc&payment_status=eq.${statusFilter}`;
      const data = await api.request(endpoint);
      const filtered = statusFilter === 'Pendiente'
        ? (data || []).filter(o => !/^\d{1,2}$/.test(String(o.customer_address || '').trim()))
        : (data || []);
      setOrders(filtered);
    } catch (e) {
      console.error('Error loading orders', e);
      setOrders([]);
    }
  }, [api, statusFilter]);

  useEffect(() => {
    load();
    if (fetchInterval) {
      const id = setInterval(load, fetchInterval);
      return () => clearInterval(id);
    }
  }, [load, fetchInterval]);

  const updateStatus = async (id, payload, isConfirmedTable = false) => {
    const endpoint = isConfirmedTable ? 'orders_confirmed' : 'orders';
    await api.request(`/${endpoint}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    await load();
  };

  /**
   * dispatchOrder
   * - Si viene de 'confirmed' => parchea orders_confirmed.id y lo marca Despachado
   * - Si viene de 'table' => parchea orders.id (order_status='Despachado') y además inserta
   *   una copia en orders_confirmed para que pase al historial.
   */
  const dispatchOrder = async (order) => {
    if (!order || !order.id) return;
    try {
      if (order._origin === 'confirmed') {
        // Simplemente marcar en orders_confirmed como Despachado
        await updateStatus(order.id, { order_status: 'Despachado' }, true);
        return;
      }

      if (order._origin === 'table') {
        // 1) Marcar en orders como Despachado para que desaparezca de cocina (tableOrders)
        await api.request(`/orders?id=eq.${order.id}`, { method: 'PATCH', body: JSON.stringify({ order_status: 'Despachado' }) });

        // 2) Insertar en orders_confirmed una copia del pedido para historial
        // Preparamos payload copiando campos excepto id (para evitar colisiones).
        const payload = { ...order };
        delete payload.id;
        // Si el backend no acepta campos específicos, puedes filtrar/normalizar aquí.
        // Añadimos created_at si no existe para mantener orden cronológico
        if (!payload.created_at) payload.created_at = new Date().toISOString();

        await api.request('/orders_confirmed', { method: 'POST', body: JSON.stringify(payload) });

        // 3) Recargar lista para reflejar cambios
        await load();
        return;
      }

      // Si no se conoce el origen, intentar marcar en orders_confirmed por seguridad
      await updateStatus(order.id, { order_status: 'Despachado' }, true);
    } catch (e) {
      console.error('Error dispatching order', e);
      // rethrow si quieres manejar en UI
      throw e;
    }
  };

  return { orders, load, updateStatus, dispatchOrder };
};

export default usePedidos;