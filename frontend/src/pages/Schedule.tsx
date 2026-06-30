import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Clock, Save, CheckCircle2, AlertCircle, X, Calendar } from 'lucide-react';
import { usePageHeader } from '../components/AppLayout';

export default function Schedule() {
  const { bakeryId } = useAuth();
  useEffect(() => { document.title = 'AhoraPan - Horarios de Atención'; }, []);
  usePageHeader({
    title: (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-500"><Clock className="h-4 w-4" /></span>
        <h1 className="truncate text-lg font-black tracking-tight text-theme-base md:text-xl">Horarios</h1>
      </div>
    ),
  }, []);
  
  const [businessHours, setBusinessHours] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (bakeryId) {
      fetchBusinessHours();
    }
  }, [bakeryId]);

  // Auto-limpiar mensajes de éxito tras 3 segundos
  useEffect(() => {
    if (msg.text && msg.type === 'success') {
      const timer = setTimeout(() => setMsg({ type: '', text: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const fetchBusinessHours = async () => {
    const { data, error } = await supabase
      .from('bakeries')
      .select('business_hours')
      .eq('id', bakeryId)
      .single();

    if (data && !error) {
      setBusinessHours(data.business_hours || {
        "0": { "open": "08:00", "close": "20:00", "closed": false },
        "1": { "open": "08:00", "close": "20:00", "closed": false },
        "2": { "open": "08:00", "close": "20:00", "closed": false },
        "3": { "open": "08:00", "close": "20:00", "closed": false },
        "4": { "open": "08:00", "close": "20:00", "closed": false },
        "5": { "open": "08:00", "close": "20:00", "closed": false },
        "6": { "open": "08:00", "close": "20:00", "closed": false }
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    const { error } = await supabase
      .from('bakeries')
      .update({
        business_hours: businessHours
      })
      .eq('id', bakeryId);

    if (error) {
      setMsg({ type: 'error', text: 'Error al actualizar horarios: ' + error.message });
    } else {
      setMsg({ type: 'success', text: '¡Horarios actualizados con éxito!' });
      // Refrescar para asegurar que los cambios se reflejan limpiamente
      setTimeout(() => window.location.reload(), 1500);
    }
    setLoading(false);
  };

  const daysMap: any = { 
    "1": "Lunes", 
    "2": "Martes", 
    "3": "Miércoles", 
    "4": "Jueves", 
    "5": "Viernes", 
    "6": "Sábado", 
    "0": "Domingo" 
  };

  return (
    <div className="iphone-liquid-page-safe min-h-screen bg-theme-base flex flex-col items-center p-4 md:p-8 text-theme-base">

      <div className="bg-gray-900 w-full max-w-2xl rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl border border-white/5">
        
        {msg.text && (
          <div className="fixed top-6 inset-x-0 mx-auto z-[100] w-[90%] max-w-md animate-slideDown">
            <div className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center gap-3 font-bold text-sm ${
              msg.type === 'success' 
                ? 'bg-emerald-600/90 text-white border-emerald-500 shadow-emerald-900/40' 
                : 'bg-red-600/90 text-white border-red-500 shadow-red-900/40'
            }`}>
              {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="flex-1">{msg.text}</span>
              <button onClick={() => setMsg({ type: '', text: '' })} className="hover:opacity-70 transition-opacity">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="bg-gray-950/30 rounded-2xl p-4 border border-white/10 mb-6" data-tour="business-hours">
            <h3 className="text-white font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-orange-500" /> Configuración Semanal
            </h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Configura los horarios en los que tu panadería recibe pedidos. 
              Si marcas un día como <span className="text-red-500 font-bold">CERRADO</span>, el bot de WhatsApp avisará automáticamente a los clientes que el local no está atendiendo.
            </p>
          </div>

          <div className="space-y-4">
            {businessHours && ["1", "2", "3", "4", "5", "6", "0"].map((day) => {
              const schedule = businessHours[day];
              if (!schedule) return null;
              
              return (
                <div key={day} className={`flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${schedule.closed ? 'bg-gray-900/20 border-white/5 opacity-70' : 'bg-gray-950/40 border-white/5 shadow-sm'}`}>
                  <div className="flex items-center gap-3">
                    <Calendar className={`w-4 h-4 ${schedule.closed ? 'text-gray-600' : 'text-orange-500'}`} />
                    <span className={`font-black tracking-tight ${schedule.closed ? 'text-gray-500 line-through' : 'text-white'}`}>{daysMap[day]}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 flex-1 justify-end min-w-fit">
                    {!schedule.closed ? (
                      <div className="flex items-center gap-2 bg-gray-950/40 p-1.5 rounded-xl border border-white/5">
                        <input 
                          type="time" 
                          value={schedule.open}
                          onChange={(e) => setBusinessHours({...businessHours, [day]: {...schedule, open: e.target.value}})}
                          className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer"
                        />
                        <span className="text-gray-600 font-black">/</span>
                        <input 
                          type="time" 
                          value={schedule.close}
                          onChange={(e) => setBusinessHours({...businessHours, [day]: {...schedule, close: e.target.value}})}
                          className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer"
                        />
                      </div>
                    ) : (
                      <div className="bg-red-500/10 text-red-500 text-[10px] font-black tracking-widest px-3 py-2 rounded-lg border border-red-500/20">
                        SIN ATENCIÓN
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setBusinessHours({...businessHours, [day]: {...schedule, closed: !schedule.closed}})}
                      className={`h-10 px-4 rounded-xl font-black text-[10px] tracking-widest transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 shadow-lg flex items-center justify-center ${schedule.closed ? 'bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-400/50 shadow-emerald-500/50 hover:shadow-emerald-400/70' : 'bg-gray-900 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 shadow-black/40 hover:shadow-red-500/40'}`}
                    >
                      {schedule.closed ? 'ABRIR' : 'CERRAR'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-6">
             <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
             >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {loading ? 'Guardando horarios...' : 'GUARDAR HORARIOS'}
             </button>
          </div>
        </form>

        <div className="mt-10 pt-8 border-t border-white/5 text-center">
           <p className="text-theme-subtle text-[10px] uppercase font-bold tracking-[0.25em]">
              Atención segura · Ahora Pan
           </p>
        </div>
      </div>
    </div>
  );
}
