import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const SECTIONS: [string, string][] = [
  ['Resumen (KPIs)', 'Ventas del mes, clientes, vehículos, servicios top'],
  ['Clientes 360', 'Clientes + vehículos + historial por patente'],
  ['Servicios', 'Catálogo DPF / AdBlue / EGR'],
  ['Órdenes de servicio', 'Lista por estado + nueva orden manual'],
  ['Inbox WhatsApp', 'Conversaciones en vivo (Baileys)'],
  ['Compositor RRSS', 'Publicaciones IG/FB con vista previa'],
];

export default function Panel() {
  const { organizationName, organizationId } = useAuth();
  useEffect(() => {
    document.title = 'Panel — Taller SaaS';
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black">Hola, {organizationName || 'tu taller'} 👋</h1>
        <p className="mt-1 text-sm text-gray-400">
          Fundación lista (multi-tenant + auth + esquema limpio). Las secciones del CRM se construyen
          esta semana.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(([title, desc]) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-gray-900/40 p-5">
            <p className="font-bold">{title}</p>
            <p className="mt-1 text-xs text-gray-400">{desc}</p>
            <span className="mt-3 inline-block rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gray-500">
              En construcción
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-600">organization_id: {organizationId ?? '—'}</p>
    </div>
  );
}
