import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { ShieldCheck, House, Package, Users, Key, Settings, Star, CheckCircle2, Copy, Trash2, Lightbulb, Eye, EyeOff, MapPin, Play, Pause, Pencil, Phone, Clock, Calendar, Megaphone, Ban, RotateCcw, Plus, AlertTriangle, ChevronDown } from 'lucide-react';
import { CHILE_DATA } from '../lib/chile-data';
import { fetchJson } from '../lib/api';
import { usePageHeader } from '../components/AppLayout';

type Bakery = { id: number; user_id: string; name: string; contact_phone: string; location: string; region?: string; comuna?: string; ciudad?: string; created_at: string; order_expiry_minutes?: number; is_sponsored?: boolean; is_active: boolean; is_alert_unlocked?: boolean; };
type Product = { id: number; bakery_id: number; category: string; name: string; price: number; sell_type: string; is_active: boolean; bakery_name?: string; };
type Customer = { phone_number: string; name?: string; strikes: number; is_blocked: boolean; created_at: string; real_phone?: string; bakery_customers?: { bakery_id: number; bakeries: { name: string } }[] };
type InvKey = { id: number; key_code: string; label: string; is_used: boolean; used_by_email: string | null; used_at: string | null; created_at: string; };

type Tab = 'bakeries' | 'products' | 'customers' | 'keys' | 'settings';

export default function Admin() {
  const formatPhoneNumber = (jid: string) => {
    const clean = jid.split('@')[0];
    if (!clean) return 'S/N';
    if (clean.startsWith('569') && clean.length === 11) {
      return `+56 9 ${clean.slice(3, 7)} ${clean.slice(7)}`;
    }
    if (/^\d+$/.test(clean)) {
      return `+${clean.replace(/(\d{4})(?=\d)/g, '$1 ')}`;
    }
    return clean;
  };
  const [tab, setTab] = useState<Tab>('bakeries');
  const [bakeries, setBakeries] = useState<Bakery[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invKeys, setInvKeys] = useState<InvKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [stats, setStats] = useState({ bakeries: 0, products: 0, customers: 0, orders: 0, keys: 0 });
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [expandedBakeries, setExpandedBakeries] = useState<Set<number>>(new Set());
  const [settings, setSettings] = useState<any>({ sponsored_limit: 3, closing_soon_minutes: 15 });
  const [savingSetting, setSavingSetting] = useState(false);

  useEffect(() => { document.title = 'AhoraPan - Admin'; fetchAll(); }, []);
  usePageHeader({
    title: (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-500"><ShieldCheck className="h-4 w-4" /></span>
        <h1 className="truncate text-lg font-black tracking-tight text-theme-base md:text-xl">Administración</h1>
      </div>
    ),
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [bk, pr, cu, ord, ik, st] = await Promise.all([
        supabase.from('bakeries').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('bakery_id').order('category').order('name'),
        supabase.from('customers').select('*, bakery_customers(bakery_id, bakeries(name))').order('created_at', { ascending: false }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('invitation_keys').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*'),
      ]);
      
      // Diagnóstico de errores
      if (bk.error) console.error("❌ Error Panaderías:", bk.error);
      if (pr.error) console.error("❌ Error Productos:", pr.error);
      if (cu.error) console.error("❌ Error Clientes:", cu.error);
      if (ik.error) console.error("❌ Error Invitaciones:", ik.error);
      if (st.error) console.error("❌ Error Ajustes:", st.error);

      if (cu.error?.message?.includes('relationship')) {
        toast.error('Error de base de datos en Clientes. Contacta a soporte.');
      }

      const bakeryList = bk.data || [];
      const productList = (pr.data || []).map((p: any) => ({
        ...p,
        bakery_name: bakeryList.find(b => b.id === p.bakery_id)?.name || `ID:${p.bakery_id}`
      }));
      const keyList = ik.data || [];

      setBakeries(bakeryList);
      setProducts(productList);
      setCustomers(cu.data || []);
      setInvKeys(keyList);
      setSettings(st.data?.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {}) || { sponsored_limit: 3, closing_soon_minutes: 15 });
      setStats({
        bakeries: bakeryList.length,
        products: productList.length,
        customers: (cu.data || []).length,
        orders: ord.count || 0,
        keys: keyList.filter(k => !k.is_used).length,
      });
    } catch (err) {
      console.error("🔥 Error crítico en Admin:", err);
      toast.error('Ocurrió un error al cargar los datos.');
    } finally {
      setLoading(false);
    }
  };

  // ===== BAKERY ACTIONS =====
  const formatCityName = (city: string) => {
    if (!city) return '';
    return city.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const saveBakery = async (id: number) => {
    const formattedEditForm = { ...editForm };
    if (formattedEditForm.ciudad) {
       formattedEditForm.ciudad = formatCityName(formattedEditForm.ciudad);
    }
    const { error } = await supabase.from('bakeries').update(formattedEditForm).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Panadería actualizada');
    setEditingId(null);
    fetchAll();
  };

  const toggleSponsored = async (id: number, currentStatus: boolean) => {
    // Si intentamos ACTIVAR, verificamos el límite
    if (!currentStatus) {
      const sponsoredCount = bakeries.filter(b => b.is_sponsored).length;
      const limit = settings.sponsored_limit || 0;
      
      if (sponsoredCount >= limit) {
        toast.error(`Límite alcanzado (${limit}). Aumenta el máximo en Ajustes.`);
        return;
      }
    }

    const { error } = await supabase.from('bakeries').update({ is_sponsored: !currentStatus }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(!currentStatus ? 'Panadería Patrocinada' : 'Patrocinio removido');
    fetchAll();
  };

  const toggleBakeryActive = async (id: number, currentStatus: boolean) => {
    const { error } = await supabase.from('bakeries').update({ is_active: !currentStatus }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(!currentStatus ? 'Panadería visible' : 'Panadería ocultada');
    fetchAll();
  };

  const toggleAlertUnlocked = async (id: number, currentStatus: boolean) => {
    const { error } = await supabase.from('bakeries').update({ is_alert_unlocked: !currentStatus }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(!currentStatus ? 'Suscripción Alertas Activa' : 'Suscripción Alertas Removida');
    fetchAll();
  };

  const deleteBakery = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar "${name}" y TODO lo asociado? Esto también borrará permanentemente la cuenta del usuario.`)) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa");

      await fetchJson(`/api/admin/bakery/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      toast.success(`"${name}" y su cuenta eliminadas`);
      fetchAll();
    } catch (err: any) {
      console.error("Error al eliminar panadería:", err);
      toast.error(err.message || 'No se pudo eliminar la panadería');
    }
  };

  // ===== PRODUCT ACTIONS =====
  const saveProduct = async (id: number) => {
    const { error } = await supabase.from('products').update(editForm).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Producto actualizado');
    setEditingId(null);
    fetchAll();
  };

  const toggleProduct = async (id: number, active: boolean) => {
    await supabase.from('products').update({ is_active: !active }).eq('id', id);
    fetchAll();
  };

  const deleteProduct = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    await supabase.from('products').delete().eq('id', id);
    toast.success(`"${name}" eliminado`);
    fetchAll();
  };

  // ===== CUSTOMER ACTIONS =====
  const toggleBlock = async (phone: string, blocked: boolean) => {
    await supabase.from('customers').update({ is_blocked: !blocked }).eq('phone_number', phone);
    toast.success(blocked ? 'Cliente desbloqueado' : 'Cliente bloqueado');
    fetchAll();
  };

  const resetStrikes = async (phone: string) => {
    await supabase.from('customers').update({ strikes: 0 }).eq('phone_number', phone);
    toast.success('Strikes reseteados');
    fetchAll();
  };

  // ===== KEY ACTIONS =====
  const generateKey = async () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'APAN-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    
    const { error } = await supabase.from('invitation_keys').insert({ key_code: code, label: newKeyLabel.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success(`Clave generada: ${code}`);
    setNewKeyLabel('');
    fetchAll();
  };

  const deleteKey = async (id: number) => {
    await supabase.from('invitation_keys').delete().eq('id', id);
    toast.success('Clave eliminada');
    fetchAll();
  };

  const copyKey = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Clave "${code}" copiada`);
  };

  // ===== SETTINGS ACTIONS =====
  const updateSetting = async (key: string, value: any) => {
    setSavingSetting(true);
    const { error } = await supabase.from('settings').upsert({ key, value }).eq('key', key);
    setSavingSetting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Configuración guardada');
    fetchAll();
  };
  
  const toggleBakeryExpanded = (id: number) => {
    const next = new Set(expandedBakeries);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedBakeries(next);
  };

  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: 'bakeries', label: 'Panaderías', icon: House, count: stats.bakeries },
    { key: 'products', label: 'Productos', icon: Package, count: stats.products },
    { key: 'customers', label: 'Clientes', icon: Users, count: stats.customers },
    { key: 'keys', label: 'Invitaciones', icon: Key, count: stats.keys },
    { key: 'settings', label: 'Ajustes', icon: Settings, count: 0 },
  ];

  const statCards = [
    { key: 'bakeries' as Tab, label: 'Panaderías', value: stats.bakeries, icon: House },
    { key: 'products' as Tab, label: 'Productos', value: stats.products, icon: Package },
    { key: 'customers' as Tab, label: 'Clientes', value: stats.customers, icon: Users },
    { key: 'keys' as Tab, label: 'Invitaciones', value: stats.keys, icon: Key },
  ];

  return (
    <div className="min-h-screen bg-theme-base text-theme-base p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* Stats — también funcionan como acceso directo a cada sección */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {statCards.map(s => (
            <button
              key={s.label}
              onClick={() => { setTab(s.key); setEditingId(null); }}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:border-orange-500/30 ${tab === s.key ? 'border-orange-500/40 bg-orange-500/[0.06]' : 'border-theme bg-theme-panel'}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-500">
                <s.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-2xl font-black leading-none text-theme-base">{s.value}</span>
                <span className="mt-1 block text-[11px] font-bold uppercase tracking-wide text-theme-muted">{s.label}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 custom-scrollbar">
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setEditingId(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 border ${tab === t.key ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-900/20' : 'border-theme bg-theme-panel text-theme-muted hover:text-theme-base hover:border-orange-500/30'}`}>
              <t.icon className="w-4 h-4" />
              {t.label}{t.key !== 'settings' ? ` · ${t.count}` : ''}
            </button>
          ))}
        </div>



        {loading ? (
          <div className="text-center text-gray-500 py-20 animate-pulse">Cargando...</div>
        ) : (
          <>
            {/* ===== PANADERÍAS ===== */}
            {tab === 'bakeries' && (
              <div className="bg-gray-900 rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                {bakeries.map(b => (
                  <div key={b.id} className="p-4 hover:bg-gray-950/50 transition-colors">
                    {editingId === b.id ? (
                      <div className="space-y-4 bg-gray-950/20 p-4 rounded-2xl border border-white/10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Nombre</label>
                            <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                              className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1">WhatsApp</label>
                            <input value={editForm.contact_phone} onChange={e => setEditForm({ ...editForm, contact_phone: e.target.value })}
                              className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Región</label>
                            <select 
                              value={editForm.region} 
                              onChange={e => setEditForm({ ...editForm, region: e.target.value, comuna: '' })}
                              className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm"
                            >
                              <option value="">Selecciona Región</option>
                              {CHILE_DATA.map(r => <option key={r.region} value={r.region}>{r.region}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Comuna</label>
                            <select 
                              value={editForm.comuna} 
                              onChange={e => setEditForm({ ...editForm, comuna: e.target.value })}
                              disabled={!editForm.region}
                              className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm disabled:opacity-50"
                            >
                              <option value="">Selecciona Comuna</option>
                              {(CHILE_DATA.find(r => r.region === editForm.region)?.comunas || []).map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Ciudad/Sector</label>
                            <input list="admin-ciudades-list" value={editForm.ciudad || ''} onChange={e => setEditForm({ ...editForm, ciudad: e.target.value })}
                              placeholder="Ej: Reñaca" className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm" />
                            <datalist id="admin-ciudades-list">
                              {Array.from(new Set(bakeries.filter(b => b.comuna === editForm.comuna).map(b => (b as any).ciudad || '').filter(Boolean))).map(c => (
                                <option key={c as string} value={c as string} />
                              ))}
                            </datalist>
                          </div>
                          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Dirección</label>
                            <input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                              className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveBakery(b.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-xl">Guardar</button>
                          <button onClick={() => setEditingId(null)} className="bg-gray-700 text-white text-xs py-2 px-4 rounded-xl">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${!b.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-white truncate">{b.name}</span>
                            {!b.is_active && <span className="text-[10px] bg-red-500/10 text-red-500 border border-red-500/50 px-2 py-0.5 rounded-full font-black tracking-wider">OCULTA</span>}
                            {b.is_alert_unlocked && <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-2 py-0.5 rounded-full font-black tracking-wider"><Megaphone className="w-3 h-3" /> SUSCRIPCIÓN</span>}
                            {b.is_sponsored && b.is_active && <span className="flex items-center gap-1 text-[10px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 px-2 py-0.5 rounded-full font-black tracking-wider"><Star className="w-3 h-3 fill-yellow-500" /> PATROCINADA</span>}
                            <span className="text-[10px] bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full shrink-0">ID:{b.id}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-orange-500/50" />
                                <span>{b.region}, {b.comuna}{b.ciudad ? ` (${b.ciudad})` : ''} — {b.location}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-orange-500/50" />
                                <span>{b.contact_phone || '—'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-orange-500/50" />
                                <span>{b.order_expiry_minutes || 30}min</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-orange-500/50" />
                                <span>{new Date(b.created_at).toLocaleDateString('es-CL')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => toggleBakeryActive(b.id, b.is_active)}
                            className={`p-2 rounded-xl border transition-all ${!b.is_active ? 'bg-red-500 text-gray-950 border-red-500 shadow-md shadow-red-900/40' : 'bg-gray-950 text-gray-400 border-white/5 hover:border-emerald-500/50 hover:text-emerald-500'}`}
                            title={b.is_active ? 'Ocultar local' : 'Mostrar local'}>
                            {b.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button onClick={() => toggleSponsored(b.id, !!b.is_sponsored)}
                            disabled={!b.is_active}
                            className={`p-2 rounded-xl border transition-all ${!b.is_active ? 'opacity-30 cursor-not-allowed bg-gray-950 text-gray-600 border-white/5' : b.is_sponsored ? 'bg-yellow-500 text-gray-950 border-yellow-500 shadow-md shadow-yellow-900/40' : 'bg-gray-950 text-gray-400 border-white/5 hover:border-yellow-500/50 hover:text-yellow-500'}`}
                            title={b.is_sponsored ? 'Quitar patrocinio' : 'Marcar como patrocinada'}>
                            <Star className={`w-4 h-4 ${b.is_sponsored ? 'fill-gray-950' : ''}`} />
                          </button>
                          <button onClick={() => toggleAlertUnlocked(b.id, !!b.is_alert_unlocked)}
                            className={`p-2 rounded-xl border transition-all ${b.is_alert_unlocked ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-900/40' : 'bg-gray-950 text-gray-400 border-white/5 hover:border-orange-500/50 hover:text-orange-500'}`}
                            title={b.is_alert_unlocked ? 'Remover suscripción alertas' : 'Activar suscripción alertas'}>
                            <Megaphone className="w-4 h-4" />
                          </button>
                          <button onClick={() => { 
                              setEditingId(b.id); 
                              setEditForm({ 
                                name: b.name, 
                                contact_phone: b.contact_phone, 
                                location: b.location,
                                region: (b as any).region || '',
                                comuna: (b as any).comuna || '',
                                ciudad: (b as any).ciudad || ''
                              }); 
                            }}
                            className="bg-gray-950 hover:bg-gray-700 text-white p-2 rounded-xl border border-white/5 transition-all">
                            <Settings className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteBakery(b.id, b.name)}
                            className="bg-gray-950 hover:bg-red-500/20 text-red-400 p-2 rounded-xl border border-white/5 hover:border-red-500/30 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {bakeries.length === 0 && <div className="p-10 text-center text-gray-500">No hay panaderías</div>}
              </div>
            )}

            {/* ===== PRODUCTOS ===== */}
            {tab === 'products' && (
              <div className="space-y-4">
                {bakeries.map(bakery => {
                  const bakeryProducts = products.filter(p => p.bakery_id === bakery.id);
                  const isExpanded = expandedBakeries.has(bakery.id);
                  
                  // Agrupar por categoría dentro del local
                  const groupedByCat = bakeryProducts.reduce((acc, p) => {
                    if (!acc[p.category]) acc[p.category] = [];
                    acc[p.category].push(p);
                    return acc;
                  }, {} as Record<string, Product[]>);
                  const sortedCats = Object.keys(groupedByCat).sort();

                  return (
                    <div key={bakery.id} className="bg-gray-900 rounded-2xl border border-white/5 overflow-hidden shadow-lg">
                      {/* Cabecera del Local */}
                      <button 
                        onClick={() => toggleBakeryExpanded(bakery.id)}
                        className="w-full flex items-center justify-between p-5 hover:bg-gray-950/80 transition-all text-left group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-orange-600/10 border border-orange-600/20 flex items-center justify-center">
                            <House className="w-6 h-6 text-orange-500" />
                          </div>
                          <div>
                            <h3 className="font-black text-white text-lg tracking-tight group-hover:text-orange-400 transition-colors">{bakery.name}</h3>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{bakeryProducts.length} productos registrados</p>
                          </div>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-orange-500' : 'text-gray-500'}`} />
                      </button>

                      {/* Listado de Productos (Desplegable) */}
                      {isExpanded && (
                        <div className="border-t border-white/5 bg-gray-950/30 animate-fadeIn">
                          {bakeryProducts.length === 0 ? (
                            <p className="p-10 text-center text-gray-600 text-sm italic">Este local aún no tiene productos configurados.</p>
                          ) : (
                            <div className="p-2 space-y-6 pb-6">
                              {sortedCats.map(catName => (
                                <div key={catName} className="mt-4">
                                  <div className="px-4 mb-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                    <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">{catName}</h4>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    {groupedByCat[catName].map(p => (
                                      <div key={p.id} className="mx-2 p-3 bg-gray-900/40 hover:bg-gray-950/60 rounded-xl border border-transparent hover:border-white/5 transition-all">
                                        {editingId === p.id ? (
                                          <div className="space-y-3 p-1">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                              <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm" />
                                              <input value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                                className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm" />
                                              <input type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: parseInt(e.target.value) || 0 })}
                                                className="bg-gray-950 text-white rounded-xl px-3 py-2 border border-white/5 focus:border-orange-500 focus:outline-none text-sm" />
                                            </div>
                                            <div className="flex gap-2">
                                              <button onClick={() => saveProduct(p.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-lg shadow-emerald-900/20">Guardar</button>
                                              <button onClick={() => setEditingId(null)} className="bg-gray-700 text-white text-xs py-2 px-4 rounded-xl">Cancelar</button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.is_active ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                                              <span className={`font-bold text-sm ${p.is_active ? 'text-gray-200' : 'text-gray-600 line-through'}`}>{p.name}</span>
                                              <span className="text-orange-500/90 font-black text-sm">${new Intl.NumberFormat('es-CL').format(p.price)}{p.sell_type === 'per_kg' ? '/kg' : ' c/u'}</span>
                                            </div>
                                            <div className="flex gap-1.5 shrink-0">
                                              <button onClick={() => toggleProduct(p.id, p.is_active)}
                                                className={`p-2 rounded-xl transition-all border ${p.is_active ? 'bg-gray-950 text-yellow-500 border-white/5' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'} active:scale-90`} title={p.is_active ? 'Pausar' : 'Activar'}>
                                                {p.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                              </button>
                                              <button onClick={() => { setEditingId(p.id); setEditForm({ name: p.name, category: p.category, price: p.price, sell_type: p.sell_type }); }}
                                                className="bg-gray-950 hover:bg-gray-700 text-white p-2 rounded-xl border border-white/5 transition-all active:scale-90" title="Editar">
                                                <Pencil className="w-4 h-4" />
                                              </button>
                                              <button onClick={() => deleteProduct(p.id, p.name)}
                                                className="bg-gray-950 hover:bg-red-500/10 text-red-500 p-2 rounded-xl border border-white/5 hover:border-red-500/20 transition-all active:scale-90" title="Eliminar">
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {bakeries.length === 0 && <div className="p-10 text-center text-gray-500">No hay panaderías registradas.</div>}
              </div>
            )}

            {/* ===== CLIENTES ===== */}
            {tab === 'customers' && (
              <div className="bg-gray-900 rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                {customers.map(c => (
                  <div key={c.phone_number} className="p-4 hover:bg-gray-950/50 transition-colors">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                         <span className={`font-mono font-bold ${c.is_blocked ? 'text-red-400 line-through' : 'text-white'}`}>{formatPhoneNumber(c.real_phone || c.phone_number)}</span>
                        {c.name && <span className="text-sm text-orange-400 font-bold">{c.name}</span>}
                        
                        {/* Etiquetas de Locales */}
                        <div className="flex flex-wrap gap-1">
                          {c.bakery_customers?.map(bc => (
                            <span key={bc.bakery_id} className="inline-flex items-center gap-1 text-[10px] bg-gray-950 text-gray-400 px-2 py-0.5 rounded-md border border-white/5">
                              <House className="w-3 h-3" /> {bc.bakeries?.name || `Local:${bc.bakery_id}`}
                            </span>
                          ))}
                        </div>

                        {c.strikes > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full font-bold"><AlertTriangle className="w-3 h-3" /> {c.strikes} strikes</span>
                        )}
                        {c.is_blocked && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full font-bold"><Ban className="w-3 h-3" /> Bloqueado</span>
                        )}
                        <span className="text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString('es-CL')}</span>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => toggleBlock(c.phone_number, c.is_blocked)}
                          className={`inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg font-bold ${c.is_blocked ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                          {c.is_blocked ? <><CheckCircle2 className="w-3.5 h-3.5" /> Desbloquear</> : <><Ban className="w-3.5 h-3.5" /> Bloquear</>}
                        </button>
                        {c.strikes > 0 && (
                          <button onClick={() => resetStrikes(c.phone_number)}
                            className="inline-flex items-center gap-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-yellow-400 py-1.5 px-3 rounded-lg">
                            <RotateCcw className="w-3.5 h-3.5" /> Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {customers.length === 0 && <div className="p-10 text-center text-gray-500">No hay clientes registrados</div>}
              </div>
            )}

            {/* ===== CLAVES DE INVITACIÓN ===== */}
            {tab === 'keys' && (
              <div>
                <div className="bg-gray-900 rounded-2xl p-5 mb-4 border border-white/5">
                  <h3 className="flex items-center gap-2 text-white font-bold mb-3"><Key className="w-4 h-4 text-orange-500" /> Generar nueva clave</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={newKeyLabel} onChange={e => setNewKeyLabel(e.target.value)}
                      placeholder="Nota (ej: Los Andes)"
                      className="flex-1 bg-gray-950 text-white rounded-xl px-4 py-3 border border-white/5 focus:border-orange-500 focus:outline-none text-sm w-full" />
                    <button onClick={generateKey}
                      className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black py-3 px-6 rounded-xl shrink-0 w-full sm:w-auto shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">
                      <Plus className="w-4 h-4" /> Generar clave
                    </button>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                  {invKeys.map(k => (
                    <div key={k.id} className={`p-4 transition-colors ${k.is_used ? 'bg-gray-900/50' : 'hover:bg-gray-950/50'}`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`font-mono font-black text-lg tracking-widest ${k.is_used ? 'text-gray-600 line-through' : 'text-orange-400'}`}>{k.key_code}</span>
                          {k.is_used ? (
                            <span className="flex items-center gap-1 text-[10px] bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Usada
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Disponible
                            </span>
                          )}
                          {k.label && <span className="text-xs text-gray-400">{k.label}</span>}
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t border-white/5 sm:border-0">
                          {k.is_used && k.used_by_email && (
                            <span className="text-[10px] text-gray-500 font-medium italic">Usada por: {k.used_by_email}</span>
                          )}
                          <div className="flex gap-2 w-full sm:w-auto">
                            {!k.is_used && (
                              <button onClick={() => copyKey(k.key_code)}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-[10px] font-black bg-gray-950 hover:bg-gray-700 text-white py-2.5 px-3 rounded-xl border border-white/5 transition-all uppercase tracking-wider">
                                <Copy className="w-3.5 h-3.5 text-orange-400" /> Copiar Clave
                              </button>
                            )}
                            <button onClick={() => deleteKey(k.id)}
                              className="bg-gray-950 hover:bg-red-500/20 text-red-500 p-2.5 rounded-xl border border-white/5 hover:border-red-500/30 transition-all flex items-center justify-center">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {invKeys.length === 0 && <div className="p-10 text-center text-gray-500">No hay claves generadas</div>}
                </div>
              </div>
            )}

            {/* ===== AJUSTES ===== */}
            {tab === 'settings' && (
              <div className="max-w-2xl">
                <div className="bg-gray-900 rounded-2xl border border-white/5 p-6 space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Settings className="w-6 h-6 text-orange-500" />
                    <div>
                      <h3 className="text-xl font-black text-white">Configuración Global</h3>
                      <p className="text-gray-400 text-sm">Ajustes generales de la plataforma Ahora Pan</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Límite de Patrocinados */}
                    {/* Límite de Patrocinados */}
                    <div className="bg-gray-950/50 p-6 rounded-2xl border border-white/5 shadow-inner">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-200 mb-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> Límite de Panaderías Patrocinadas
                      </label>
                      <p className="text-xs text-gray-500 mb-4">Número máximo de tiendas que aparecerán en la sección "Patrocinado" del bot de WhatsApp.</p>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="number" 
                          min="0" 
                          max="10"
                          value={settings.sponsored_limit || 0}
                          onChange={e => setSettings({ ...settings, sponsored_limit: parseInt(e.target.value) || 0 })}
                          className="w-24 bg-gray-900 text-white rounded-xl px-4 py-2 border border-white/5 focus:border-orange-500 focus:outline-none font-black text-lg text-center"
                        />
                        <button 
                          onClick={() => updateSetting('sponsored_limit', settings.sponsored_limit)}
                          disabled={savingSetting}
                          className={`bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-6 rounded-xl transition-all ${savingSetting ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 shadow-lg shadow-orange-900/20'}`}>
                          {savingSetting ? 'Guardando...' : 'Guardar Límite'}
                        </button>
                      </div>
                    </div>

                    {/* Aviso de Cierre Inminente */}
                    <div className="bg-gray-950/50 p-6 rounded-2xl border border-white/5 shadow-inner">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-200 mb-2">
                        <Clock className="w-4 h-4 text-orange-500" /> Aviso de Cierre Inminente
                      </label>
                      <p className="text-xs text-gray-500 mb-4">Minutos antes de cerrar para que el estado del local pase a amarillo (Cierre próximamente).</p>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="number" 
                          min="1" 
                          max="60"
                          value={settings.closing_soon_minutes || 15}
                          onChange={e => setSettings({ ...settings, closing_soon_minutes: parseInt(e.target.value) || 0 })}
                          className="w-24 bg-gray-900 text-white rounded-xl px-4 py-2 border border-white/5 focus:border-orange-500 focus:outline-none font-black text-lg text-center"
                        />
                        <button 
                          onClick={() => updateSetting('closing_soon_minutes', settings.closing_soon_minutes)}
                          disabled={savingSetting}
                          className={`bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-6 rounded-xl transition-all ${savingSetting ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 shadow-lg shadow-orange-900/20'}`}>
                          {savingSetting ? 'Guardando...' : 'Guardar Tiempo'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-amber-500/90 text-xs leading-relaxed">
                        Si estableces el límite en <strong className="font-black text-amber-400">0</strong>, la sección de patrocinados desaparecerá por completo del bot de WhatsApp, incluso si hay locales marcados individualmente.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
