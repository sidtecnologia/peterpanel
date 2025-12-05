import { useEffect, useState, useRef } from 'react';
import { Search, Plus, Edit, Trash2 } from 'lucide-react';
import useProductos from '../../hooks/useProductos';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { CONFIG, formatCurrency } from '../../lib/config';

const ProductosTab = ({ api, token }) => {
  const { products, load, save, remove } = useProductos(api);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    // Obtener archivos directamente del input (para soportar multiple)
    const fileInput = fileInputRef.current;
    const files = fileInput?.files && fileInput.files.length > 0 ? fileInput.files : null;

    const payload = {
      id: editing?.id,
      name: fd.get('name'),
      price: Number(fd.get('price')),
      stock: Number(fd.get('stock')),
      category: fd.get('category'),
      description: fd.get('description'),
      // Checkboxes: featured, isOffer, bestSeller -> están presentes si checked -> 'on'
      featured: !!fd.get('featured'),
      isOffer: !!fd.get('isOffer'),
      bestSeller: !!fd.get('bestSeller'),
      // Si no se suben nuevas imágenes, useProductos se encarga de mantener las existentes
      image: editing?.image
    };

    await save(payload, files, token);
    setModalOpen(false);
    setEditing(null);
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card>
      <div className="flex justify-between mb-6 gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input className="w-full pl-10 pr-4 py-2 border rounded-lg" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button icon={Plus} onClick={() => { setEditing({ featured: false, isOffer: false, bestSeller: false, image: [] }); setModalOpen(true); }}>Nuevo</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Imgs</th><th className="p-3">Nombre</th><th className="p-3">Precio</th><th className="p-3">Stock</th><th className="p-3">Flags</th><th className="p-3 text-right">Acciones</th></tr></thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="p-3">
                  <div className="flex gap-1">
                    {(p.image || []).slice(0,3).map((src, idx) => (
                      <img key={idx} src={src || CONFIG.DEFAULT_IMG} className="w-10 h-10 rounded bg-slate-100 object-cover"/>
                    ))}
                    {(p.image || []).length === 0 && <img src={CONFIG.DEFAULT_IMG} className="w-10 h-10 rounded bg-slate-100 object-cover"/>}
                  </div>
                </td>
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3">{formatCurrency(p.price)}</td>
                <td className={`p-3 font-bold ${p.stock>0?'text-emerald-600':'text-red-500'}`}>{p.stock}</td>
                <td className="p-3">
                  <div className="flex gap-2 text-xs">
                    {p.featured && <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">Destacado</span>}
                    {p.isOffer && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">Oferta</span>}
                    {p.bestSeller && <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Más Vendido</span>}
                  </div>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => { setEditing(p); setModalOpen(true); }} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded"><Edit size={16}/></button>
                  <button onClick={() => remove(p.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <Modal title={editing?.id ? 'Editar Producto' : 'Nuevo Producto'} onClose={() => { setModalOpen(false); setEditing(null); }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input name="name" defaultValue={editing?.name} placeholder="Nombre" required className="w-full border rounded p-2"/>
            <div className="flex gap-4">
              <input name="price" type="number" defaultValue={editing?.price} placeholder="Precio" required className="w-full border rounded p-2"/>
              <input name="stock" type="number" defaultValue={editing?.stock} placeholder="Stock" required className="w-full border rounded p-2"/>
            </div>
            <input name="category" defaultValue={editing?.category} placeholder="Categoría" className="w-full border rounded p-2"/>
            <textarea name="description" defaultValue={editing?.description} placeholder="Descripción" className="w-full border rounded p-2 h-20"/>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={!!editing?.featured}/> Destacado</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isOffer" defaultChecked={!!editing?.isOffer}/> Oferta</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="bestSeller" defaultChecked={!!editing?.bestSeller}/> Más vendido</label>
            </div>

            <div>
              <label className="text-sm text-slate-600 mb-1 block">Imágenes (puedes subir varias)</label>
              <input ref={fileInputRef} type="file" name="imageFiles" multiple accept="image/*" className="w-full text-sm text-slate-500"/>
              <div className="text-xs text-slate-400 mt-1">Sube una o más imágenes. Las nuevas imágenes se agregarán a las existentes.</div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
};

export default ProductosTab;