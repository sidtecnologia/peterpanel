// --- CONFIGURACIÓN DE SUPABASE ---
        const SB_URL = "https://ndqzyplsiqigsynweihk.supabase.co"; // ¡Reemplaza con tu URL!
        const SB_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kcXp5cGxzaXFpZ3N5bndlaWhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODQyOTQ4MiwiZXhwIjoyMDc0MDA1NDgyfQ.LYocdE6jGG5B-0n_2Ke0nUpkrAKC7iBBRV7RmgjATD8";

        const BASE_API_URL = `${SB_URL}/rest/v1`;
        const AUTH_API_URL = `${SB_URL}/auth/v1`;
        const STORAGE_BUCKET = "donde_peter";
        const STORAGE_API_URL = `${SB_URL}/storage/v1/object/public/${STORAGE_BUCKET}`;

        // --- ESTADO GLOBAL ---
        let currentUserId = null;
        let currentUserRole = null;
        let authToken = null;
        let productsData = []; 
        let carteraData = []; 
        
        // Variables de estado para el modal de productos
        let fileToUpload = null; 
        let currentProduct = null; // Almacena el producto que se está editando

        const DEFAULT_IMG_URL = "https://placehold.co/40x40/cccccc/000000?text=IMG";

        // --- INTEGRACIÓN: LÓGICA DE WHATSAPP (AHORA EN ESTE ARCHIVO) ---
        (function (window) {
          let DOMICILIARIO_PHONE = '573227671829'

          const MAX_MINUTES = 120; // máximo 120 minutos

          function isEligibleForWhatsapp(order) {
            if (!order) return false;

            // Normalizar estado para evitar espacios / mayúsculas
            const status = String(order.order_status || '').trim().toLowerCase();
            if (status !== 'despachado') return false;

            // created_at puede venir como ISO string, timestamp numérico, o campo distinto
            let createdVal = order.created_at ?? order.createdAt ?? order.created_ad ?? null;
            if (createdVal == null) return false;

            let createdTime = NaN;
            if (typeof createdVal === 'number') {
              // timestamp (segundos o ms?) asumimos ms si > 10^12, si no, lo consideramos segundos.
              createdTime = createdVal > 1e12 ? createdVal : (createdVal * 1000);
            } else if (typeof createdVal === 'string') {
              // intentar parsear ISO u otros formatos
              createdTime = Date.parse(createdVal);
              if (isNaN(createdTime)) {
                // intentar parsear si es un número en string
                const n = Number(createdVal);
                if (!isNaN(n)) createdTime = n > 1e12 ? n : n * 1000;
              }
            } else if (createdVal instanceof Date) {
              createdTime = createdVal.getTime();
            }

            if (isNaN(createdTime)) return false;

            const diffMs = Date.now() - createdTime;
            return diffMs <= MAX_MINUTES * 60 * 1000;
          }

          function sanitizePhone(phone) {
            if (!phone) return '';
            return String(phone).replace(/[^+\d]/g, '');
          }

          function formatAmount(amount) {
            if (amount == null || amount === '') return '';
            // Ajusta formato si quieres miles/centavos; por defecto lo mostramos como $valor
            try {
              if (typeof amount === 'number') return `$${amount.toLocaleString('es-CO')}`;
              return `$${amount}`;
            } catch {
              return `$${amount}`;
            }
          }

          function whatsappTextForOrder(order) {
            const name = order.customer_name || '';
            const address = order.customer_address || '';
            const amount = formatAmount(order.total_amount);
            const lines = [
              ` la dirección ${address}`,
              `a nombre de: ${name}`,
              `Total del pedido: ${amount}`
            ];
            return encodeURIComponent(lines.join('\n'));
          }

          function makeWhatsappHref(order, phoneOverride) {
            const text = whatsappTextForOrder(order);
            let phone = phoneOverride || DOMICILIARIO_PHONE || '';
            phone = sanitizePhone(phone);
            if (phone) {
              // wa.me necesita el número sin '+'
              if (phone.startsWith('+')) phone = phone.slice(1);
              return `https://wa.me/${phone}?text=Por%20favor%20buscar%20un%20pedido%20en%20Comidas%20R%C3%A1pidas%20Donde%20Peter%20para%20entregar%20en%3A${text}`;
            } else {
              return `https://wa.me/?text=${text}`;
            }
          }

          function createButtonElement(order, phoneOverride) {
            if (!isEligibleForWhatsapp(order)) return null;
            const a = document.createElement('a');
            a.className = 'ml-2 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-150 inline-block';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.href = makeWhatsappHref(order, phoneOverride);
            a.title = 'Domicilio';
            a.textContent = 'Domicilio';
            // atributo para evitar duplicados al re-renderizar
            a.setAttribute('data-wa-order-id', order.id);
            return a;
          }

          // API pública
          window.whatsappContact = {
            isEligibleForWhatsapp,
            createButtonElement,
            makeWhatsappHref,
            setDomiciliarioPhone: (phone) => { DOMICILIARIO_PHONE = sanitizePhone(phone); }
          };
        })(window);

        // --- FUNCIONES DE UTILIDAD ---

        const setView = (viewId, show) => {
            const element = document.getElementById(viewId);
            if (element) {
                element.style.display = show ? 'block' : 'none';
            }
        };

        const logError = (message) => {
            const errorElement = document.getElementById('login-error');
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            console.error("ERROR:", message);
            setTimeout(() => errorElement.style.display = 'none', 5000);
        };

        const convertToCSV = (data) => {
            if (data.length === 0) return '';
            
            const exportFields = ['customer_name', 'created_at', 'payment_method', 'total_amount'];
            const headersMap = {
                customer_name: 'Cliente',
                created_at: 'Fecha',
                payment_method: 'Método de pago',
                total_amount: 'Total'
            };
            
            const headers = exportFields.map(field => headersMap[field]).join(',');
            
            const rows = data.map(obj => exportFields.map(field => {
                let val = obj[field];
                if (field === 'total_amount') val = val.toLocaleString('es-CO');
                if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) return `"${val.replace(/"/g, '""')}"`;
                return val;
            }).join(','));
            
            return [headers, ...rows].join('\n');
        };

        // --- FUNCIÓN DE PETICIÓN GENÉRICA CON BACKOFF ---
        const makeRequest = async (url, options = {}, retries = 3) => {
            const headers = {
                'Content-Type': 'application/json',
                'apikey': SB_ANON_KEY,
                ...options.headers
            };

            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const config = { ...options, headers };

            for (let i = 0; i < retries; i++) {
                try {
                    const response = await fetch(url, config);

                    if (response.ok) {
                        const contentType = response.headers.get("content-type");
                        if (contentType && contentType.includes("application/json")) {
                            return response.json();
                        }
                        return response.text().then(text => (text ? JSON.parse(text) : {}));
                    }

                    if (response.status === 401 || response.status === 403) {
                        throw new Error("Acceso denegado o sesión expirada.");
                    }

                    const errorText = await response.text();
                    throw new Error(`Error ${response.status}: ${errorText}`);

                } catch (error) {
                    if (i === retries - 1) {
                        throw error;
                    }
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }
        };

        // --- FUNCIONES DE AUTENTICACIÓN Y VISTAS ---

        const handleLogin = async (role) => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            currentUserRole = role; 

            try {
                const response = await fetch(`${AUTH_API_URL}/token?grant_type=password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SB_ANON_KEY,
                    },
                    body: JSON.stringify({ email, password })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error_description || "Credenciales incorrectas.");
                }

                const data = await response.json();
                authToken = data.access_token;
                currentUserId = data.user.id;
                localStorage.setItem('authToken', authToken);

                initUserView(role);

            } catch (error) {
                console.error("Fallo de autenticación:", error);
                logError(error.message || "Fallo en la conexión. Revisa las credenciales.");
                currentUserRole = null;
            }
        };

        const handleLogout = () => {
            authToken = null;
            currentUserId = null;
            currentUserRole = null;
            localStorage.removeItem('authToken');
            setView('header-nav', false);
            setView('content-views', false);
            document.querySelectorAll('.user-view').forEach(el => el.style.display = 'none');
            setView('login-view', true);
        };
        
        const initUserView = (role) => {
            setView('login-view', false);
            setView('header-nav', true);
            setView('content-views', true);
            
            const userInfo = document.getElementById('user-info');
            userInfo.textContent = `Rol: ${role.toUpperCase()}`;
            
            document.querySelectorAll('.user-view').forEach(el => el.style.display = 'none');
            const viewId = `${role}-view`;
            setView(viewId, true);

            switch (role) {
                case 'caja':
                    showCajaSection('productos');
                    document.getElementById('caja-btn-productos').onclick = () => showCajaSection('productos');
                    document.getElementById('caja-btn-pedidos').onclick = () => showCajaSection('pedidos');
                    document.getElementById('caja-btn-pendientes').onclick = () => showCajaSection('pendientes');
                    // nuevo botón para egresos/cierre
                    const egBtn = document.getElementById('caja-btn-egresos');
                    if (egBtn) egBtn.onclick = () => showCajaSection('egresos');
                    break;
                case 'despacho':
                    loadOrdersDespacho();
                    break;
                case 'cartera':
                    loadOrdersCartera();
                    break;
            }
        };

        // --- FUNCIONES DE CAJA (products) ---

        const showCajaSection = (section) => {
            const prodSection = document.getElementById('caja-section-productos');
            const pedSection = document.getElementById('caja-section-pedidos');
            const pendSection = document.getElementById('caja-section-pendientes');
            const egSection = document.getElementById('caja-section-egresos');

            const btnProd = document.getElementById('caja-btn-productos');
            const btnPed = document.getElementById('caja-btn-pedidos');
            const btnPend = document.getElementById('caja-btn-pendientes');
            const btnEg = document.getElementById('caja-btn-egresos');

            // Normalizar clases de botones (evitar replace que puede fallar)
            const setInactive = (btn) => {
                if (!btn) return;
                btn.className = 'px-6 py-2 rounded-lg font-semibold shadow-md bg-gray-200 text-gray-800 hover:bg-gray-300';
            };
            const setActive = (btn, colorClasses) => {
                if (!btn) return;
                btn.className = `px-6 py-2 rounded-lg font-semibold shadow-md ${colorClasses} text-white`;
            };

            setInactive(btnProd);
            setInactive(btnPed);
            setInactive(btnPend);
            setInactive(btnEg);

            if (section === 'productos') {
                setView(prodSection.id, true);
                setView(pedSection.id, false);
                setView(pendSection.id, false);
                setView(egSection.id, false);
                setActive(btnProd, 'bg-red-500 hover:bg-red-600');
                loadProducts(); 
            } else if (section === 'pedidos') {
                setView(prodSection.id, false);
                setView(pedSection.id, true);
                setView(pendSection.id, false);
                setView(egSection.id, false);
                setActive(btnPed, 'bg-blue-500 hover:bg-blue-600');
                loadOrdersCaja(); 
            } else if (section === 'pendientes') {
                setView(prodSection.id, false);
                setView(pedSection.id, false);
                setView(pendSection.id, true);
                setView(egSection.id, false);
                setActive(btnPend, 'bg-indigo-600 hover:bg-indigo-700');
                loadOrdersPendientes();
            } else if (section === 'egresos') {
                setView(prodSection.id, false);
                setView(pedSection.id, false);
                setView(pendSection.id, false);
                setView(egSection.id, true);
                setActive(btnEg, 'bg-yellow-600 hover:bg-yellow-700');
                loadOutMoney();
                // mostrar/ocultar elementos de turno según estado
                toggleShiftUI(isShiftOpen());
                if (isShiftOpen()) loadShiftSummary();
            }
        };

        const loadProducts = async () => {
            const filters = [];
            const stockFilter = document.getElementById('stock-filter').value;
            const searchTerm = document.getElementById('product-search').value.toLowerCase();

            if (stockFilter === 'in_stock') filters.push('stock=gt.0');
            if (stockFilter === 'out_stock') filters.push('stock=eq.0');

            const selectFields = 'id,name,price,stock,isOffer,image,featured,bestSeller';
            const filterQuery = filters.length > 0 ? '&' + filters.join('&') : '';
            const url = `${BASE_API_URL}/products?select=${selectFields}${filterQuery}`;

            try {
                productsData = await makeRequest(url);

                let filteredData = productsData;
                if (searchTerm) {
                    filteredData = productsData.filter(p =>
                        p.name.toLowerCase().includes(searchTerm)
                    );
                }

                const tableHTML = generateProductTable(filteredData);
                document.getElementById('products-list').innerHTML = tableHTML;
                attachProductListeners();
            } catch (e) {
                document.getElementById('products-list').innerHTML = `<p class="text-red-500">Error al cargar productos: ${e.message}</p>`;
                console.error("Error al cargar productos:", e.message);
            }
        };

        const generateProductTable = (data) => {
            let html = `
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imagen</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Oferta</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
            `;
            data.forEach(p => {
                const imgUrl = (Array.isArray(p.image) && p.image.length > 0) ? p.image[0] : DEFAULT_IMG_URL;
                html += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-3 py-4 whitespace-nowrap text-sm font-medium">
                            <img src="${imgUrl}" alt="Miniatura" class="w-10 h-10 object-cover rounded-md" onerror="this.src='${DEFAULT_IMG_URL}'">
                        </td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${p.name}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500">$${p.price}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm ${p.stock > 0 ? 'text-green-600' : 'text-red-600' }">${p.stock}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500">${p.isOffer ? 'Sí' : 'No'}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm font-medium">
                            <button data-id="${p.id}" data-action="edit" class="text-indigo-600 hover:text-indigo-900 mr-2">Editar</button>
                            <button data-id="${p.id}" data-action="delete" class="text-red-600 hover:text-red-900">Eliminar</button>
                        </td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
            return html;
        };

        const attachProductListeners = () => {
            document.querySelectorAll('#products-list button[data-action]').forEach(button => {
                button.onclick = async () => {
                    const id = button.getAttribute('data-id');
                    const action = button.getAttribute('data-action');
                    const [product] = await makeRequest(`${BASE_API_URL}/products?id=eq.${id}&select=*`);

                    if (action === 'delete') {
                        await deleteProduct(id);
                        loadProducts();
                    } else if (action === 'edit') {
                        showProductModal(product);
                    }
                };
            });
            document.getElementById('add-product-btn').onclick = () => showProductModal(null);
            document.getElementById('stock-filter').onchange = loadProducts;
            document.getElementById('product-search').oninput = loadProducts;
        };

        const deleteProduct = async (id) => {
            try {
                await makeRequest(`${BASE_API_URL}/products?id=eq.${id}`, { method: 'DELETE' });
                console.log(`Producto ${id} eliminado con éxito.`); 
            } catch (e) {
                console.error(`Error al eliminar producto ${id}: ${e.message}`);
                logError(`Error al eliminar el producto.`);
            }
        };

        // --- INICIO DEL BLOQUE DE CÓDIGO DE PRODUCTOS (CORREGIDO) ---

        const showProductModal = (product) => {
            currentProduct = product; 
            fileToUpload = null; 
            
            const isNew = !product;
            document.getElementById('modal-title').textContent = isNew ? 'Añadir Nuevo Producto' : `Editar Producto: ${product?.name || ''}`;
            
            const currentImageUrl = (Array.isArray(product?.image) && product.image.length > 0) ? product.image[0] : DEFAULT_IMG_URL;

            document.getElementById('modal-body').innerHTML = `
                <div class="space-y-4">
                    <label class="block"><span class="text-gray-700">Nombre</span><input id="modal-name" value="${product?.name || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></label>
                    <label class="block"><span class="text-gray-700">Descripción</span><textarea id="modal-description" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">${product?.description || ''}</textarea></label>
                    <label class="block"><span class="text-gray-700">Categoría</span><input id="modal-category" value="${product?.category || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></label>
                    <label class="block"><span class="text-gray-700">Precio</span><input type="number" id="modal-price" value="${product?.price || 0}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></label>
                    <label class="block"><span class="text-gray-700">Stock</span><input type="number" id="modal-stock" value="${product?.stock || 0}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></label>
                    
                    <div class="pt-2 border-t">
                        <span class="text-gray-700 font-medium">Imagen del Producto:</span>
                        <div class="flex items-center gap-4 mt-2">
                             <img src="${currentImageUrl}" alt="Imagen actual" id="image-preview" class="w-12 h-12 object-cover rounded-md">
                             <div>
                                <input type="file" id="image-upload-input" accept="image/*" class="hidden">
                                <button type="button" id="select-image-btn" class="px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm">Cambiar Imagen</button>
                                <p id="selected-file-name" class="text-xs text-gray-600 mt-1">Ningún archivo nuevo seleccionado.</p>
                             </div>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-4 pt-4 border-t">
                        <label class="flex items-center"><input type="checkbox" id="modal-featured" ${product?.featured ? 'checked' : ''} class="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600"> Destacado</label>
                        <label class="flex items-center"><input type="checkbox" id="modal-isOffer" ${product?.isOffer ? 'checked' : ''} class="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600"> Oferta</label>
                        <label class="flex items-center"><input type="checkbox" id="modal-bestSeller" ${product?.bestSeller ? 'checked' : ''} class="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600"> Más Vendido</label>
                    </div>
                </div>
            `;
            document.getElementById('modal-actions').innerHTML = `
                <button id="save-product-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-150">Guardar Cambios</button>
            `;
            
            document.getElementById('select-image-btn').onclick = () => document.getElementById('image-upload-input').click();
            
            document.getElementById('image-upload-input').onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    fileToUpload = file;
                    document.getElementById('selected-file-name').textContent = file.name;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        document.getElementById('image-preview').src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            };
            
            document.getElementById('save-product-btn').onclick = saveProduct;
            
            setView('modal', true);
        };

        const uploadImage = async (file, category) => {
            if (!file) return null;

            // Lógica adaptada para el nombre del archivo: categoria/timestamp-nombrearchivo
            const safeCategory = (category || 'misc').toLowerCase().replace(/\s+/g, '-');
            const filePath = `${safeCategory}/${Date.now()}-${file.name}`;

            try {
                const response = await fetch(`${SB_URL}/storage/v1/object/${STORAGE_BUCKET}/${filePath}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'apikey': SB_ANON_KEY,
                        'Content-Type': file.type,
                        'x-upsert': 'false' // Se usa 'false' como en el ejemplo
                    },
                    body: file
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || `Error ${response.status} al subir la imagen.`);
                }
                
                return `${STORAGE_API_URL}/${filePath}`;

            } catch (error) {
                console.error("Error en la subida de imagen:", error);
                throw error; 
            }
        };

        const saveProduct = async () => {
            const isNew = !currentProduct;
            const name = document.getElementById('modal-name').value;
            const price = parseFloat(document.getElementById('modal-price').value);
            const stock = parseInt(document.getElementById('modal-stock').value);

            if (!name || isNaN(price) || isNaN(stock)) {
                logError("Nombre, Precio y Stock son campos obligatorios y deben ser números válidos.");
                return;
            }

            const button = document.getElementById('save-product-btn');
            button.disabled = true;
            button.textContent = 'Guardando...';

            try {
                let imageUrl = (Array.isArray(currentProduct?.image) && currentProduct.image.length > 0) ? currentProduct.image[0] : null;
                const category = document.getElementById('modal-category').value;
                
                // Lógica de subida adaptada
                if (fileToUpload) {
                    const uploadedUrl = await uploadImage(fileToUpload, category);
                    if (uploadedUrl) {
                        imageUrl = uploadedUrl;
                    } else {
                        throw new Error("La subida de la imagen falló, no se guardó el producto.");
                    }
                }

                const productData = {
                    name: name,
                    description: document.getElementById('modal-description').value,
                    category: category,
                    price: price,
                    stock: stock,
                    isOffer: document.getElementById('modal-isOffer').checked,
                    featured: document.getElementById('modal-featured').checked,
                    bestSeller: document.getElementById('modal-bestSeller').checked,
                    image: imageUrl ? [imageUrl] : []
                };

                let url;
                let options;

                if (isNew) {
                    productData.id = crypto.randomUUID(); // Se mantiene el UUID para productos nuevos
                    url = `${BASE_API_URL}/products`;
                    options = {
                        method: 'POST',
                        headers: { 'Prefer': 'return=minimal' },
                        body: JSON.stringify(productData)
                    };
                } else {
                    url = `${BASE_API_URL}/products?id=eq.${currentProduct.id}`;
                    options = {
                        method: 'PATCH',
                        headers: { 'Prefer': 'return=minimal' },
                        body: JSON.stringify(productData)
                    };
                }

                await makeRequest(url, options);

                setView('modal', false);
                await loadProducts();

            } catch (error) {
                console.error(`Error al guardar el producto: ${error.message}`);
                logError(`No se pudo guardar el producto. ${error.message}`);
            } finally {
                button.disabled = false;
                button.textContent = 'Guardar Cambios';
            }
        };

        const loadOrdersCaja = async () => {
            const url = `${BASE_API_URL}/orders?select=*&order=created_at.desc&payment_status=eq.Pendiente`;

            try {
                const orders = await makeRequest(url);
                const tableHTML = generateOrderTableCaja(orders);
                document.getElementById('orders-list-caja').innerHTML = tableHTML;
                attachOrderCajaListeners();
            } catch (e) {
                document.getElementById('orders-list-caja').innerHTML = `<p class="text-red-500">Error al cargar órdenes pendientes: ${e.message}</p>`;
                console.error("Error al cargar órdenes pendientes:", e.message);
            }
        };

        const generateOrderTableCaja = (data) => {
            let html = `
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Orden</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Pago</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
            `;
            data.forEach(o => {
                html += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">${o.id.substring(0, 8)}...</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500">${o.customer_name}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm font-medium">${o.customer_address}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm font-medium">$${o.total_amount}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(o.created_at).toLocaleDateString()}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-yellow-600">${o.payment_status}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm font-medium">
                            <button data-id="${o.id}" data-action="view" class="text-blue-600 hover:text-blue-800 mr-2">Detalle</button>
                            <button data-id="${o.id}" data-action="confirm" class="text-green-600 hover:text-green-800 mr-2">Confirmar</button>
                            <button data-id="${o.id}" data-action="reject" class="text-red-600 hover:text-red-800">Rechazar</button>
                        </td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
            return html;
        };

        const attachOrderCajaListeners = () => {
            document.querySelectorAll('#orders-list-caja button[data-action]').forEach(button => {
                button.onclick = async () => {
                    const id = button.getAttribute('data-id');
                    const action = button.getAttribute('data-action');
                    
                    const [order] = await makeRequest(`${BASE_API_URL}/orders?id=eq.${id}&select=*`);
                    
                    if (!order) {
                        console.error(`Orden ${id} no encontrada.`);
                        logError(`Orden no encontrada.`);
                        loadOrdersCaja();
                        return;
                    }

                    if (action === 'view') {
                        showOrderDetailModal(order);
                        return;
                    }

                    if (action === 'confirm') {
                         await updateProductStock(order.order_items, 'subtract');
                         await confirmOrder(id);
                    } else if (action === 'reject') {
                        await rejectOrder(id);
                    }
                    
                    loadOrdersCaja(); 
                };
            });
        };
        
        const updateProductStock = async (items, operation) => {
            for (const item of items) {
                const quantity = item.qty || item.quantity; 
                const productId = item.id;
                
                if (!productId || typeof quantity !== 'number' || quantity <= 0) {
                    console.warn(`Ítem de orden incompleto o sin cantidad válida para stock. ID: ${productId}, Cantidad: ${quantity}`);
                    continue; 
                }

                const [product] = await makeRequest(`${BASE_API_URL}/products?id=eq.${productId}&select=stock`);
                if (!product) {
                    console.warn(`Producto ${productId} no encontrado, stock no actualizado.`);
                    continue;
                }

                let newStock;
                if (operation === 'subtract') {
                    newStock = Math.max(0, product.stock - quantity);
                } else if (operation === 'add') {
                    newStock = product.stock + quantity;
                } else {
                    continue;
                }

                try {
                    await makeRequest(`${BASE_API_URL}/products?id=eq.${productId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ stock: newStock })
                    });
                    console.log(`Stock de producto ${productId} actualizado a ${newStock}.`);
                } catch (e) {
                    console.error(`Fallo al actualizar stock de ${productId}: ${e.message}`);
                    logError(`Fallo al actualizar stock.`);
                }
            }
        };


        const confirmOrder = async (orderId) => {
            try {
                const updateData = {
                    payment_status: "Confirmado",
                    order_status: "Pendiente"
                };
                
                await makeRequest(`${BASE_API_URL}/orders?id=eq.${orderId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(updateData)
                });
                
                console.log(`Orden ${orderId.substring(0, 8)}... confirmada y movida (por el trigger SQL).`);
            } catch (e) {
                console.error(`Error al confirmar la orden: ${e.message}`);
                logError(`Error al confirmar la orden.`);
            }
        };

        const rejectOrder = async (orderId) => {
            try {
                await makeRequest(`${BASE_API_URL}/orders?id=eq.${orderId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ payment_status: "Rechazado" })
                });
                console.log(`Orden ${orderId.substring(0, 8)}... rechazada.`);
            } catch (e) {
                console.error(`Error al rechazar la orden: ${e.message}`);
                logError(`Error al rechazar la orden.`);
            }
        };


        // --- FUNCIONES DE DESPACHO (orders_confirmed) ---

        const loadOrdersDespacho = async () => {
            const url = `${BASE_API_URL}/orders_confirmed?select=*&order=created_at.asc&order_status=neq.Despachado`;

            try {
                const orders = await makeRequest(url);
                const tableHTML = generateOrderTableDespacho(orders);
                document.getElementById('orders-list-despacho').innerHTML = tableHTML;
                attachOrderDespachoListeners(orders);
            } catch (e) {
                document.getElementById('orders-list-despacho').innerHTML = `<p class="text-red-500">Error al cargar órdenes para despacho: ${e.message}</p>`;
                console.error("Error al cargar órdenes para despacho:", e.message);
            }
        };

        const generateOrderTableDespacho = (data) => {
            let html = `
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Orden</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
            `;
            data.forEach(o => {
                html += `
                    <tr class="hover:bg-gray-50" data-id="${o.id}">
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500">${o.customer_name}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm font-medium">${o.customer_address}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm font-medium">$${o.total_amount}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(o.created_at).toLocaleDateString()}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-orange-600">${o.order_status}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm font-medium">
                            <button data-id="${o.id}" data-action="view" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150">Detalle</button>
                            <button data-id="${o.id}" data-action="dispatch" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-150">Despachar</button>
                        </td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
            return html;
        };

        const attachOrderDespachoListeners = (orders) => {
            document.querySelectorAll('#orders-list-despacho button[data-action]').forEach(button => {
                button.onclick = async () => {
                    const id = button.getAttribute('data-id');
                    const action = button.getAttribute('data-action');
                    const order = orders.find(o => o.id === id);

                    if (action === 'dispatch') {
                        await dispatchOrder(id);
                    } else if (action === 'view') {
                        showOrderDetailModal(order);
                    }
                };
            });
        };

        const dispatchOrder = async (orderId) => {
            try {
                await makeRequest(`${BASE_API_URL}/orders_confirmed?id=eq.${orderId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ order_status: "Despachado" })
                });
                console.log(`Orden ${orderId.substring(0, 8)}... marcada como Despachada.`);
                loadOrdersDespacho();
            } catch (e) {
                console.error(`Error al despachar orden ${orderId}: ${e.message}`);
                logError(`Error al despachar la orden.`);
            }
        };

        const showOrderDetailModal = (order) => {
            document.getElementById('modal-title').textContent = `Detalle de Orden #${order.id.substring(0, 8)}`;

            let totalItemsCount = 0;
            let subtotalItemsPrice = 0;

            let itemsHtml = order.order_items.map(item => {
                const itemQuantity = item.qty || item.quantity || 0; 
                const itemPrice = item.price || 0;
                const itemTotal = itemPrice * itemQuantity;
                totalItemsCount += itemQuantity;
                subtotalItemsPrice += itemTotal;

                return `
                    <li class="py-1 border-b border-gray-100">
                        <div class="flex justify-between">
                            <span class="text-gray-700 font-medium">(${itemQuantity}x) ${item.name}</span>
                            <span class="font-semibold">$${itemTotal}</span>
                        </div>
                    </li>
                `;
            }).join('');
            
            const finalTotal = order.total_amount || subtotalItemsPrice; 


            document.getElementById('modal-body').innerHTML = `
                <div class="space-y-2">
                    <p><span class="font-semibold">Cliente:</span> ${order.customer_name}</p>
                    <p><span class="font-semibold">Dirección:</span> ${order.customer_address}</p>
                    <p class="p-2 bg-blue-50 border-l-4 border-blue-400"><span class="font-bold text-blue-800">Método de Pago:</span> ${order.payment_method}</p>
                </div>
                
                <h4 class="font-bold mt-4 mb-2 text-lg border-b">Productos:</h4>
                <ul class="list-none pl-0 mb-4">${itemsHtml}</ul>
                
                <div class="text-right font-extrabold text-xl pt-2 border-t mt-4">
                    <p class="mt-1">Total: <span class="text-red-600">$ ${finalTotal}</span></p>
                </div>
            `;
            document.getElementById('modal-actions').innerHTML = `
                <button id="print-order-btn" class="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition duration-150">Imprimir Factura</button>
            `;
            document.getElementById('print-order-btn').onclick = () => printOrder(order);
            setView('modal', true);
        };
        
        // --- FUNCIONES DE CARTERA (Histórico) ---

        const printOrder = (order) => {
            const printArea = document.getElementById('print-area');
            let itemsText = order.order_items.map(item =>
                `<div>(${item.qty || item.quantity || 0}x) ${item.name} -> $${(item.price || 0) * (item.qty || item.quantity || 0)}</div>`
            ).join('');

            printArea.innerHTML = `
                <div class="text-center font-bold mb-2">FACTURA DE VENTA</div>
                <div class="mb-2">--------------------------------</div>
                <div>Orden ID: ${order.id.substring(0, 8)}</div>
                <div>Fecha: ${new Date(order.created_at).toLocaleString()}</div>
                <div>Cliente: ${order.customer_name}</div>
                <div>--------------------------------</div>
                <div class="font-bold">DETALLE:</div>
                ${itemsText}
                <div>--------------------------------</div>
                <div class="text-right font-bold">TOTAL: $${order.total_amount}</div>
                <div class="mt-4 text-center">¡Gracias por su compra!</div>
            `;
            printArea.classList.remove('hidden');
            window.print();
            printArea.classList.add('hidden');
        };

        const loadOrdersCartera = async () => {
            const url = `${BASE_API_URL}/orders_confirmed?select=*&order=created_at.desc`;

            try {
                carteraData = await makeRequest(url);
                renderOrdersCartera(carteraData);
            } catch (e) {
                document.getElementById('orders-list-cartera').innerHTML = `<p class="text-red-500">Error al cargar datos contables: ${e.message}</p>`;
                console.error("Error al cargar datos contables:", e.message);
            }
        };

        const renderOrdersCartera = (data) => {
            const tableHTML = generateOrderTableCartera(data);
            document.getElementById('orders-list-cartera').innerHTML = tableHTML;
            
            const totalVendido = data.reduce((sum, order) => sum + (order.total_amount || 0), 0);
            document.getElementById('cartera-total').textContent = `Costo Total Vendido: $${totalVendido.toLocaleString('es-CO')}`;
        };

        const generateOrderTableCartera = (data) => {
            let html = `
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Orden</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Orden</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Pago</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
            `;
            data.forEach(o => {
                html += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">${o.id.substring(0, 8)}...</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500">${o.customer_name}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm font-medium">$${o.total_amount.toLocaleString('es-CO')}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(o.created_at).toLocaleDateString()}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-orange-600">${o.order_status}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-green-600">${o.payment_status}</td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
            return html;
        };

        const applyCarteraFilters = () => {
            const dateFromStr = document.getElementById('date-from').value;
            const dateToStr = document.getElementById('date-to').value;
            const searchTerm = document.getElementById('cartera-search').value.toLowerCase();

            let filteredData = carteraData;

            if (dateFromStr) {
                const dateFrom = new Date(dateFromStr);
                filteredData = filteredData.filter(o => new Date(o.created_at) >= dateFrom);
            }
            if (dateToStr) {
                const dateTo = new Date(dateToStr);
                dateTo.setDate(dateTo.getDate() + 1);
                filteredData = filteredData.filter(o => new Date(o.created_at) < dateTo);
            }

            if (searchTerm) {
                filteredData = filteredData.filter(o =>
                    o.customer_name.toLowerCase().includes(searchTerm) ||
                    o.id.toLowerCase().includes(searchTerm) ||
                    o.customer_address.toLowerCase().includes(searchTerm)
                );
            }

            renderOrdersCartera(filteredData);
        };

        const exportCarteraToCSV = () => {
            const dataToExport = carteraData;
            
            const totalVendido = dataToExport.reduce((sum, order) => sum + (order.total_amount || 0), 0);
            
            let csv = convertToCSV(dataToExport);
            csv += `\n\nTotal Vendido:,${totalVendido}`;

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'reporte_cartera.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };


        // --- NUEVAS FUNCIONES: ÓRDENES PENDIENTES (CAJA) ---

        const loadOrdersPendientes = async () => {
            // Trae toda la información de la tabla orders_confirmed
            const url = `${BASE_API_URL}/orders_confirmed?select=*&order=created_at.desc`;
            try {
                const orders = await makeRequest(url);
                const tableHTML = generatePendingOrdersTable(orders);
                document.getElementById('orders-list-pendientes').innerHTML = tableHTML;
                attachPendingListeners(orders);
            } catch (e) {
                document.getElementById('orders-list-pendientes').innerHTML = `<p class="text-red-500">Error al cargar órdenes pendientes: ${e.message}</p>`;
                console.error("Error al cargar órdenes pendientes (caja):", e.message);
            }
        };

        const generatePendingOrdersTable = (data) => {
    if (!Array.isArray(data) || data.length === 0) {
        return `<p class="text-gray-600">No hay órdenes en orders_confirmed.</p>`;
    }

    const columns = ['id', 'customer_name', 'total_amount', 'created_at', 'order_status'];
    const titles = {
        id: 'ID Orden',
        customer_name: 'Cliente',
        total_amount: 'Total',
        created_at: 'Fecha',
        order_status: 'Estado Orden'
    };

    let html = `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    ${columns.map(col => `<th class=\"px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider\">${titles[col]}</th>`).join('')}
                    <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
    `;

    data.forEach(o => {
        html += `<tr class="hover:bg-gray-50" data-id="${o.id}">`;

        columns.forEach(col => {
            let val = o[col];
            if (col === 'id' && val) val = `${val.substring(0, 8)}...`;
            else if (col === 'total_amount' && typeof val === 'number') val = `$${val.toLocaleString('es-CO')}`;
            else if (col === 'created_at' && val) val = new Date(val).toLocaleDateString();
            html += `<td class="px-3 py-4 whitespace-nowrap text-sm text-gray-700">${val || ''}</td>`;
        });

        // NOTA: usamos una celda de acciones con clase 'actions-cell' para inyectar el botón WhatsApp
        html += `
            <td class="px-3 py-4 whitespace-nowrap text-sm font-medium actions-cell">
                <button data-id="${o.id}" data-action="view" class="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-blue-700 transition duration-150">Detalle</button>
            </td>
        </tr>`;
    });

    html += `</tbody></table>`;
    return html;
};


        // --- Helper: añadir botones WhatsApp en la tabla de pendientes ---
        const appendWhatsappButtonsToPendingOrders = (orders, phoneFieldName = null) => {
            if (!window.whatsappContact) return;
            if (!Array.isArray(orders) || orders.length === 0) return;

            orders.forEach(order => {
                try {
                    if (!window.whatsappContact.isEligibleForWhatsapp(order)) return;

                    // localizar la fila por data-id
                    const row = document.querySelector(`#orders-list-pendientes tr[data-id="${order.id}"]`);
                    if (!row) return;
                    const actionCell = row.querySelector('.actions-cell');
                    if (!actionCell) return;

                    // Evitar duplicados
                    if (actionCell.querySelector(`a[data-wa-order-id="${order.id}"]`)) return;

                    const phone = phoneFieldName ? (order[phoneFieldName] || '') : undefined;
                    const waBtn = window.whatsappContact.createButtonElement(order, phone);
                    if (waBtn) actionCell.appendChild(waBtn);
                } catch (err) {
                    console.error('Error al crear botón WhatsApp para orden', order?.id, err);
                }
            });
        };

        const attachPendingListeners = (orders) => {
            document.querySelectorAll('#orders-list-pendientes button[data-action]').forEach(button => {
                button.onclick = async () => {
                    const id = button.getAttribute('data-id');
                    const action = button.getAttribute('data-action');
                    const order = orders.find(o => o.id === id);

                    if (!order) {
                        // intentar buscar en la API por si cambió
                        const [freshOrder] = await makeRequest(`${BASE_API_URL}/orders_confirmed?id=eq.${id}&select=*`);
                        if (freshOrder) {
                            showOrderDetailModal(freshOrder);
                        } else {
                            logError('Orden no encontrada.');
                        }
                        return;
                    }

                    if (action === 'view') {
                        showOrderDetailModal(order);
                    }
                };
            });

            // Asegurar DOM listo y luego inyectar botones (evita condiciones de carrera)
            setTimeout(() => {
                // Si se desea pasar un campo telefónico por orden, poner 'delivery_phone' por ejemplo
                appendWhatsappButtonsToPendingOrders(orders /*, 'delivery_phone' */);
            }, 0);
        };

        // --- NUEVAS FUNCIONES: MANEJO DE out_money (egresos) ---

        const loadOutMoney = async () => {
            try {
                const url = `${BASE_API_URL}/out_money?select=*&order=time.desc`;
                const outRecords = await makeRequest(url);
                const html = generateOutMoneyTable(outRecords);
                document.getElementById('out-money-list').innerHTML = html;
                attachOutMoneyListeners(outRecords);
            } catch (e) {
                document.getElementById('out-money-list').innerHTML = `<p class="text-red-500">Error al cargar egresos: ${e.message}</p>`;
                console.error("Error al cargar out_money:", e.message);
            }
        };

        const generateOutMoneyTable = (data) => {
            if (!Array.isArray(data) || data.length === 0) {
                return `<p class="text-gray-600">No hay egresos registrados.</p>`;
            }

            let html = `
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalle</th>
                            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
            `;

            data.forEach(r => {
                const time = r.time ? new Date(r.time).toLocaleString() : '';
                html += `
                    <tr class="hover:bg-gray-50" data-id="${r.id}">
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-700">${time}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">${r.name}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-700">${r.position || ''}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-red-600">$${(r.cant || 0).toLocaleString('es-CO')}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-700">${r.detail || ''}</td>
                        <td class="px-3 py-4 whitespace-nowrap text-sm font-medium">
                            <button data-id="${r.id}" data-action="delete-out" class="text-red-600 hover:text-red-800">Eliminar</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            return html;
        };

        const attachOutMoneyListeners = (records) => {
            document.querySelectorAll('#out-money-list button[data-action]').forEach(button => {
                button.onclick = async () => {
                    const id = button.getAttribute('data-id');
                    const action = button.getAttribute('data-action');

                    if (action === 'delete-out') {
                        try {
                            await makeRequest(`${BASE_API_URL}/out_money?id=eq.${id}`, { method: 'DELETE' });
                            await loadOutMoney();
                            await loadShiftSummary();
                        } catch (e) {
                            console.error('Error al eliminar egreso:', e.message);
                            logError('No se pudo eliminar el egreso.');
                        }
                    }
                };
            });
        };

        const saveOutMoney = async () => {
            const name = document.getElementById('out-name').value;
            const position = document.getElementById('out-position').value;
            const cantStr = document.getElementById('out-cant').value;
            const detail = document.getElementById('out-detail').value;

            const cant = parseFloat(cantStr);
            if (!name || isNaN(cant) || cant <= 0) {
                logError('Nombre y Cantidad válida son obligatorios.');
                return;
            }

            // No enviamos 'id' en el POST: dejamos que la BD (bigint/serial) lo genere
            const record = {
                time: new Date().toISOString(),
                name: name,
                position: position,
                cant: cant,
                detail: detail || ''
            };

            try {
                await makeRequest(`${BASE_API_URL}/out_money`, {
                    method: 'POST',
                    headers: { 'Prefer': 'return=minimal' },
                    body: JSON.stringify(record)
                });
                // limpiar campos
                document.getElementById('out-name').value = '';
                document.getElementById('out-position').value = '';
                document.getElementById('out-cant').value = '';
                document.getElementById('out-detail').value = '';

                await loadOutMoney();
                await loadShiftSummary();
            } catch (e) {
                console.error('Error al guardar egreso:', e.message);
                logError('No se pudo registrar el egreso.');
            }
        };

        // --- RESUMEN DE TURNO (VENTAS HOY + EGRESOS) ---
        const isShiftOpen = () => {
            return !!localStorage.getItem('shift_start');
        };

        const getShiftStart = () => {
            const v = localStorage.getItem('shift_start');
            return v ? new Date(v) : null;
        };

        const setShiftStart = (date) => {
            if (date) localStorage.setItem('shift_start', date.toISOString());
            else localStorage.removeItem('shift_start');
        };

        const toggleShiftUI = (open) => {
            const shiftSummaryEl = document.getElementById('shift-summary');
            const openBtn = document.getElementById('open-shift-btn');
            const closeBtn = document.getElementById('close-shift-btn');
            const printBtn = document.getElementById('print-shift-summary-btn');

            if (open) {
                if (shiftSummaryEl) shiftSummaryEl.classList.remove('hidden');
                if (openBtn) openBtn.disabled = true;
                if (closeBtn) closeBtn.disabled = false;
                if (printBtn) printBtn.classList.remove('hidden');
            } else {
                if (shiftSummaryEl) shiftSummaryEl.classList.add('hidden');
                if (openBtn) openBtn.disabled = false;
                if (closeBtn) closeBtn.disabled = true;
                if (printBtn) printBtn.classList.add('hidden');
            }
        };

        const computeShiftSummary = async (startDate, endDate) => {
            // recibe objetos Date
            try {
                const orders = await makeRequest(`${BASE_API_URL}/orders_confirmed?select=total_amount,created_at`);
                const outRecords = await makeRequest(`${BASE_API_URL}/out_money?select=cant,time`);

                const totalSales = (orders || []).reduce((sum, o) => {
                    const d = new Date(o.created_at);
                    if (d >= startDate && d <= endDate) return sum + (o.total_amount || 0);
                    return sum;
                }, 0);

                const totalOut = (outRecords || []).reduce((sum, r) => {
                    const d = r.time ? new Date(r.time) : null;
                    if (d && d >= startDate && d <= endDate) return sum + (r.cant || 0);
                    return sum;
                }, 0);

                const net = totalSales - totalOut;

                return { totalSales, totalOut, net };
            } catch (e) {
                console.error('Error al calcular resumen de turno:', e.message);
                throw e;
            }
        };

        // --- NUEVA FUNCION: AGREGAR TOP PRODUCTS CALCULATION ---
        const computeTopProducts = async (startDate, endDate) => {
            // Devuelve array ordenado [{ id, name, totalQty }]
            try {
                const orders = await makeRequest(`${BASE_API_URL}/orders_confirmed?select=order_items,created_at`);
                const map = new Map();

                (orders || []).forEach(o => {
                    const d = new Date(o.created_at);
                    if (!(d >= startDate && d <= endDate)) return;

                    let items = o.order_items;
                    if (!items) return;
                    // Si Supabase devuelve string JSON, intentamos parsear.
                    if (typeof items === 'string') {
                        try {
                            items = JSON.parse(items);
                        } catch (_) {
                            return;
                        }
                    }
                    if (!Array.isArray(items)) return;

                    items.forEach(it => {
                        const qty = Number(it.qty || it.quantity || 0);
                        if (!qty || qty <= 0) return;
                        const pid = it.id || it.product_id || it.product?.id;
                        const name = it.name || it.product?.name || 'Sin nombre';
                        if (!pid) return;
                        const prev = map.get(pid) || { id: pid, name: name, totalQty: 0 };
                        prev.totalQty += qty;
                        // mantén nombre más descriptivo si se actualiza
                        if (!prev.name && name) prev.name = name;
                        map.set(pid, prev);
                    });
                });

                const arr = Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
                return arr;
            } catch (e) {
                console.error('Error al calcular productos top:', e.message);
                return [];
            }
        };

        const loadShiftSummary = async () => {
            if (!isShiftOpen()) {
                // no mostrar resumen si no hay turno abierto
                toggleShiftUI(false);
                return;
            }

            try {
                const start = getShiftStart();
                const end = new Date(); // ahora
                const { totalSales, totalOut, net } = await computeShiftSummary(start, end);

                document.getElementById('summary-total-sales').textContent = `Ventas: $${totalSales.toLocaleString('es-CO')}`;
                document.getElementById('summary-total-egresos').textContent = `Egresos: $${totalOut.toLocaleString('es-CO')}`;
                document.getElementById('summary-net-cash').textContent = `Neto en Caja: $${net.toLocaleString('es-CO')}`;
                toggleShiftUI(true);
            } catch (e) {
                // deja la UI como está, pero loggea
                console.error('Fallo al actualizar resumen de turno:', e.message);
            }
        };

        const openShift = () => {
            if (isShiftOpen()) {
                logError('Ya hay un turno abierto.');
                return;
            }
            const now = new Date();
            setShiftStart(now);
            toggleShiftUI(true);
            loadShiftSummary();
            // Mensaje rápido
            const startStr = now.toLocaleString();
            document.getElementById('modal-title').textContent = 'Turno abierto';
            document.getElementById('modal-body').innerHTML = `<p>Turno abierto en: <strong>${startStr}</strong></p>`;
            document.getElementById('modal-actions').innerHTML = `<button id="close-modal-ack" class="px-4 py-2 bg-blue-600 text-white rounded-lg">Aceptar</button>`;
            setView('modal', true);
            document.getElementById('close-modal-ack').onclick = () => setView('modal', false);
        };

        const closeShift = async () => {
            if (!isShiftOpen()) {
                logError('No hay un turno abierto.');
                return;
            }
            const start = getShiftStart();
            const end = new Date();

            try {
                const { totalSales, totalOut, net } = await computeShiftSummary(start, end);
                const topProducts = await computeTopProducts(start, end);

                // Construir HTML de top products
                let topHtml = '';
                if (Array.isArray(topProducts) && topProducts.length > 0) {
                    topHtml += `<h4 class="font-bold mt-3 mb-2">Productos más vendidos</h4>`;
                    topHtml += `<ol class="list-decimal pl-5">`;
                    topProducts.forEach(p => {
                        topHtml += `<li class="py-1"><span class="font-medium">${p.name || p.id}</span> — Cant: <strong>${p.totalQty}</strong></li>`;
                    });
                    topHtml += `</ol>`;
                } else {
                    topHtml += `<p class="text-gray-600">No se registraron productos vendidos en este turno.</p>`;
                }

                // Mostrar resumen final en modal y borrar el turno (cierre manual)
                document.getElementById('modal-title').textContent = 'Cierre de Turno - Resumen Final';
                document.getElementById('modal-body').innerHTML = `
                    <p><strong>Apertura:</strong> ${start.toLocaleString()}</p>
                    <p><strong>Cierre:</strong> ${end.toLocaleString()}</p>
                    <div class="mt-3 p-3 bg-gray-50 rounded">
                        <p><strong>Total Ventas:</strong> $${totalSales.toLocaleString('es-CO')}</p>
                        <p><strong>Total Egresos:</strong> $${totalOut.toLocaleString('es-CO')}</p>
                        <p class="mt-2 font-bold"><strong>Neto en Caja:</strong> $${net.toLocaleString('es-CO')}</p>
                    </div>
                    ${topHtml}
                `;
                document.getElementById('modal-actions').innerHTML = `
                    <button id="confirm-close-shift" class="px-4 py-2 bg-red-600 text-white rounded-lg">Cerrar Turno</button>
                    <button id="export-top-products" class="px-4 py-2 bg-green-600 text-white rounded-lg">Exportar Top Productos</button>
                    <button id="cancel-close-shift" class="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg">Cancelar</button>
                `;
                setView('modal', true);

                document.getElementById('cancel-close-shift').onclick = () => setView('modal', false);

                document.getElementById('export-top-products').onclick = () => {
                    // generar CSV simple de topProducts
                    if (!topProducts || topProducts.length === 0) {
                        logError('No hay productos para exportar.');
                        return;
                    }
                    const headers = ['Producto', 'Cantidad'];
                    const rows = topProducts.map(p => [p.name || p.id, p.totalQty]);
                    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.setAttribute('download', `top_products_${start.toISOString()}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                };

                document.getElementById('confirm-close-shift').onclick = () => {
                    // Borramos el estado del turno (cierre)
                    setShiftStart(null);
                    toggleShiftUI(false);
                    setView('modal', false);
                    // recargar lista de egresos y refrescar UI
                    loadOutMoney();
                    // ocultar print
                    const printBtn = document.getElementById('print-shift-summary-btn');
                    if (printBtn) printBtn.classList.add('hidden');
                };

            } catch (e) {
                logError('Error al cerrar el turno.');
                console.error(e);
            }
        };

        const printShiftSummary = async () => {
            // Imprime el resumen desde apertura hasta ahora si está abierto,
            // o muestra mensaje si no hay turno abierto.
            if (!isShiftOpen()) {
                logError('No hay turno abierto para imprimir.');
                return;
            }
            const start = getShiftStart();
            const end = new Date();
            try {
                const { totalSales, totalOut, net } = await computeShiftSummary(start, end);
                const topProducts = await computeTopProducts(start, end);

                const printArea = document.getElementById('print-area');
                let topHtml = '';
                if (topProducts && topProducts.length > 0) {
                    topHtml += `<hr/><h4>Productos más vendidos</h4>`;
                    topProducts.forEach(p => {
                        topHtml += `<div>- ${p.name || p.id} : ${p.totalQty}</div>`;
                    });
                } else {
                    topHtml += `<hr/><div>No se registraron productos vendidos en este turno.</div>`;
                }

                printArea.innerHTML = `
                    <div class="text-center font-bold mb-2">RESUMEN DE TURNO</div>
                    <div>Apertura: ${start.toLocaleString()}</div>
                    <div>Corte: ${end.toLocaleString()}</div>
                    <hr />
                    <div class="mt-2">Total Ventas: $${totalSales.toLocaleString('es-CO')}</div>
                    <div>Total Egresos: $${totalOut.toLocaleString('es-CO')}</div>
                    <div class="font-bold mt-2">Neto en Caja: $${net.toLocaleString('es-CO')}</div>
                    ${topHtml}
                `;
                printArea.classList.remove('hidden');
                window.print();
                printArea.classList.add('hidden');
            } catch (e) {
                logError('No se pudo imprimir el resumen.');
            }
        };

        // --- EVENT LISTENERS GENERALES ---

        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('.login-button').forEach(button => {
                button.onclick = () => handleLogin(button.getAttribute('data-role'));
            });

            document.getElementById('logout-button').onclick = handleLogout;
            document.getElementById('apply-cartera-filters').onclick = applyCarteraFilters;
            document.getElementById('export-cartera-btn').onclick = exportCarteraToCSV;
            document.getElementById('close-modal').onclick = () => setView('modal', false);

            // nuevos listeners para egresos
            const addOutBtn = document.getElementById('add-out-money-btn');
            if (addOutBtn) addOutBtn.onclick = saveOutMoney;
            const refreshSummaryBtn = document.getElementById('refresh-shift-summary');
            if (refreshSummaryBtn) refreshSummaryBtn.onclick = loadShiftSummary;

            // listeners de open/close shift
            const openShiftBtn = document.getElementById('open-shift-btn');
            const closeShiftBtn = document.getElementById('close-shift-btn');
            const printShiftBtn = document.getElementById('print-shift-summary-btn');
            if (openShiftBtn) openShiftBtn.onclick = openShift;
            if (closeShiftBtn) closeShiftBtn.onclick = closeShift;
            if (printShiftBtn) printShiftBtn.onclick = printShiftSummary;

            // inicializar estado visual del turno
            toggleShiftUI(isShiftOpen());

            if (localStorage.getItem('authToken')) {
                handleLogout(); 
            } else {
                setView('login-view', true);
            }
        });