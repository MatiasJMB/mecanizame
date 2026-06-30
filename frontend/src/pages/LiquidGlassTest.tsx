import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Flame,
  Package,
  Sparkles,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const demoCards = [
  {
    title: 'Pedido A-01',
    detail: 'Marraqueta, hallullas y pan especial',
    meta: 'Listo en 8 min',
    icon: <Flame className="w-5 h-5" />,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    title: 'Productos activos',
    detail: '18 productos publicados para WhatsApp',
    meta: 'Catalogo visible',
    icon: <Package className="w-5 h-5" />,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  },
  {
    title: 'Cliente frecuente',
    detail: 'Mati retiro su ultimo pedido a tiempo',
    meta: 'Perfil confiable',
    icon: <User className="w-5 h-5" />,
    color: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  },
  {
    title: 'Alerta preparada',
    detail: 'Mensaje listo para avisar que salio pan',
    meta: 'Canal WhatsApp',
    icon: <Bell className="w-5 h-5" />,
    color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  },
];

const timeline = [
  'Pedido recibido desde WhatsApp',
  'Panaderia confirma disponibilidad',
  'Cliente recibe aviso de retiro',
  'Pedido marcado como entregado',
  'Historial queda sincronizado',
  'Stock se revisa para la siguiente tanda',
];

export default function LiquidGlassTest() {
  const { bakeryName } = useAuth();

  useEffect(() => {
    document.title = 'AhoraPan - Liquid Glass Test';
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-[-220px] h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-orange-500/10 blur-[90px]" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-[90px]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-36 pt-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 rounded-[2rem] border border-white/5 bg-gray-950/70 p-3 shadow-2xl backdrop-blur-2xl">
          <Link
            to="/"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gray-900/30 text-orange-400 transition-all hover:bg-orange-500/10 active:scale-95"
            aria-label="Volver al dashboard"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-400">Prueba visual</p>
            <h1 className="truncate text-xl font-black tracking-tight sm:text-3xl">
              Liquid Glass iPhone
            </h1>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
            <Sparkles className="w-5 h-5 text-orange-400" />
          </div>
        </header>

        <section className="rounded-[2.25rem] border border-white/5 bg-[#0b0f1a]/90 p-5 shadow-2xl sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-gray-500">
                {bakeryName || 'Pan de Pancitos'}
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-5xl">
                Barra inferior fluida
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-300 sm:self-auto">
              <CheckCircle2 className="w-4 h-4" />
              Demo iPhone
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-gray-400">
            Esta pantalla deja espacio para probar el movimiento del sitio y la botonera inferior. En iPhone
            aparece el slider Liquid Glass; en otros dispositivos la vista queda limpia para comparar.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {demoCards.map((card) => (
            <article
              key={card.title}
              className="rounded-[2rem] border border-white/5 bg-gray-900/50 p-5 shadow-xl backdrop-blur-xl"
            >
              <div className={`mb-6 inline-flex rounded-2xl border p-3 ${card.color}`}>
                {card.icon}
              </div>
              <h3 className="text-xl font-black text-white">{card.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-gray-400">{card.detail}</p>
              <div className="mt-5 inline-flex rounded-full bg-gray-900/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                {card.meta}
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-[2.25rem] border border-white/5 bg-[#0b0f1a]/90 p-5 shadow-2xl sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-400">Scroll test</p>
              <h2 className="mt-1 text-2xl font-black">Flujo de pedidos</h2>
            </div>
            <Clock className="w-7 h-7 text-gray-500" />
          </div>
          <div className="space-y-3">
            {timeline.map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-4 rounded-2xl border border-white/5 bg-gray-950/70 p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-sm font-black text-orange-400">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-white">{item}</p>
                  <p className="text-xs font-semibold text-gray-500">Movimiento de prueba para observar el vidrio.</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 pb-8 sm:grid-cols-3">
          {Array.from({ length: 9 }, (_, index) => (
            <div
              key={index}
              className="min-h-32 rounded-[2rem] border border-white/5 bg-gray-900/35 p-5 shadow-xl backdrop-blur-xl"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Modulo</p>
              <p className="mt-3 text-2xl font-black text-white">{String(index + 1).padStart(2, '0')}</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-gray-400">
                Bloque visual para generar profundidad detras del slider.
              </p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
