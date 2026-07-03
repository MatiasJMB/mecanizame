import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Rocket } from 'lucide-react';

/** Checklist de primeros pasos en el Resumen. Desaparece solo cuando el taller
 *  ya tiene catálogo, clientes y su primera orden. */
export default function OnboardingChecklist({ services, customers, orders }: {
  services: number; customers: number; orders: number;
}) {
  const steps = [
    { done: services > 0, label: 'Arma tu catálogo de servicios', hint: 'Puedes cargar el catálogo diésel base con un clic.', to: '/servicios' },
    { done: customers > 0, label: 'Registra tu primer cliente', hint: 'Con su vehículo y patente queda el historial armado.', to: '/clientes' },
    { done: orders > 0, label: 'Crea tu primera orden de trabajo', hint: 'Cliente → vehículo → servicios. El total se calcula solo.', to: '/ordenes' },
  ];
  if (steps.every((s) => s.done)) return null;

  return (
    <section className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Rocket className="h-4 w-4 text-blue-400" /> Primeros pasos para dejar tu taller andando
      </h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {steps.map((s, i) => (
          <Link key={s.to} to={s.to}
            className={`rounded-xl border p-3.5 transition-colors ${s.done ? 'border-white/10 opacity-60' : 'border-blue-500/30 hover:bg-blue-500/10'}`}>
            <p className="flex items-center gap-2 text-sm font-bold">
              {s.done
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                : <Circle className="h-4 w-4 shrink-0 text-gray-500" />}
              {i + 1}. {s.label}
            </p>
            <p className="mt-1 pl-6 text-xs text-gray-400">{s.done ? 'Listo' : s.hint}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
