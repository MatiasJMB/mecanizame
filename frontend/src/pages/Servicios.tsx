import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatCLP, parseCLP } from '../lib/format';
import { DEFAULT_CATALOG } from '../lib/taller';
import { Plus, Pencil, Trash2, Loader2, PackageOpen } from 'lucide-react';
// Acento de marca: naranja industrial. Azul queda reservado a estados.
import toast from 'react-hot-toast';

type Category = { id: string; name: string; sort_order: number };
type Service = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  base_price: number;
  is_active: boolean;
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  base_price: string;
  category_id: string;
  is_active: boolean;
};

const emptyDraft = (category_id = ''): Draft => ({
  name: '', description: '', base_price: '', category_id, is_active: true,
});

export default function Servicios() {
  const { organizationId } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => { document.title = 'Servicios — Taller Mecánico'; }, []);

  const load = async () => {
    if (!organizationId) return;
    setLoading(true);
    const [{ data: cats }, { data: svcs }] = await Promise.all([
      supabase.from('service_categories').select('*').eq('organization_id', organizationId).order('sort_order'),
      supabase.from('services').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at'),
    ]);
    setCategories(cats ?? []);
    setServices(svcs ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [organizationId]);

  const grouped = useMemo(() => {
    const byCat = new Map<string, Service[]>();
    for (const s of services) {
      const key = s.category_id ?? 'sin';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(s);
    }
    return byCat;
  }, [services]);

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name || !organizationId) return;
    const { error } = await supabase.from('service_categories').insert({
      organization_id: organizationId, name, sort_order: categories.length,
    });
    if (error) return toast.error('No se pudo crear la categoría');
    setNewCategory('');
    toast.success('Categoría creada');
    load();
  };

  const loadDefaultCatalog = async () => {
    if (!organizationId) return;
    setSaving(true);
    try {
      for (let i = 0; i < DEFAULT_CATALOG.length; i++) {
        const block = DEFAULT_CATALOG[i];
        const { data: cat, error: catErr } = await supabase
          .from('service_categories')
          .insert({ organization_id: organizationId, name: block.category, sort_order: i })
          .select('id').single();
        if (catErr || !cat) throw catErr;
        const rows = block.services.map((s) => ({
          organization_id: organizationId, category_id: cat.id,
          name: s.name, description: s.description, base_price: s.base_price,
        }));
        const { error: svcErr } = await supabase.from('services').insert(rows);
        if (svcErr) throw svcErr;
      }
      toast.success('Catálogo base de diésel cargado');
      load();
    } catch {
      toast.error('No se pudo cargar el catálogo base');
    } finally {
      setSaving(false);
    }
  };

  const saveService = async () => {
    if (!draft || !organizationId) return;
    if (!draft.name.trim()) return toast.error('El nombre es obligatorio');
    setSaving(true);
    const payload = {
      organization_id: organizationId,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      base_price: parseCLP(draft.base_price),
      category_id: draft.category_id || null,
      is_active: draft.is_active,
    };
    const { error } = draft.id
      ? await supabase.from('services').update(payload).eq('id', draft.id)
      : await supabase.from('services').insert(payload);
    setSaving(false);
    if (error) return toast.error('No se pudo guardar');
    toast.success(draft.id ? 'Servicio actualizado' : 'Servicio creado');
    setDraft(null);
    load();
  };

  const toggleActive = async (s: Service) => {
    setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
    const { error } = await supabase.from('services').update({ is_active: !s.is_active }).eq('id', s.id);
    if (error) { toast.error('No se pudo actualizar'); load(); }
  };

  const removeService = async (s: Service) => {
    if (!confirm(`¿Eliminar "${s.name}"? Se conservará en el historial de órdenes.`)) return;
    const { error } = await supabase.from('services').update({ deleted_at: new Date().toISOString() }).eq('id', s.id);
    if (error) return toast.error('No se pudo eliminar');
    toast.success('Servicio eliminado');
    load();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Servicios</h1>
          <p className="mt-1 text-sm text-gray-400">Catálogo del taller. Los precios son editables.</p>
        </div>
        <button
          onClick={() => setDraft(emptyDraft(categories[0]?.id))}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black transition-colors hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" /> Nuevo servicio
        </button>
      </div>

      {/* Nueva categoría */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          placeholder="Nueva categoría (ej: Frenos)"
          className="w-56 rounded-lg border border-white/10 bg-gray-950/60 px-3 py-2 text-sm placeholder:text-gray-600 focus:border-blue-500/60 focus:outline-none"
        />
        <button onClick={addCategory} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-bold hover:bg-white/5">
          + Categoría
        </button>
      </div>

      {services.length === 0 && categories.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 bg-gray-900/40 p-10 text-center">
          <PackageOpen className="mx-auto h-10 w-10 text-gray-600" />
          <p className="mt-3 font-bold">Aún no hay servicios</p>
          <p className="mt-1 text-sm text-gray-400">Carga el catálogo base de diésel (DPF, EGR, AdBlue, turbos, inyectores, scanner).</p>
          <button
            onClick={loadDefaultCatalog}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Cargar catálogo base
          </button>
        </div>
      )}

      {categories.map((cat) => {
        const items = grouped.get(cat.id) ?? [];
        return (
          <section key={cat.id}>
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-500">{cat.name}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => (
                <ServiceCard key={s.id} s={s}
                  onEdit={() => setDraft({ id: s.id, name: s.name, description: s.description ?? '', base_price: String(s.base_price || ''), category_id: s.category_id ?? '', is_active: s.is_active })}
                  onToggle={() => toggleActive(s)}
                  onDelete={() => removeService(s)}
                />
              ))}
              <button
                onClick={() => setDraft(emptyDraft(cat.id))}
                className="grid min-h-[92px] place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-gray-500 transition-colors hover:border-blue-500/40 hover:text-blue-300"
              >
                <span className="flex items-center gap-1"><Plus className="h-4 w-4" /> Agregar</span>
              </button>
            </div>
          </section>
        );
      })}

      {/* Servicios sin categoría */}
      {(grouped.get('sin')?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-500">Sin categoría</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.get('sin')!.map((s) => (
              <ServiceCard key={s.id} s={s}
                onEdit={() => setDraft({ id: s.id, name: s.name, description: s.description ?? '', base_price: String(s.base_price || ''), category_id: '', is_active: s.is_active })}
                onToggle={() => toggleActive(s)}
                onDelete={() => removeService(s)}
              />
            ))}
          </div>
        </section>
      )}

      {draft && (
        <ServiceForm
          draft={draft} categories={categories} saving={saving}
          onChange={setDraft} onCancel={() => setDraft(null)} onSave={saveService}
        />
      )}
    </div>
  );
}

function ServiceCard({ s, onEdit, onToggle, onDelete }: {
  s: Service; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-gray-900/40 p-4 ${s.is_active ? '' : 'opacity-55'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold leading-tight">{s.name}</p>
        <div className="flex shrink-0 gap-1">
          <button onClick={onEdit} title="Editar" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"><Pencil className="h-4 w-4" /></button>
          <button onClick={onDelete} title="Eliminar" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      {s.description && <p className="mt-1 text-xs leading-relaxed text-gray-400">{s.description}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className="font-black text-blue-300">{formatCLP(s.base_price)}</span>
        <button
          onClick={onToggle}
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-gray-500'}`}
        >
          {s.is_active ? 'Activo' : 'Inactivo'}
        </button>
      </div>
    </div>
  );
}

function ServiceForm({ draft, categories, saving, onChange, onCancel, onSave }: {
  draft: Draft; categories: Category[]; saving: boolean;
  onChange: (d: Draft) => void; onCancel: () => void; onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black">{draft.id ? 'Editar servicio' : 'Nuevo servicio'}</h3>
        <div className="mt-4 space-y-4">
          <L label="Nombre">
            <input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })}
              className="inp" placeholder="Ej: Eliminación de DPF" autoFocus />
          </L>
          <L label="Descripción">
            <textarea value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })}
              rows={2} className="inp resize-none" placeholder="Detalle breve del servicio" />
          </L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Precio (CLP, 0 = a cotizar)">
              <input value={draft.base_price} inputMode="numeric"
                onChange={(e) => onChange({ ...draft, base_price: e.target.value })}
                className="inp" placeholder="150000" />
            </L>
            <L label="Categoría">
              <select value={draft.category_id} onChange={(e) => onChange({ ...draft, category_id: e.target.value })} className="inp">
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </L>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => onChange({ ...draft, is_active: e.target.checked })} />
            Servicio activo
          </label>
        </div>
        <div className="mt-6 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold hover:bg-white/5">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-black hover:bg-blue-500 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">{label}</label>
      {children}
    </div>
  );
}
