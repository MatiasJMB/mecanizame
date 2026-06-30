import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ChevronRight, ChevronDown, Package, Folder, X, Pencil, Trash2, Play, Pause, Scale, Hash, CheckCircle2, Check, AlertTriangle, Sparkles, Search, ArrowUpDown } from 'lucide-react';
import { usePageHeader } from '../components/AppLayout';

type Product = {
  id: number;
  bakery_id: number;
  category: string;
  name: string;
  price: number;
  sell_type: 'per_kg' | 'per_unit';
  is_active: boolean;
};

type Category = {
  id: number;
  bakery_id: number;
  name: string;
  sort_order: number;
};

const normalizeString = (str: string) => 
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Products() {
  const { bakeryId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; category: string; price: number | string; sell_type: string }>({ name: '', category: '', price: 0, sell_type: 'per_kg' });
  const [newForm, setNewForm] = useState<{ name: string; category: string; price: number | string; sell_type: string }>({ name: '', category: '', price: 2190, sell_type: 'per_kg' });
  const [showCats, setShowCats] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  
  // Categorías
  const [newCatName, setNewCatName] = useState('');
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOption, setSortOption] = useState('a-z'); // newest, oldest, a-z, z-a
  // Start with all categories expanded so sorting is immediately visible
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  useEffect(() => { document.title = 'AhoraPan - Productos'; }, []);
  useEffect(() => { if (bakeryId) { fetchProducts(); fetchCategories(); } }, [bakeryId]);
  usePageHeader({
    title: (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-500"><Package className="h-4 w-4" /></span>
        <h1 className="truncate text-lg font-black tracking-tight text-theme-base md:text-xl">Mi catálogo</h1>
      </div>
    ),
    actions: (
      <span className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Catálogo online
      </span>
    ),
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    // Fetch without a pre-sort so our client-side sort is authoritative
    const { data } = await supabase.from('products').select('*').eq('bakery_id', bakeryId);
    const fetched = data || [];
    setProducts(fetched);
    setLoading(false);
    // Auto-expand all categories so sorting effects are immediately visible
    const cats = [...new Set(fetched.map(p => p.category))];
    setExpandedCategories(cats);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').eq('bakery_id', bakeryId).order('sort_order').order('name');
    setCategories(data || []);
  };

    // ===== CATEGORY ACTIONS =====
  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const { error } = await supabase.from('categories').insert({ bakery_id: bakeryId, name: newCatName.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success(`Categoría "${newCatName}" creada`);
    setNewCatName('');
    fetchCategories();
  };

  const saveCategoryEdit = async (id: number, oldName: string) => {
    if (!editCatName.trim()) return;
    // Update category name
    await supabase.from('categories').update({ name: editCatName.trim() }).eq('id', id);
    // Update all products that had the old name
    await supabase.from('products').update({ category: editCatName.trim() }).eq('bakery_id', bakeryId).eq('category', oldName);
    toast.success(`Categoría renombrada a "${editCatName}"`);
    setEditCatId(null);
    fetchCategories();
    fetchProducts();
  };

  const deleteCategory = async (id: number, name: string) => {
    const productsInCat = products.filter(p => p.category === name);
    if (productsInCat.length > 0) {
      if (!confirm(`Hay ${productsInCat.length} productos en "${name}". Se moverán a "Otro". ¿Continuar?`)) return;
      await supabase.from('products').update({ category: 'Otro' }).eq('bakery_id', bakeryId).eq('category', name);
    }
    await supabase.from('categories').delete().eq('id', id);
    toast.success(`Categoría "${name}" eliminada`);
    fetchCategories();
    fetchProducts();
  };

  // ===== PRODUCT ACTIONS =====
  const addProduct = async () => {
    if (!newForm.name.trim()) {
      toast.error('Debes ingresar un nombre para el producto');
      return;
    }
    if (!newForm.category) {
      toast.error('Debes seleccionar una categoría');
      return;
    }

    const { error } = await supabase.from('products').insert({
      bakery_id: bakeryId, 
      name: newForm.name.trim(), 
      category: newForm.category, 
      price: Number(newForm.price) || 0, 
      sell_type: newForm.sell_type,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Producto agregado');
    setNewForm({ name: '', category: categories[0]?.name || '', price: 2190, sell_type: 'per_kg' });
    setShowAdd(false);
    fetchProducts();
  };

  const saveEdit = async (id: number) => {
    if (!editForm.name.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    if (!editForm.category) {
      toast.error('Debes seleccionar una categoría');
      return;
    }

    const { error } = await supabase.from('products').update({ 
      name: editForm.name.trim(), 
      category: editForm.category, 
      price: Number(editForm.price) || 0, 
      sell_type: editForm.sell_type 
    }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Producto actualizado');
    setEditingId(null);
    fetchProducts();
  };

  const toggleActive = async (id: number, current: boolean) => {
    await supabase.from('products').update({ is_active: !current }).eq('id', id);
    fetchProducts();
  };

  const deleteProduct = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    await supabase.from('products').delete().eq('id', id);
    toast.success(`"${name}" eliminado`);
    fetchProducts();
  };

  const filteredAndSortedProducts = products
    .filter(p => {
      const normalizedQuery = normalizeString(searchQuery);
      const matchesSearch = normalizeString(p.name).includes(normalizedQuery) || 
                            normalizeString(p.category).includes(normalizedQuery);
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'newest': return b.id - a.id;
        case 'oldest': return a.id - b.id;
        case 'a-z': return a.name.localeCompare(b.name);
        case 'z-a': return b.name.localeCompare(a.name);
        default: return 0;
      }
    });

  const grouped = filteredAndSortedProducts.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, Product[]>);

  // Sort the category keys themselves according to the active sort option:
  // For name-based sorts, sort categories alphabetically (or reverse).
  // For recency sorts, use the max/min product id within each category as a proxy.
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    switch (sortOption) {
      case 'a-z': return a.localeCompare(b);
      case 'z-a': return b.localeCompare(a);
      case 'newest': {
        const maxA = Math.max(...grouped[a].map(p => p.id));
        const maxB = Math.max(...grouped[b].map(p => p.id));
        return maxB - maxA;
      }
      case 'oldest': {
        const minA = Math.min(...grouped[a].map(p => p.id));
        const minB = Math.min(...grouped[b].map(p => p.id));
        return minA - minB;
      }
      default: return a.localeCompare(b);
    }
  });

  const formatPrice = (price: number, sell_type: string) =>
    `$${new Intl.NumberFormat('es-CL').format(price)}${sell_type === 'per_kg' ? '/kg' : ' c/u'}`;

  const categoryNames = categories.map(c => c.name);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  return (
    <div className="iphone-liquid-page-safe min-h-screen bg-theme-base text-theme-base p-4 md:p-8">

      <header className="max-w-4xl mx-auto mb-8 flex flex-col gap-5">
        {/* Modern Stepper UI */}
        <div className="bg-gray-900/40 rounded-3xl p-2 md:p-3 border border-white/10 backdrop-blur-sm shadow-2xl flex flex-col md:flex-row items-stretch gap-2 transition-all">
          
          {/* STEP 1: CATEGORÍAS */}
          <button 
            data-tour="categories-toggle"
            onClick={() => { setShowCats(!showCats); setShowAdd(false); }}
            className={`flex-1 flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
              showCats 
                ? 'bg-orange-600 text-white shadow-[0_0_30px_rgba(234,88,12,0.2)]' 
                : 'bg-gray-950/40 text-gray-400 hover:bg-gray-950/60 hover:text-gray-200'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 transition-all ${
              showCats ? 'bg-white text-orange-600 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-gray-950 text-gray-300 border border-white/5 group-hover:bg-gray-700 group-hover:text-white'
            }`}>
              1
            </div>
            <div className="text-left">
              <p className={`text-[11px] font-black uppercase tracking-[0.2em] mb-0.5 ${showCats ? 'text-orange-200' : 'text-gray-400 group-hover:text-gray-200'}`}>Paso 1</p>
              <h3 className={`font-black transition-all ${showCats ? 'text-white text-base md:text-lg' : 'text-gray-300 text-sm md:text-base group-hover:text-white'}`}>Categorías</h3>
            </div>
            <Folder className={`w-6 h-6 ml-auto opacity-20 transition-transform ${showCats ? 'scale-125 rotate-6' : 'group-hover:opacity-40'}`} />
          </button>

          {/* Spacer / Arrow on Desktop */}
          <div className="hidden md:flex items-center justify-center px-1 text-gray-800">
            <ChevronDown className="-rotate-90 w-4 h-4" />
          </div>

          {/* STEP 2: PRODUCTOS */}
          <button 
            data-tour="add-product-toggle"
            onClick={() => { 
                if (categoryNames.length === 0) {
                    toast.error("Primero debes crear al menos una categoría");
                    setShowCats(true);
                    return;
                }
                setShowAdd(!showAdd); 
                setShowCats(false); 
            }}
            className={`flex-1 flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
              showAdd 
                ? 'bg-emerald-600 text-white shadow-[0_0_30px_rgba(16,185,129,0.2)]' 
                : 'bg-gray-950/40 text-gray-400 hover:bg-gray-950/60 hover:text-gray-200'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 transition-all ${
              showAdd ? 'bg-white text-emerald-600 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-gray-950 text-gray-300 border border-white/5 group-hover:bg-gray-700 group-hover:text-white'
            }`}>
              2
            </div>
            <div className="text-left">
              <p className={`text-[11px] font-black uppercase tracking-[0.2em] mb-0.5 ${showAdd ? 'text-emerald-200' : 'text-gray-400 group-hover:text-gray-200'}`}>Paso 2</p>
              <h3 className={`font-black transition-all ${showAdd ? 'text-white text-base md:text-lg' : 'text-gray-300 text-sm md:text-base group-hover:text-white'}`}>Productos</h3>
            </div>
            <Package className={`w-6 h-6 ml-auto opacity-20 transition-transform ${showAdd ? 'scale-125 rotate-6' : 'group-hover:opacity-40'}`} />
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto">
        
        {/* ===== PANEL CATEGORÍAS ===== */}
        {showCats && (
          <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl p-6 md:p-8 mb-6 border border-orange-500/20 shadow-[0_0_40px_rgba(234,88,12,0.06)] animate-fadeIn">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6" data-tour="category-manager">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                <Folder className="w-6 h-6 text-orange-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-white mb-1">Gestionar Categorías</h3>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Las categorías agrupan tus productos en el menú de WhatsApp. Ej: <span className="text-gray-400 font-semibold">Panes</span>, <span className="text-gray-400 font-semibold">Dulces</span>, <span className="text-gray-400 font-semibold">Bebidas</span>.
                </p>
              </div>
              <button onClick={() => setShowCats(false)} className="p-2 rounded-xl bg-gray-950 hover:bg-gray-700 text-gray-400 hover:text-white transition-all active:scale-90 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input Row */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Folder className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500/50" />
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nombre de la categoría..."
                  className="w-full bg-gray-950/80 text-white rounded-xl pl-10 pr-4 py-3.5 border border-white/5 hover:border-white/5 focus:border-orange-500 focus:outline-none text-sm transition-colors"
                  onKeyDown={e => e.key === 'Enter' && addCategory()} />
              </div>
              <button onClick={addCategory} 
                className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-black py-3.5 px-8 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-900/20 w-full sm:w-auto shrink-0 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Agregar Categoría
              </button>
            </div>

            {/* Divider */}
            {categories.length > 0 && (
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gray-950" />
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">
                  {categories.length} {categories.length === 1 ? 'categoría creada' : 'categorías creadas'}
                </span>
                <div className="h-px flex-1 bg-gray-950" />
              </div>
            )}

            {/* Category List */}
            <div className="space-y-2">
              {categories.length === 0 ? (
                <div className="text-center py-8 bg-gray-950/30 rounded-2xl border border-dashed border-white/5">
                  <Folder className="w-10 h-10 mx-auto mb-3 text-orange-500/20" />
                  <p className="text-gray-400 text-sm font-bold">Aún no tienes categorías</p>
                  <p className="text-gray-600 text-xs mt-1">Escribe un nombre arriba y presiona "Agregar Categoría"</p>
                </div>
              ) : categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between bg-gray-950/60 hover:bg-gray-950 rounded-xl px-4 py-3 transition-colors group/cat">
                  {editCatId === cat.id ? (
                    <div className="flex gap-2 flex-1">
                      <input value={editCatName} onChange={e => setEditCatName(e.target.value)}
                        className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 border border-orange-500/40 focus:border-orange-500 focus:outline-none text-sm"
                        onKeyDown={e => e.key === 'Enter' && saveCategoryEdit(cat.id, cat.name)}
                        autoFocus />
                      <button onClick={() => saveCategoryEdit(cat.id, cat.name)} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg transition-all active:scale-90">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditCatId(null)} className="bg-gray-600 hover:bg-gray-500 text-white p-2 rounded-lg transition-all active:scale-90">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="font-bold text-white">{cat.name}</span>
                        <span className="text-[10px] text-gray-500 font-bold bg-gray-900 px-2 py-0.5 rounded-full">
                          {(() => {
                            const count = products.filter(p => p.category === cat.name).length;
                            return `${count} ${count === 1 ? 'producto' : 'productos'}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-50 group-hover/cat:opacity-100 transition-opacity">
                        <button onClick={() => { setEditCatId(cat.id); setEditCatName(cat.name); }}
                          className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition-all active:scale-90" title="Renombrar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteCategory(cat.id, cat.name)}
                          className="bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white p-2 rounded-lg transition-all active:scale-90" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Footer hint */}
            {categories.length > 0 && (
              <p className="text-center text-gray-600 text-[10px] mt-5 uppercase tracking-widest font-bold">
                Una vez creadas, continúa al Paso 2 para agregar productos
              </p>
            )}
          </div>
        )}

        {/* ===== PANEL NUEVO PRODUCTO ===== */}
        {showAdd && (
          <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl p-6 md:p-8 mb-6 border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.06)] animate-fadeIn">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6" data-tour="add-product">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Package className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-white mb-1">Agregar Nuevo Producto</h3>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Completa los datos y tu producto aparecerá en el catálogo de WhatsApp bajo la categoría seleccionada.
                </p>
              </div>
              <button onClick={() => setShowAdd(false)} className="p-2 rounded-xl bg-gray-950 hover:bg-gray-700 text-gray-400 hover:text-white transition-all active:scale-90 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {categoryNames.length === 0 ? (
              <div className="text-center py-8 bg-yellow-500/5 rounded-2xl border border-yellow-500/20">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-yellow-500/50" />
                <p className="text-yellow-400 text-sm font-bold">Necesitas al menos una categoría</p>
                <p className="text-gray-500 text-xs mt-1">Vuelve al Paso 1 para crear tu primera categoría.</p>
                <button onClick={() => { setShowAdd(false); setShowCats(true); }} className="mt-4 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black py-2.5 px-6 rounded-xl transition-all active:scale-95">
                  Ir al Paso 1
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {/* Name */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Nombre del producto</label>
                    <input value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                      placeholder="Ej: Marraqueta, Torta de Chocolate..." className="w-full bg-gray-950/80 text-white rounded-xl px-4 py-3.5 border border-white/5 hover:border-white/5 focus:border-emerald-500 focus:outline-none text-sm transition-colors" />
                  </div>

                  {/* Category + Price Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Categoría</label>
                      <div className="relative">
                        <Folder className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500/50" />
                        <select value={newForm.category} onChange={e => setNewForm({ ...newForm, category: e.target.value })}
                          className="w-full bg-gray-950/80 text-white rounded-xl pl-10 pr-4 py-3.5 border border-white/5 hover:border-white/5 focus:border-emerald-500 focus:outline-none text-sm appearance-none cursor-pointer transition-colors">
                          <option value="">Selecciona...</option>
                          {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Precio ({newForm.sell_type === 'per_kg' ? 'por kilo' : 'por unidad'})</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500/70 font-black text-sm">$</span>
                        <input type="number" value={newForm.price} 
                          onChange={e => setNewForm({ ...newForm, price: e.target.value })}
                          onBlur={() => setNewForm({ ...newForm, price: Math.max(0, Number(newForm.price) || 0) })}
                          placeholder="0" className="w-full bg-gray-950/80 text-white rounded-xl pl-8 pr-14 py-3.5 border border-white/5 hover:border-white/5 focus:border-emerald-500 focus:outline-none text-sm transition-colors" />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">{newForm.sell_type === 'per_kg' ? '/kg' : 'c/u'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sell Type */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Tipo de venta</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setNewForm({ ...newForm, sell_type: 'per_kg' })}
                        className={`py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2.5 ${newForm.sell_type === 'per_kg' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20 ring-2 ring-orange-500/30' : 'bg-gray-950/60 text-gray-400 border border-white/5 hover:border-white/5 hover:text-gray-300'}`}>
                        <Scale className="w-4 h-4" /> Por Kilo
                      </button>
                      <button onClick={() => setNewForm({ ...newForm, sell_type: 'per_unit' })}
                        className={`py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2.5 ${newForm.sell_type === 'per_unit' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20 ring-2 ring-orange-500/30' : 'bg-gray-950/60 text-gray-400 border border-white/5 hover:border-white/5 hover:text-gray-300'}`}>
                        <Hash className="w-4 h-4" /> Por Unidad
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <button onClick={addProduct} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-lg shadow-emerald-900/20 text-sm">
                  <CheckCircle2 className="w-5 h-5" /> Guardar Producto
                </button>
              </>
            )}
          </div>
        )}
        
        {/* ===== TÍTULO Y EXPLICACIÓN (PLEGABLE) ===== */}
        <section className="mb-10 animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-black text-white tracking-tight">Categorías y sus productos</h2>
                <button 
                  onClick={() => setShowHelp(!showHelp)}
                  className="p-1.5 rounded-lg bg-gray-900 border border-white/5 text-gray-400 hover:text-orange-500 transition-all active:scale-90"
                  title={showHelp ? "Minimizar información" : "Expandir información"}
                >
                  <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${showHelp ? 'rotate-180' : ''}`} />
                </button>
              </div>
              <p className="text-gray-400 mt-2 text-sm max-w-2xl leading-relaxed">
                Organiza tu catálogo siguiendo los pasos superiores. 
                Los productos aparecerán automáticamente en el bot de WhatsApp según su categoría.
              </p>
            </div>
            {showHelp && (
              <div className="hidden lg:flex items-center gap-2 bg-gray-900/50 border border-white/5 px-4 py-2 rounded-2xl text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                <Sparkles className="w-3 h-3 text-orange-500" /> Ayuda Visual
              </div>
            )}
          </div>

          {showHelp && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-900/30 p-5 rounded-[2.5rem] border border-white/10 backdrop-blur-sm animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <Play className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-300 uppercase mb-0.5">Activar</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Muestra el producto en el menú del bot.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0 border border-yellow-500/20">
                  <Pause className="w-4 h-4 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-300 uppercase mb-0.5">Pausar</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Oculta el producto temporalmente sin borrarlo.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-950 flex items-center justify-center shrink-0 border border-white/5">
                  <Pencil className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-300 uppercase mb-0.5">Editar</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Cambia nombre, precio o categoría actual.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-300 uppercase mb-0.5">Eliminar</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Quita el producto de forma definitiva.</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ===== BÚSQUEDA Y FILTROS COMPONENT ===== */}
        {(products.length > 0 || searchQuery !== '' || selectedCategory !== 'all') && !showCats && !showAdd && (
          <div className="bg-gray-900 shadow-2xl rounded-3xl p-4 md:p-5 mb-8 border border-white/5 animate-fadeIn space-y-4 md:space-y-0">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              
              {/* Buscador */}
              <div className="md:col-span-5 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500/50 group-focus-within:text-orange-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Buscar productos..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-950 text-white rounded-2xl pl-11 pr-10 py-3.5 border border-white/5 focus:border-orange-500 focus:outline-none text-sm transition-all placeholder:text-gray-600 shadow-inner"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-950 text-gray-500 hover:text-white transition-all">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Categoría Filter */}
              <div className="md:col-span-4 relative group">
                <Folder className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500/50 group-focus-within:text-orange-500 transition-colors" />
                <select 
                  value={selectedCategory} 
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full bg-gray-950 text-white rounded-2xl pl-11 pr-10 py-3.5 border border-white/5 focus:border-orange-500 focus:outline-none text-sm appearance-none cursor-pointer transition-all shadow-inner"
                >
                  <option value="all">Todas las categorías</option>
                  {categoryNames.sort().map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none group-focus-within:rotate-180 transition-transform" />
              </div>

              {/* Ordenar */}
              <div className="md:col-span-3 relative group">
                <ArrowUpDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500/50 group-focus-within:text-orange-500 transition-colors" />
                <select 
                  value={sortOption} 
                  onChange={e => setSortOption(e.target.value)}
                  className="w-full bg-gray-950 text-white rounded-2xl pl-11 pr-10 py-3.5 border border-white/5 focus:border-orange-500 focus:outline-none text-sm appearance-none cursor-pointer transition-all shadow-inner"
                >
                  <option value="newest">Más recientes</option>
                  <option value="oldest">Más antiguos</option>
                  <option value="a-z">Clasificar A - Z</option>
                  <option value="z-a">Clasificar Z - A</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none group-focus-within:rotate-180 transition-transform" />
              </div>

            </div>
          </div>
        )}

        {/* ===== LISTA DE PRODUCTOS ===== */}
        {loading ? (
          <div className="text-center text-gray-500 py-20 animate-pulse">Cargando...</div>
        ) : products.length === 0 && !showCats && !showAdd ? (
          <div className="bg-gradient-to-b from-gray-900/80 to-gray-950 rounded-3xl border border-white/5 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-10 md:p-14 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-gray-950/50 rounded-full flex items-center justify-center border border-white/5 mb-6 shadow-inner">
                <Folder className="w-10 h-10 text-orange-500 opacity-80" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Comienza a armar tu catálogo</h2>
              <p className="text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
                Para mantener todo organizado, el primer paso es definir las <strong className="text-gray-200">categorías</strong> de tu tienda (ej: Panes, Dulces, Bebidas).
              </p>
              
              <button onClick={() => { setShowCats(true); setShowAdd(false); }}
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 font-bold text-white transition-all duration-200 bg-orange-600 rounded-2xl hover:bg-orange-500 hover:shadow-[0_0_40px_rgba(234,88,12,0.4)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-600 focus:ring-offset-gray-900 active:scale-95">
                <span>Paso 1: Crear Categorías</span>
                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        ) : products.length === 0 ? (
           <div className="text-center py-20 bg-gray-900/50 rounded-3xl border border-dashed border-white/5">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-700" />
            <p className="text-gray-400 text-lg font-bold">Sin productos en tu catálogo</p>
            <p className="text-gray-500 text-sm mt-2">Ahora que estás configurando, puedes comenzar a agregar productos.</p>
          </div>
        ) : filteredAndSortedProducts.length === 0 && (searchQuery || selectedCategory !== 'all') ? (
          <div className="text-center py-20 bg-gray-900/40 rounded-[2.5rem] border border-dashed border-white/5 animate-fadeIn flex flex-col items-center">
            <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center border border-white/5 mb-6 group">
              <Search className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-white text-xl font-black mb-2">Sin resultados encontrados</p>
            <p className="text-gray-500 text-sm max-w-xs mx-auto mb-8 leading-relaxed">
              No encontramos productos que coincidan con los filtros aplicados. Intenta con otros términos.
            </p>
            <button 
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-black py-3 px-8 rounded-2xl transition-all active:scale-95 shadow-lg shadow-orange-950/40 uppercase tracking-widest"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          sortedCategories.map(category => {
            const isExpanded = (searchQuery.trim() !== '' || selectedCategory !== 'all') || expandedCategories.includes(category);
            const productCount = grouped[category].length;

            return (
              <div key={category} className="mb-4">
                <button 
                  onClick={() => toggleCategory(category)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${isExpanded ? 'bg-orange-600/10 border-orange-500/30 mb-2' : 'bg-gray-900 border-white/5 hover:border-white/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-all duration-300 shadow-lg ${isExpanded ? 'bg-orange-500 text-white shadow-orange-500/20' : 'bg-orange-500/20 text-orange-500 border border-orange-500/30'}`}>
                      <Folder className="w-5 h-5 fill-orange-500/20" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-white text-lg leading-tight capitalize">{category}</h3>
                      <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">
                        {productCount} {productCount === 1 ? 'Producto' : 'Productos'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-6 h-6 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-orange-500' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="bg-gray-900 rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden animate-fadeIn">
                    {grouped[category].map(product => (
                      <div key={product.id} className="p-4 hover:bg-gray-950/50 transition-colors">
                        {editingId === product.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm" />
                               <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm">
                                {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <input type="number" value={editForm.price} 
                                onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                                onBlur={() => setEditForm({ ...editForm, price: Math.max(0, Number(editForm.price) || 0) })}
                                className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm" />
                              <select value={editForm.sell_type} onChange={e => setEditForm({ ...editForm, sell_type: e.target.value })}
                                className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm">
                                <option value="per_kg">Por Kilo</option>
                                <option value="per_unit">Por Unidad</option>
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveEdit(product.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-xl">Guardar</button>
                              <button onClick={() => setEditingId(null)} className="bg-gray-700 text-white text-xs py-2 px-4 rounded-xl">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${product.is_active ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                              <span className={`font-bold truncate ${product.is_active ? 'text-white' : 'text-gray-500 italic'}`}>{product.name}</span>
                              {!product.is_active && (
                                <span className="text-[9px] font-black bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 uppercase tracking-widest shrink-0 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                                  Producto Pausado
                                </span>
                              )}
                              <span className="text-orange-400 font-bold text-sm shrink-0">{formatPrice(product.price, product.sell_type)}</span>
                              <span className="flex items-center gap-1 text-[10px] bg-gray-950 text-gray-400 px-2 py-0.5 rounded-full shrink-0">
                                {product.sell_type === 'per_kg' ? <Scale className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
                                {product.sell_type === 'per_kg' ? 'Kilo' : 'Unidad'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button onClick={() => toggleActive(product.id, product.is_active)}
                                className={`p-2 rounded-xl transition-all border ${product.is_active ? 'bg-gray-950 text-yellow-500 border-white/5' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'} active:scale-90`}>
                                {product.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                              <button onClick={() => { setEditingId(product.id); setEditForm({ name: product.name, category: product.category, price: product.price, sell_type: product.sell_type }); }}
                                className="bg-gray-950 hover:bg-gray-700 text-white p-2 rounded-xl border border-white/5 transition-all active:scale-90">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => deleteProduct(product.id, product.name)}
                                className="bg-gray-950 hover:bg-red-500/10 text-red-500 p-2 rounded-xl border border-white/5 hover:border-red-500/20 transition-all active:scale-90">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
