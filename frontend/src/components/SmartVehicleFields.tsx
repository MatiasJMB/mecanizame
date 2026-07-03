import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/api/client';

export const FUELS = ['Diésel', 'Bencina', 'Híbrido', 'Eléctrico', 'GNC', 'GLP'];

type Make = { name: string; models: string[] };

/** Selección de marca + modelo (desde el catálogo de la base) + combustible.
 *  Evita errores de tipeo; permite "Otra/Otro" con texto libre como respaldo. */
export default function SmartVehicleFields({
  make, model, fuel, onChange, labeled = false,
}: {
  make: string; model: string; fuel: string;
  onChange: (patch: { make?: string; model?: string; fuel_type?: string }) => void;
  labeled?: boolean;
}) {
  const [catalog, setCatalog] = useState<Make[]>([]);
  const [otherMake, setOtherMake] = useState(false);
  const [otherModel, setOtherModel] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('vehicle_makes')
        .select('name, sort_order, vehicle_models(name)')
        .order('sort_order');
      const list = (data ?? []).map((m: any) => ({
        name: m.name as string,
        models: ((m.vehicle_models ?? []) as { name: string }[]).map((x) => x.name).sort((a, b) => a.localeCompare(b)),
      }));
      setCatalog(list);
    })();
  }, []);

  const models = useMemo(() => catalog.find((c) => c.name === make)?.models ?? [], [catalog, make]);

  const onMake = (v: string) => {
    if (v === '__other__') { setOtherMake(true); setOtherModel(false); onChange({ make: '', model: '' }); }
    else { setOtherMake(false); setOtherModel(false); onChange({ make: v, model: '' }); }
  };
  const onModel = (v: string) => {
    if (v === '__other__') { setOtherModel(true); onChange({ model: '' }); }
    else onChange({ model: v });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Wrap labeled={labeled} label="Marca">
          {otherMake ? (
            <input value={make} onChange={(e) => onChange({ make: e.target.value })} placeholder="Marca" className="inp text-sm" autoFocus />
          ) : (
            <select value={make} onChange={(e) => onMake(e.target.value)} className="inp text-sm">
              <option value="">Marca…</option>
              {catalog.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              <option value="__other__">Otra marca…</option>
            </select>
          )}
        </Wrap>
        <Wrap labeled={labeled} label="Modelo">
          {otherMake || otherModel ? (
            <input value={model} onChange={(e) => onChange({ model: e.target.value })} placeholder="Modelo" className="inp text-sm" />
          ) : (
            <select value={model} onChange={(e) => onModel(e.target.value)} className="inp text-sm" disabled={!make}>
              <option value="">{make ? 'Modelo…' : 'Elige marca primero'}</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
              {make && <option value="__other__">Otro modelo…</option>}
            </select>
          )}
        </Wrap>
      </div>
      <Wrap labeled={labeled} label="Combustible">
        <select value={fuel} onChange={(e) => onChange({ fuel_type: e.target.value })} className="inp text-sm">
          {FUELS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Wrap>
    </div>
  );
}

function Wrap({ labeled, label, children }: { labeled: boolean; label: string; children: React.ReactNode }) {
  if (!labeled) return <>{children}</>;
  return (
    <div className="space-y-1.5">
      <span className="ml-1 block text-xs font-bold uppercase tracking-widest text-gray-400">{label}</span>
      {children}
    </div>
  );
}
