// dispatch-refresh.js
// Se engancha a las funciones/tabla de despacho de admin.js, añade botón de "Actualizar", auto-refresh cada 3s
(function () {
    // Tiempo entre refrescos (ms)
    const REFRESH_INTERVAL = 3000;

    // Interval id
    let _despachoIntervalId = null;

    // Spinner / estado UI
    const showSpinner = (show) => {
        const s = document.getElementById('despacho-refresh-spinner');
        if (!s) return;
        s.classList.toggle('hidden', !show);
    };

    // Escape HTML to avoid inyección, luego convertimos saltos de línea en <br>
    const escapeHtml = (unsafe) => {
        if (unsafe === null || unsafe === undefined) return '';
        const str = String(unsafe);
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    // Render personalizado y seguro para la tabla de despacho.
    // Este método reemplazará a generateOrderTableDespacho cuando sea posible.
    function myGenerateOrderTableDespacho(data) {
        const container = document.getElementById('orders-list-despacho');
        if (!container) return;

        container.innerHTML = '';

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No hay órdenes.</p>';
            attachDispatchListeners(); // attach listeners a botones que pudiera haber
            return;
        }

        // Crear tabla accesible y responsiva simple
        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-gray-200';

        const thead = document.createElement('thead');
        thead.className = 'bg-gray-50';
        thead.innerHTML = `
            <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Cliente</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Teléfono</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Observación</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Estado</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Acciones</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-gray-200';

        data.forEach(order => {
            const tr = document.createElement('tr');

            // ID
            const tdId = document.createElement('td');
            tdId.className = 'px-3 py-2 text-sm text-gray-700';
            tdId.textContent = order.id ?? order.order_id ?? '';
            tr.appendChild(tdId);

            // Cliente
            const tdCliente = document.createElement('td');
            tdCliente.className = 'px-3 py-2 text-sm text-gray-700';
            tdCliente.textContent = order.customer_name ?? order.client ?? order.name ?? '';
            tr.appendChild(tdCliente);

            // Teléfono
            const tdPhone = document.createElement('td');
            tdPhone.className = 'px-3 py-2 text-sm text-gray-700';
            // Mostrar como texto simple
            tdPhone.textContent = order.phone ?? order.telephone ?? '';
            tr.appendChild(tdPhone);

            // Observación (render seguro con saltos de línea)
            const tdObs = document.createElement('td');
            tdObs.className = 'px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap';
            const rawObs = order.observation ?? order.obs ?? order.note ?? '';
            // Escape y convertir saltos de línea a <br>
            const safeHtml = escapeHtml(rawObs).replace(/\r\n|\r|\n/g, '<br>');
            tdObs.innerHTML = safeHtml;
            tr.appendChild(tdObs);

            // Estado
            const tdStatus = document.createElement('td');
            tdStatus.className = 'px-3 py-2 text-sm text-gray-700';
            tdStatus.textContent = order.status ?? order.state ?? '';
            tr.appendChild(tdStatus);

            // Acciones
            const tdActions = document.createElement('td');
            tdActions.className = 'px-3 py-2 text-sm text-gray-700';
            // Botón 'Despachado' (si existe dispatchOrder lo llamamos)
            const btn = document.createElement('button');
            btn.className = 'px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700';
            btn.textContent = 'Marcar Despachado';
            btn.setAttribute('data-order-id', order.id ?? order.order_id ?? '');
            btn.addEventListener('click', async (e) => {
                const id = btn.getAttribute('data-order-id');
                if (!id) return;
                // Si existe función global dispatchOrder (del admin.js), la llamamos.
                if (typeof window.dispatchOrder === 'function') {
                    try {
                        await window.dispatchOrder(id);
                        // Forzamos recarga tras marcar despachado
                        setTimeout(() => {
                            if (typeof refreshDespacho === 'function') refreshDespacho();
                            else manualRefresh();
                        }, 300);
                    } catch (err) {
                        console.error('dispatchOrder error', err);
                    }
                } else {
                    console.log('dispatchOrder no disponible; envia petición manual para order id', id);
                }
            });
            tdActions.appendChild(btn);
            tr.appendChild(tdActions);

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        container.appendChild(table);

        attachDispatchListeners();
    }

    // Attach listeners para elementos de despacho si necesitas más acciones
    function attachDispatchListeners() {
        // placeholder: si posteriormente deseas enlazar otros botones
    }

    // Intento de refresco: preferimos usar la función del admin.js si existe
    function manualRefresh() {
        // Mostrar spinner
        showSpinner(true);
        const done = () => setTimeout(() => showSpinner(false), 350);

        // Si admin.js expuso una función loadOrdersDespacho (mejor), la usamos
        if (typeof window.loadOrdersDespacho === 'function') {
            try {
                const r = window.loadOrdersDespacho();
                // Si devuelve una promesa, esperar para quitar spinner
                if (r && typeof r.then === 'function') {
                    r.then(done).catch(err => { console.error(err); done(); });
                } else {
                    done();
                }
            } catch (err) {
                console.error(err);
                done();
            }
            return;
        }

        // Si admin.js no expuso la función, podemos intentar disparar un evento personalizado (si admin.js lo escucha)
        const event = new CustomEvent('request-despacho-refresh');
        window.dispatchEvent(event);
        // quitamos spinner pasados 600ms como fallback
        setTimeout(() => showSpinner(false), 600);
    }

    // Inicia autocada 3s (solo si la vista despacho está visible)
    function startAutoRefresh() {
        if (_despachoIntervalId) return;
        _despachoIntervalId = setInterval(() => {
            const despachoView = document.getElementById('despacho-view');
            if (!despachoView) return;
            // Comprobamos visibilidad: offsetParent !== null o display !== 'none'
            const visible = despachoView.offsetParent !== null && window.getComputedStyle(despachoView).display !== 'none';
            if (visible) {
                manualRefresh();
            }
        }, REFRESH_INTERVAL);
        // Hacer una primera carga inmediata
        manualRefresh();
    }

    function stopAutoRefresh() {
        if (_despachoIntervalId) {
            clearInterval(_despachoIntervalId);
            _despachoIntervalId = null;
        }
    }

    // Observador que arranca/parará el auto-refresh según visibilidad del despacho-view
    function observeDespachoVisibility() {
        const despachoView = document.getElementById('despacho-view');
        if (!despachoView) return;

        // Si ya visible al inicio, arrancamos
        const visibleNow = despachoView.offsetParent !== null && window.getComputedStyle(despachoView).display !== 'none';
        if (visibleNow) startAutoRefresh();

        const mo = new MutationObserver(() => {
            const visible = despachoView.offsetParent !== null && window.getComputedStyle(despachoView).display !== 'none';
            if (visible) startAutoRefresh();
            else stopAutoRefresh();
        });

        mo.observe(despachoView, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    // Inicializar botón de refresco
    function initRefreshButton() {
        const btn = document.getElementById('despacho-refresh-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            manualRefresh();
        });
    }

    // Se intenta enganchar al admin.js: si exporta generateOrderTableDespacho y loadOrdersDespacho, los sobreescribimos/usamos.
    function bootstrapHook() {
        // Si admin.js dejó funciones en window, las usamos; si no, dejamos que admin.js haga su trabajo
        if (typeof window.generateOrderTableDespacho === 'function') {
            // Reemplazamos la generación por la nuestra (segura) — admin.js debe llamar generateOrderTableDespacho(data)
            window._original_generateOrderTableDespacho = window.generateOrderTableDespacho;
            window.generateOrderTableDespacho = myGenerateOrderTableDespacho;
            console.info('dispatch-refresh: generateOrderTableDespacho reemplazada por versión segura.');
        } else {
            console.info('dispatch-refresh: generateOrderTableDespacho no encontrada en window. Si admin.js no expone la función, la corrección de render puede no aplicarse automáticamente.');
        }

        // Si admin.js no expuso loadOrdersDespacho al window, no podemos invocarlo directamente desde aquí.
        if (typeof window.loadOrdersDespacho !== 'function') {
            console.warn('dispatch-refresh: loadOrdersDespacho no encontrada en window. Manual refresh enviará evento "request-despacho-refresh". Puedes agregar un listener en admin.js para responder a ese evento y llamar a loadOrdersDespacho().');
        }

        // Inicializamos botón y observer
        initRefreshButton();
        observeDespachoVisibility();
    }

    // Poll para inicializar hasta que admin.js esté cargado (timeout 5s).
    let attempts = 0;
    const maxAttempts = 50;
    const poll = setInterval(() => {
        attempts++;
        // Si admin.js ya ha expuesto funciones en window — arrancamos inmediatamente
        // También arrancamos aunque no exista, porque queremos al menos ligar botón y observer
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            bootstrapHook();
            clearInterval(poll);
            return;
        }
        if (attempts >= maxAttempts) {
            // Como fallback, arrancamos de todas formas para registrar botón y observer
            bootstrapHook();
            clearInterval(poll);
        }
    }, 100);

    // Exportar una función global para forzar refresh desde otros lugares
    window.refreshDespacho = manualRefresh;
    window.startDespachoAutoRefresh = startAutoRefresh;
    window.stopDespachoAutoRefresh = stopAutoRefresh;
})();