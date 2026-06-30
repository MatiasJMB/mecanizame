import { useState } from 'react';
import { HelpCircle, Mail, X, MessageSquare, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const isAppleTouchDevice = () => {
  if (typeof navigator === 'undefined') return false;
  return (
    /\b(iPhone|iPad|iPod)\b/i.test(navigator.userAgent)
    || (/\bMacintosh\b/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
};

export default function SupportButton() {
  // Los hooks deben llamarse siempre en el mismo orden, antes de cualquier return.
  const [isOpen, setIsOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // En dispositivos Apple la navegación inferior Liquid Glass ya ocupa la zona,
  // así que el botón flotante de ayuda no se muestra.
  if (isAppleTouchDevice()) return null;

  const faqs = [
    {
      q: "¿Qué es Ahora Pan?",
      a: "Es una plataforma de gestión para panaderías que permite administrar productos, horarios y pedidos de forma digital, conectando automáticamente con tus clientes vía WhatsApp."
    },
    {
      q: "¿Cómo funciona el bot de WhatsApp?",
      a: "Tus clientes escriben a tu número de contacto y el bot les muestra tu catálogo actualizado. Los pedidos que confirmen aparecerán en tiempo real en tu Dashboard."
    },
    {
      q: "¿Cómo agrego mis productos?",
      a: "Ve a la sección 'Productos' en tu menú lateral (o en el Panel Admin). Allí puedes crear categorías y añadir panes con sus respectivos precios y unidades de venta."
    },
    {
      q: "¿Qué hago si tengo un problema con un pedido?",
      a: "En el Dashboard, puedes ver el detalle de cada pedido. Si necesitas cancelarlo, el sistema te pedirá un motivo y notificará automáticamente al cliente por WhatsApp."
    },
    {
      q: "¿Cómo cambio mis horarios de atención?",
      a: "Desde tu Perfil, puedes configurar los bloques de apertura y cierre para cada día de la semana. Esto controla cuándo el bot de WhatsApp permite recibir pedidos."
    }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      {/* Menu Box */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-[320px] md:w-[380px] bg-gray-900 border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden animate-scaleIn backdrop-blur-xl">
          <div className="bg-orange-600 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-black text-lg tracking-tight">Centro de Ayuda</h3>
                <p className="text-white/70 text-[10px] uppercase font-bold tracking-widest">Soporte Ahora Pan</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 max-h-[450px] overflow-y-auto custom-scrollbar">
            <div className="mb-6">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Preguntas Frecuentes</p>
              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="border border-white/5 rounded-2xl overflow-hidden">
                    <button 
                      onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-950 transition-colors"
                    >
                      <span className="text-sm font-bold text-gray-200">{faq.q}</span>
                      {activeFaq === idx ? <ChevronUp className="w-4 h-4 text-orange-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </button>
                    {activeFaq === idx && (
                      <div className="px-4 pb-4 animate-fadeIn">
                        <p className="text-gray-400 text-xs leading-relaxed">{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">¿Necesitas hablar con un humano?</p>
              <a 
                href="https://mail.google.com/mail/?view=cm&fs=1&to=ahorapansupport@gmail.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 bg-orange-600/10 border border-orange-500/20 rounded-2xl hover:bg-orange-600/20 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-black text-orange-400">Enviar un Mensaje</span>
                </div>
                <ExternalLink className="w-4 h-4 text-orange-500/50 group-hover:text-orange-500" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Main Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-90 ${isOpen ? 'bg-gray-950 rotate-90 scale-110' : 'bg-orange-600 hover:bg-orange-500'}`}
      >
        {isOpen ? (
          <X className="w-6 h-6 md:w-8 md:h-8 text-white" />
        ) : (
          <HelpCircle className="w-6 h-6 md:w-8 md:h-8 text-white" />
        )}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-gray-950 rounded-full animate-pulse" />
        )}
      </button>
    </div>
  );
}
