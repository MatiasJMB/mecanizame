import { Trash2 } from 'lucide-react';
import { parseCLP } from '../lib/format';

export type ServiceOpt = { id: string; name: string; base_price: number };
export type Line = {
  id?: string; // id de work_order_items existente (solo al editar una orden guardada)
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

export const linesTotal = (lines: Line[]) => lines.reduce((a, l) => a + l.unit_price * l.quantity, 0);

/** Editor de líneas de servicio de una orden: catálogo + líneas personalizadas con precio. */
export default function ServiceLinesEditor({ lines, services, onChange }: {
  lines: Line[];
  services: ServiceOpt[];
  onChange: (lines: Line[]) => void;
}) {
  const addService = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (svc) onChange([...lines, { service_id: svc.id, description: svc.name, quantity: 1, unit_price: svc.base_price }]);
  };
  const addCustom = () => onChange([...lines, { service_id: null, description: '', quantity: 1, unit_price: 0 }]);
  const updateLine = (i: number, patch: Partial<Line>) => onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => onChange(lines.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {lines.length === 0 && <p className="text-xs text-gray-500">Agrega los servicios que se harán al vehículo.</p>}
      {lines.map((l, i) => (
        <div key={l.id ?? `new-${i}`} className="flex items-start gap-2 rounded-xl border border-white/10 bg-gray-950/40 p-2.5">
          <div className="min-w-0 flex-1">
            {l.service_id ? (
              <p className="text-sm font-bold leading-snug">{l.description}</p>
            ) : (
              <input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder="Servicio personalizado" className="inp w-full !py-1.5 text-sm" />
            )}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="card-label">Precio</span>
              <input value={l.unit_price ? String(l.unit_price) : ''} inputMode="numeric" onChange={(e) => updateLine(i, { unit_price: parseCLP(e.target.value) })} placeholder="0" className="inp w-28 !py-1 text-sm" />
            </div>
          </div>
          <button onClick={() => removeLine(i)} title="Quitar" className="mt-0.5 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <select value="" onChange={(e) => { if (e.target.value) addService(e.target.value); }} className="inp flex-1 text-sm">
          <option value="">+ Agregar servicio del catálogo…</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" onClick={addCustom} className="shrink-0 rounded-xl border border-white/10 px-3 text-xs font-bold hover:bg-white/5">+ Otro</button>
      </div>
    </div>
  );
}
