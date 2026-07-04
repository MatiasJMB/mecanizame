import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/api/client';
import { useAuth } from '../context/AuthContext';
import { useOrgGuard } from '@/hooks/useOrgGuard';
import { useSearch } from '../context/SearchContext';
import { formatCLP, formatMoney, parseCLP, norm } from '../lib/format';
import { DEFAULT_CATALOG } from '../lib/taller';
import { HELP } from '../lib/help';
import PageHeader from '../components/PageHeader';
import SegmentedToggle from '../components/SegmentedToggle';
import EmptyState from '../components/EmptyState';
import { useConfirm } from '../components/ConfirmProvider';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { friendlyError } from '../lib/errors';
import { canDelete } from '../lib/roles';
import {
  Plus, Pencil, Trash2, Loader2, PackageOpen, ChevronRight, ChevronUp, ChevronDown,
  LayoutGrid, List, X,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Category = { id: string; name: string; sort_order: number };
type Service = {
  id: string; category_id: string | null; name: string; description: string | null;
  base_price: number; is_active: boolean;
};
type Draft = { id?: string; name: string; description: string; base_price: string; category_id: string; is_active: boolean };

const emptyDraft = (category_id = ''): Draft => ({ name: '', description: '', base_price: '', category_id, is_active: true });

export default function Servicios() {
  const { organizationId, role, isSuperAdmin } = useAuth();
  const isFresh = useOrgGuard();
  const canDel = isSuperAdmin || canDelete(role);
  const confirm = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const { query, setQuery } = useSearch();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => { document.title = 'Servicios — Mecanízame'; }, []);

  const load = async () => {
    if (!organizationId) return;
    const oid = organizationId;
    setLoading(true);
    const [{ data: cats }, { data: svcs }] = await Promise.all([
      supabase.from('service_categories').select('*').eq('organization_id', organizationId).order('sort_order'),
      supabase.from('services').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at'),
    ]);
    if (!isFresh(oid)) return;
    setCategories(cats ?? []);
    setServices(svcs ?? []);
    setOpenCats(new Set((cats ?? []).map((c) => c.id).concat('sin')));
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [organizationId]);

  const grouped = useMemo(() => {
    const q = norm(query.trim());
    const byCat = new Map<string, Service[]>();
    for (const s of services) {
      if (q && !norm(s.name).includes(q) && !norm(s.description ?? '').includes(q)) continue;
      const key = s.category_id ?? 'sin';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(s);
    }
    return byCat;
  }, [services, query]);

  const searching = query.trim().length > 0;
  const isOpen = (id: string) => searching || openCats.has(id);
  const toggleOpen = (id: string) =>
    setOpenCats((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ---- Categorías ----
  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name || !organizationId) return;
    const { error } = await supabase.from('service_categories').insert({ organization_id: organizationId, name, sort_order: categories.length });
    if (error) return toast.error(friendlyError(error, 'No se pudo crear la categoría'));
    setNewCategory(''); setNewCatOpen(false);
    toast.success('Categoría creada');
    load();
  };
  const renameCategory = async (cat: Category, name: string) => {
    const clean = name.trim();
    if (!clean || clean === cat.name) return;
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, name: clean } : c)));
    const { error } = await supabase.from('service_categories').update({ name: clean }).eq('id', cat.id);
    if (error) { toast.error('No se pudo renombrar'); load(); } else toast.success('Categoría renombrada');
  };
  const moveCategory = async (cat: Category, dir: -1 | 1) => {
    const idx = categories.findIndex((c) => c.id === cat.id);
    const other = categories[idx + dir];
    if (!other) return;
    await Promise.all([
      supabase.from('service_categories').update({ sort_order: other.sort_order }).eq('id', cat.id),
      supabase.from('service_categories').update({ sort_order: cat.sort_order }).eq('id', other.id),
    ]);
    load();
  };
  const deleteCategory = async (cat: Category) => {
    const n = services.filter((s) => s.category_id === cat.id).length;
    const ok = await confirm({ title: `Eliminar categoría "${cat.name}"`, message: n ? `Se eliminarán también sus ${n} servicio(s).` : 'La categoría se eliminará.', confirmText: 'Eliminar categoría' });
    if (!ok) return;
    // Elimina los servicios de la categoría (soft-delete: conserva el historial de órdenes)
    await supabase.from('services').update({ deleted_at: new Date().toISOString() }).eq('category_id', cat.id).is('deleted_at', null);
    const { error } = await supabase.from('service_categories').delete().eq('id', cat.id);
    if (error) return toast.error('No se pudo eliminar');
    toast.success(n ? 'Categoría y sus servicios eliminados' : 'Categoría eliminada');
    load();
  };

  const loadDefaultCatalog = async () => {
    if (!organizationId || saving) return;
    setSaving(true);
    try {
      for (let i = 0; i < DEFAULT_CATALOG.length; i++) {
        const block = DEFAULT_CATALOG[i];
        const { data: cat, error: catErr } = await supabase.from('service_categories')
          .insert({ organization_id: organizationId, name: block.category, sort_order: i }).select('id').single();
        if (catErr || !cat) throw catErr;
        const rows = block.services.map((s) => ({ organization_id: organizationId, category_id: cat.id, name: s.name, description: s.description, base_price: s.base_price }));
        const { error: svcErr } = await supabase.from('services').insert(rows);
        if (svcErr) throw svcErr;
      }
      toast.success('Catálogo base cargado');
      load();
    } catch { toast.error('No se pudo cargar el catálogo base'); } finally { setSaving(false); }
  };

  // ---- Servicios ----
  const saveService = async () => {
    if (!draft || !organizationId) return;
    if (!draft.name.trim()) return toast.error('El nombre es obligatorio');
    setSaving(true);
    const payload = {
      organization_id: organizationId, name: draft.name.trim(), description: draft.description.trim() || null,
      base_price: parseCLP(draft.base_price), category_id: draft.category_id || null, is_active: draft.is_active,
    };
    const { error } = draft.id
      ? await supabase.from('services').update(payload).eq('id', draft.id)
      : await supabase.from('services').insert(payload);
    setSaving(false);
    if (error) return toast.error(friendlyError(error, 'No se pudo guardar el servicio'));
    toast.success(draft.id ? 'Servicio actualizado' : 'Servicio creado');
    setDraft(null); load();
  };
  const toggleActive = async (s: Service) => {
    setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
    const { error } = await supabase.from('services').update({ is_active: !s.is_active }).eq('id', s.id);
    if (error) { toast.error('No se pudo actualizar'); load(); }
  };
  const removeService = async (s: Service) => {
    const ok = await confirm({ title: `Eliminar "${s.name}"`, message: 'Se conservará en el historial de órdenes.', confirmText: 'Eliminar servicio' });
    if (!ok) return;
    const { error } = await supabase.from('services').update({ deleted_at: new Date().toISOString() }).eq('id', s.id);
    if (error) return toast.error('No se pudo eliminar');
    toast.success('Servicio eliminado'); load();
  };

  const editDraft = (s: Service): Draft => ({ id: s.id, name: s.name, description: s.description ?? '', base_price: String(s.base_price || ''), category_id: s.category_id ?? '', is_active: s.is_active });

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;

  const emptyAll = services.length === 0 && categories.length === 0;
  const sinCat = grouped.get('sin') ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Servicios" subtitle="Catálogo de trabajos del taller, por categoría. Los precios son editables." help={HELP.servicios}>
        <button onClick={() => setDraft(emptyDraft(categories[0]?.id))} data-tour="nuevo-servicio"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-blue-500">
          <Plus className="h-4 w-4" /> Nuevo servicio
        </button>
      </PageHeader>

      {!emptyAll && (
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedToggle value={view} onChange={setView}
            options={[{ v: 'grid', label: 'Tarjetas', icon: <LayoutGrid className="h-3.5 w-3.5" /> }, { v: 'list', label: 'Lista', icon: <List className="h-3.5 w-3.5" /> }]} />
          {newCatOpen ? (
            <div className="flex items-center gap-1">
              <input autoFocus value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setNewCatOpen(false); setNewCategory(''); } }}
                placeholder="Nombre de categoría" className="inp !w-48 !py-2 text-sm" />
              <button onClick={addCategory} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white hover:bg-blue-500">Crear</button>
              <button onClick={() => { setNewCatOpen(false); setNewCategory(''); }} className="rounded-lg p-2 text-gray-400 hover:bg-white/5"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <button onClick={() => setNewCatOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold hover:bg-white/5">
              <Plus className="h-4 w-4" /> Nueva categoría
            </button>
          )}
        </div>
      )}

      {emptyAll && (
        <EmptyState icon={PackageOpen} title="Aún no hay servicios"
          description="Carga el catálogo base (DPF, EGR, AdBlue, turbos, inyectores, scanner) o crea tu primera categoría."
          action={{ label: saving ? 'Cargando…' : 'Cargar catálogo base', onClick: loadDefaultCatalog, icon: saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" /> }}
          secondary={{ label: 'Crear categoría', onClick: () => setNewCatOpen(true) }} />
      )}

      <div className="custom-scrollbar space-y-6 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto lg:pr-1">
        {categories.map((cat, idx) => {
          const items = grouped.get(cat.id) ?? [];
          if (searching && items.length === 0) return null;
          return (
            <CategoryAccordion key={cat.id} cat={cat} items={items} view={view} open={isOpen(cat.id)}
              isFirst={idx === 0} isLast={idx === categories.length - 1} onToggle={() => toggleOpen(cat.id)}
              onRename={(name) => renameCategory(cat, name)} onMove={(d) => moveCategory(cat, d)}
              onDelete={() => deleteCategory(cat)} onAdd={() => setDraft(emptyDraft(cat.id))}
              onEditService={(s) => setDraft(editDraft(s))} onToggleService={toggleActive} onDeleteService={removeService} canDelete={canDel} />
          );
        })}

        {sinCat.length > 0 && (
          <CategoryAccordion cat={{ id: 'sin', name: 'Sin categoría', sort_order: 999 }} items={sinCat} view={view}
            open={isOpen('sin')} isFirst isLast noActions onToggle={() => toggleOpen('sin')}
            onRename={() => {}} onMove={() => {}} onDelete={() => {}} onAdd={() => setDraft(emptyDraft())}
            onEditService={(s) => setDraft(editDraft(s))} onToggleService={toggleActive} onDeleteService={removeService} canDelete={canDel} />
        )}

        {!emptyAll && searching && grouped.size === 0 && (
          <EmptyState compact icon={PackageOpen} title={`Sin servicios para «${query}»`}
            description="Revisa el nombre o crea el servicio si aún no existe."
            secondary={{ label: 'Limpiar búsqueda', onClick: () => setQuery('') }} />
        )}
      </div>

      {draft && <ServiceForm draft={draft} categories={categories} saving={saving} onChange={setDraft} onCancel={() => setDraft(null)} onSave={saveService} />}
    </div>
  );
}

function CategoryAccordion({
  cat, items, view, open, isFirst, isLast, noActions, onToggle, onRename, onMove, onDelete, onAdd, onEditService, onToggleService, onDeleteService, canDelete,
}: {
  cat: Category; items: Service[]; view: 'grid' | 'list'; open: boolean; isFirst: boolean; isLast: boolean; noActions?: boolean;
  onToggle: () => void; onRename: (name: string) => void; onMove: (dir: -1 | 1) => void; onDelete: () => void; onAdd: () => void;
  onEditService: (s: Service) => void; onToggleService: (s: Service) => void; onDeleteService: (s: Service) => void; canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const subtotal = items.reduce((a, s) => a + (s.base_price || 0), 0);

  return (
    <section className="rounded-2xl border border-white/10 bg-gray-900/40 p-5">
      <div className="group flex items-center gap-2 rounded-xl px-1 py-1">
        <button onClick={onToggle} className="p-1 text-gray-500 hover:text-gray-300">
          <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        {editing && !noActions ? (
          <input autoFocus defaultValue={cat.name}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => { onRename(e.target.value); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { onRename((e.target as HTMLInputElement).value); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
            className="inp max-w-56 !py-1 text-sm font-bold" />
        ) : (
          <button onDoubleClick={() => !noActions && setEditing(true)} className="text-sm font-black uppercase tracking-wide text-gray-200">
            {cat.name}
          </button>
        )}
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-bold text-gray-400">{items.length}</span>
        {subtotal > 0 && <span className="ml-1 text-[11px] text-gray-500">{formatMoney(subtotal)}</span>}

        <div className="ml-auto flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button title="Agregar servicio" onClick={onAdd} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-blue-300"><Plus className="h-4 w-4" /></button>
          {!noActions && <>
            <button title="Renombrar" onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5"><Pencil className="h-4 w-4" /></button>
            <button title="Subir" onClick={() => onMove(-1)} disabled={isFirst} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
            <button title="Bajar" onClick={() => onMove(1)} disabled={isLast} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
            {canDelete && <button title="Eliminar categoría" onClick={onDelete} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}
          </>}
        </div>
      </div>

      {open && (
        <div className="animate-fadeIn px-1 pb-1 pt-2">
          {items.length === 0 ? (
            <button onClick={onAdd} className="grid min-h-[64px] w-full place-items-center rounded-xl border border-dashed border-white/10 text-sm text-gray-500 hover:border-blue-500/40 hover:text-blue-300">
              <span className="flex items-center gap-1"><Plus className="h-4 w-4" /> Agregar servicio</span>
            </button>
          ) : view === 'grid' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => <ServiceCard key={s.id} s={s} onEdit={() => onEditService(s)} onToggle={() => onToggleService(s)} onDelete={() => onDeleteService(s)} canDelete={canDelete} />)}
              <button onClick={onAdd} className="grid min-h-[92px] place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-gray-500 transition-colors hover:border-blue-500/40 hover:text-blue-300">
                <span className="flex items-center gap-1"><Plus className="h-4 w-4" /> Agregar</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((s) => <ServiceRow key={s.id} s={s} onEdit={() => onEditService(s)} onToggle={() => onToggleService(s)} onDelete={() => onDeleteService(s)} canDelete={canDelete} />)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ServiceCard({ s, onEdit, onToggle, onDelete, canDelete }: { s: Service; onEdit: () => void; onToggle: () => void; onDelete: () => void; canDelete: boolean }) {
  return (
    <div className={`group rounded-2xl border border-white/10 bg-gray-950/40 p-4 transition ${s.is_active ? '' : 'opacity-55'} hover:border-blue-500/30`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold leading-tight">{s.name}</p>
        <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button onClick={onEdit} title="Editar" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"><Pencil className="h-4 w-4" /></button>
          {canDelete && <button onClick={onDelete} title="Eliminar" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>
      {s.description && <p className="mt-1 text-xs leading-relaxed text-gray-400">{s.description}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className="font-black text-blue-300">{formatCLP(s.base_price)}</span>
        <button onClick={onToggle} className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.is_active ? 'chip-done' : 'chip-cancel'}`}>
          {s.is_active ? 'Activo' : 'Inactivo'}
        </button>
      </div>
    </div>
  );
}

function ServiceRow({ s, onEdit, onToggle, onDelete, canDelete }: { s: Service; onEdit: () => void; onToggle: () => void; onDelete: () => void; canDelete: boolean }) {
  return (
    <div className={`group flex items-center gap-3 rounded-xl border border-white/10 bg-gray-950/40 px-3 py-2.5 ${s.is_active ? '' : 'opacity-55'}`}>
      <span className="font-bold">{s.name}</span>
      {s.description && <span className="hidden truncate text-xs text-gray-500 sm:block">{s.description}</span>}
      <span className="ml-auto shrink-0 font-black text-blue-300">{formatCLP(s.base_price)}</span>
      <button onClick={onToggle} className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.is_active ? 'chip-done' : 'chip-cancel'}`}>{s.is_active ? 'Activo' : 'Inactivo'}</button>
      <div className="flex shrink-0 gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <button onClick={onEdit} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"><Pencil className="h-4 w-4" /></button>
        {canDelete && <button onClick={onDelete} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}

function ServiceForm({ draft, categories, saving, onChange, onCancel, onSave }: {
  draft: Draft; categories: Category[]; saving: boolean; onChange: (d: Draft) => void; onCancel: () => void; onSave: () => void;
}) {
  useBodyScrollLock();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="animate-scaleIn max-h-[90vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">{draft.id ? 'Editar servicio' : 'Nuevo servicio'}</h3>
          <button onClick={onCancel} aria-label="Cerrar" title="Cerrar" className="rounded-lg p-1 text-gray-400 hover:bg-white/5"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <L label="Nombre"><input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} className="inp" placeholder="Ej: Eliminación de DPF" autoFocus /></L>
          <L label="Descripción"><textarea value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} rows={2} className="inp resize-none" placeholder="Detalle breve del servicio" /></L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Precio en pesos"><input value={draft.base_price} inputMode="numeric" onChange={(e) => onChange({ ...draft, base_price: e.target.value })} className="inp" placeholder="150000 — deja 0 para «A cotizar»" /></L>
            <L label="Categoría">
              <select value={draft.category_id} onChange={(e) => onChange({ ...draft, category_id: e.target.value })} className="inp">
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </L>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={(e) => onChange({ ...draft, is_active: e.target.checked })} /> Servicio activo</label>
            <p className="ml-6 mt-0.5 text-xs text-gray-500">Los servicios inactivos no aparecen al crear órdenes.</p>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold hover:bg-white/5">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
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
