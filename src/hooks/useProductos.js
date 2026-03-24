import { useState, useCallback } from 'react';
import { CONFIG, API_URLS } from '../lib/config';

const useProductos = (api) => {
  const [products, setProducts] = useState([]);

  const load = useCallback(async () => {
    const data = await api.request('/products?select=*&order=name.asc');
    setProducts(data || []);
  }, [api]);

  const save = async (productData, files, token) => {
    let imageUrls = Array.isArray(productData.image) ? [...productData.image] : [];
    const fileArray = files ? Array.from(files) : [];

    if (fileArray.length > 0) {
      const uploadPromises = fileArray.map(async (file) => {
        const filePath = `misc/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
        const res = await fetch(`${CONFIG.SB_URL}/storage/v1/object/${CONFIG.STORAGE_BUCKET}/${filePath}`, {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${token}`, 
            apikey: CONFIG.SB_ANON_KEY, 
            'Content-Type': file.type 
          },
          body: file
        });
        if (res.ok) return `${API_URLS.STORAGE}/${filePath}`;
        return null;
      });

      const newUrls = await Promise.all(uploadPromises);
      imageUrls = [...imageUrls, ...newUrls.filter(url => url !== null)];
    }

    const payload = { ...productData, image: imageUrls };
    const id = payload.id;
    if (id) {
      delete payload.id;
      await api.request(`/products?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
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