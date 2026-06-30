import { ChevronDown, Sparkles, Package } from 'lucide-react';

interface NewOrderOverlayProps {
  show: boolean;
  onClose: () => void;
}

export default function NewOrderOverlay({ show, onClose }: NewOrderOverlayProps) {
  if (!show) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-emerald-600 animate-in fade-in zoom-in duration-300 cursor-pointer overflow-hidden"
    >
      {/* Luz de pulso de fondo */}
      <div className="absolute inset-0 bg-emerald-500 animate-pulse opacity-50" />
      
      {/* Círculos decorativos orbitando */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[500px] md:h-[500px] border-4 border-white/10 rounded-full animate-[spin_20s_linear_infinite]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] md:w-[350px] md:h-[350px] border-2 border-white/5 rounded-full animate-[spin_15s_linear_infinite_reverse]" />

      <div className="relative flex flex-col items-center text-center px-4">
        {/* Icono Principal */}
        <div className="mb-4 md:mb-6 p-4 md:p-5 bg-white/20 rounded-2xl md:rounded-[2.5rem] backdrop-blur-xl border-2 md:border-4 border-white/30 shadow-2xl animate-bounce">
          <Package className="w-12 h-12 md:w-20 md:h-20 text-white drop-shadow-lg" />
        </div>

        {/* Texto de Alerta */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-emerald-200 animate-pulse" />
            <span className="text-emerald-100 font-black tracking-[0.3em] text-[9px] md:text-[11px] uppercase drop-shadow-md">¡Atención!</span>
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-emerald-200 animate-pulse" />
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-none tracking-tighter drop-shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
            NUEVO<br />PEDIDO
          </h1>
          
          <p className="text-sm md:text-lg text-emerald-100 font-bold mt-3 md:mt-4 tracking-tight opacity-90">
            Revisa la lista de preparación abajo
          </p>
        </div>
      </div>

      {/* Flecha indicadora al botón */}
      <div className="absolute bottom-8 md:bottom-10 flex flex-col items-center gap-1.5 animate-bounce">
        <p className="text-white/60 text-[8px] md:text-[10px] font-black uppercase tracking-widest">Ver Pedido</p>
        <div className="bg-white/20 p-2 md:p-2.5 rounded-full backdrop-blur-md border border-white/30">
          <ChevronDown className="w-5 h-5 md:w-7 md:h-7 text-white" />
        </div>
      </div>

      {/* Instrucción de cierre rápida */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 text-white/40 text-[8px] md:text-[10px] font-bold uppercase tracking-widest pointer-events-none">
        Toca para cerrar
      </div>
    </div>
  );
}
