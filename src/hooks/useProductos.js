import { useState, useCallback } from 'react';
import { CONFIG, API_URLS } from '../lib/config';

const useProductos = (api) => {
  const [products, setProducts] = useState([]);

  const load = useCallback(async () => {
    const data = await api.request('/products?select=*&order=name.asc');
    setProducts(data || []);
  }, [api]);

  const save = async (productData, files, token) => {
    // Copiar imágenes existentes (si hay)
    let imageUrls = Array.isArray(productData.image) ? [...productData.image] : (productData.image ? [...productData.image] : []);

    // Manejar subida de múltiples archivos (files puede ser FileList o Array)
    const fileArray = files && (files instanceof FileList ? Array.from(files) : Array.isArray(files) ? files : null);

    if (fileArray && fileArray.length > 0) {
      for (const file of fileArray) {
        try {
          const filePath = `misc/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
          const uploadRes = await fetch(`${CONFIG.SB_URL}/storage/v1/object/${CONFIG.STORAGE_BUCKET}/${filePath}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, apikey: CONFIG.SB_ANON_KEY, 'Content-Type': file.type },
            body: file
          });
          if (uploadRes.ok) {
            imageUrls.push(`${API_URLS.STORAGE}/${filePath}`);
          } else {
            console.warn('Error subiendo archivo', file.name, await uploadRes.text());
          }
        } catch (err) {
          console.error('Error subiendo archivo', file.name, err);
        }
      }
    }

    const payload = {
      ...productData,
      image: imageUrls
    };

    // No enviar id en payload para inserción; para actualización usamos PATCH con filtro
    const id = payload.id;
    if (id) delete payload.id;

    if (productData.id) {
      await api.request(`/products?id=eq.${productData.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      await api.request('/products', { method: 'POST', body: JSON.stringify(payload) });
    }

    await load();
  };

  const remove = async (id) => {
    if (confirm('¿Eliminar producto?')) {
      await api.request(`/products?id=eq.${id}`, { method: 'DELETE' });
      await load();
    }
  };

  return { products, load, save, remove };
};

export default useProductos;