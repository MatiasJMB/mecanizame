import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Settings, Save, CheckCircle2, AlertCircle, X, Clock, Ban, Bell, Lock as LockIcon, MapPin, Eye, EyeOff, CreditCard, Calendar, Sparkles } from 'lucide-react';
import { CHILE_DATA } from '../lib/chile-data';
import { translateError } from '../lib/auth-errors';
import { fetchJson } from '../lib/api';
import { usePageHeader } from '../components/AppLayout';

function HeaderTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-500">
        {icon}
      </span>
      <h1 className="truncate text-lg font-black tracking-tight text-theme-base md:text-xl">{children}</h1>
    </div>
  );
}

export default function Profile() {
  const { user, bakeryId, session } = useAuth();
  useEffect(() => { document.title = 'AhoraPan - Mi Perfil'; }, []);
  usePageHeader({ title: <HeaderTitle icon={<Settings className="h-4 w-4" />}>Mi perfil</HeaderTitle> }, []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [comuna, setComuna] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [location, setLocation] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState<number | string>(30);
  const [maxStrikes, setMaxStrikes] = useState<number | string>(3);
  const [enableWarning, setEnableWarning] = useState(true);
  const [warningMinutes, setWarningMinutes] = useState<number | string>(10);
  
  // Datos de suscripción
  const [alertPlan, setAlertPlan] = useState('');
  const [billingCycle, setBillingCycle] = useState('');
  const [accessUntil, setAccessUntil] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [alertSubStatus, setAlertSubStatus] = useState('');
  const [showCancelSub, setShowCancelSub] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Lista de comunas filtradas por región
  const availableComunas = CHILE_DATA.find(r => r.region === region)?.comunas || [];

  const [existingCities, setExistingCities] = useState<string[]>([]);

  useEffect(() => {
    if (comuna) {
      const fetchCities = async () => {
        const { data } = await supabase
          .from('bakeries')
          .select('ciudad')
          .eq('comuna', comuna)
          .not('ciudad', 'is', null);
        if (data) {
          const unique = Array.from(new Set(data.map(d => (d.ciudad || '').trim()).filter(Boolean)));
          setExistingCities(unique);
        }
      };
      fetchCities();
    } else {
      setExistingCities([]);
    }
  }, [comuna]);

  const formatCityName = (city: string) => {
    return city.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  useEffect(() => {
    if (bakeryId) {
      fetchBakeryData();
    }
  }, [bakeryId]);
  
  // Auto-limpiar mensajes de éxito tras 3 segundos
  useEffect(() => {
    if (msg.text && msg.type === 'success') {
      const timer = setTimeout(() => setMsg({ type: '', text: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const fetchBakeryData = async () => {
    const { data, error } = await supabase
      .from('bakeries')
      .select('name, contact_phone, location, region, comuna, ciudad, order_expiry_minutes, max_strikes, enable_order_warning, order_warning_minutes, alert_plan, alert_billing_cycle, alert_access_until, is_alert_unlocked, alert_subscription_status')
      .eq('id', bakeryId)
      .single();

    if (data && !error) {
      setName(data.name);
      setPhone(data.contact_phone || '');
      setRegion(data.region || '');
      setComuna(data.comuna || '');
      setCiudad(data.ciudad || '');
      setLocation(data.location || '');
      setExpiryMinutes(data.order_expiry_minutes || 30);
      setMaxStrikes(data.max_strikes || 3);
      setEnableWarning(data.enable_order_warning ?? true);
      setWarningMinutes(data.order_warning_minutes || 10);
      setAlertPlan(data.alert_plan || 'BASIC');
      setBillingCycle(data.alert_billing_cycle || 'N/A');
      setAccessUntil(data.alert_access_until);
      setIsUnlocked(data.is_alert_unlocked);
      setAlertSubStatus(data.alert_subscription_status || '');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    const formattedCiudad = formatCityName(ciudad);

    const { error } = await supabase
      .from('bakeries')
      .update({
        name,
        contact_phone: phone,
        location,
        region,
        comuna,
        ciudad: formattedCiudad,
        order_expiry_minutes: Number(expiryMinutes) || 30,
        max_strikes: Number(maxStrikes) || 3,
        enable_order_warning: enableWarning,
        order_warning_minutes: Number(warningMinutes) || 10
      })
      .eq('id', bakeryId);

    if (error) {
      setMsg({ type: 'error', text: 'Error al actualizar el perfil: ' + error.message });
    } else {
      setMsg({ type: 'success', text: '¡Perfil actualizado con éxito!' });
      // "Refrescar" la página tras 1.5 segundos para mostrar datos limpios desde la BD
      setTimeout(() => window.location.reload(), 1500);
    }
    setLoading(false);
  };

  const handleCancelSubscription = async () => {
    setLoadingCancel(true);
    try {
      await fetchJson('/api/alerta-pan/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ bakery_id: bakeryId }),
      });
      setMsg({ type: 'success', text: 'Suscripción cancelada. El acceso se mantendrá hasta el fin del período pagado.' });
      setShowCancelSub(false);
      setAlertSubStatus('cancelled');
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Error al cancelar la suscripción.' });
    } finally {
      setLoadingCancel(false);
    }
  };

  return (
    <div className="iphone-liquid-page-safe min-h-screen bg-theme-base flex flex-col items-center p-4 md:p-8 text-theme-base transition-colors duration-300">

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
          <div className="bg-gray-950/20 p-5 rounded-2xl border border-white/10">
            <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase">Nombre de la Panadería</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-950 text-white rounded-xl px-5 py-3 border border-white/5 focus:border-orange-500 focus:outline-none transition-all"
              required 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-950/20 p-5 rounded-2xl border border-white/10">
              <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase">WhatsApp de Contacto</label>
              <input 
                type="tel" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-gray-950 text-white rounded-xl px-5 py-3 border border-white/5 focus:border-orange-500 focus:outline-none transition-all"
                placeholder="+569..."
                required 
              />
            </div>
            <div className="bg-gray-950/20 p-5 rounded-2xl border border-white/10">
              <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase">Región</label>
              <select 
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setComuna('');
                }}
                className="w-full bg-gray-950 text-white rounded-xl px-5 py-3 border border-white/5 focus:border-orange-500 focus:outline-none transition-all"
                required
              >
                <option value="">Selecciona Región</option>
                {CHILE_DATA.map(r => (
                  <option key={r.region} value={r.region}>{r.region}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-950/20 p-5 rounded-2xl border border-white/10">
              <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase">Comuna</label>
              <select 
                value={comuna}
                onChange={(e) => setComuna(e.target.value)}
                className="w-full bg-gray-950 text-white rounded-xl px-5 py-3 border border-white/5 focus:border-orange-500 focus:outline-none transition-all"
                disabled={!region}
                required
              >
                <option value="">Selecciona Comuna</option>
                {availableComunas.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="bg-gray-950/20 p-5 rounded-2xl border border-white/10">
              <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase">Ciudad / Sector</label>
              <input 
                type="text" 
                list="profile-ciudades-list"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className="w-full bg-gray-950 text-white rounded-xl px-5 py-3 border border-white/5 focus:border-orange-500 focus:outline-none transition-all"
                placeholder="Ej: Playa Ancha"
                required 
              />
              <datalist id="profile-ciudades-list">
                {existingCities.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="bg-gray-950/20 p-5 rounded-2xl border border-white/10">
            <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase flex items-center gap-2">
              <MapPin className="w-3 h-3 text-orange-500" /> Dirección (Calle y Número)
            </label>
            <input 
              type="text" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-gray-950 text-white rounded-xl px-5 py-3 border border-white/5 focus:border-orange-500 focus:outline-none transition-all"
              placeholder="Ej: Av. Argentina 123"
              required 
            />
          </div>

          {/* Sección de Suscripción */}
          <div className="bg-gray-900 rounded-3xl p-6 border border-white/5 shadow-inner space-y-6">
             <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white flex items-center gap-2" data-tour="alert-subscription-card">
                   <CreditCard className="w-5 h-5 text-orange-500" />
                   Mi suscripción
                </h3>
                <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${isUnlocked ? (alertSubStatus === 'cancelled' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') : 'bg-gray-950 text-gray-500 border-white/5'}`}>
                   {isUnlocked ? (alertSubStatus === 'cancelled' ? 'CANCELADA' : 'ACTIVA') : 'INACTIVA'}
                </div>
             </div>

             {isUnlocked ? (
               <>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-900/60 p-4 rounded-2xl border border-white/10">
                       <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Plan Actual</p>
                       <p className="text-sm font-black text-white flex items-center gap-2 uppercase">
                          <Sparkles className="w-3 h-3 text-orange-400" /> {alertPlan}
                       </p>
                    </div>
                    <div className="bg-gray-900/60 p-4 rounded-2xl border border-white/10">
                       <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Ciclo</p>
                       <p className="text-sm font-bold text-white uppercase">{billingCycle}</p>
                    </div>
                 </div>
                 <div className="bg-gray-900/60 p-5 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-3 mb-4">
                       <Calendar className="w-5 h-5 text-orange-500" />
                       <div>
                          <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Duración del Servicio</p>
                          <p className="text-xs font-bold text-gray-200">
                             {accessUntil ? `Vence el: ${new Date(accessUntil).toLocaleDateString('es-CL')}` : 'Sin fecha de vencimiento'}
                          </p>
                       </div>
                    </div>
                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                       <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Renovación</span>
                       <span className="text-[10px] font-black text-orange-400 bg-orange-400/5 px-2 py-1 rounded-md border border-orange-400/10 uppercase">Manual</span>
                    </div>
                 </div>
                 <div className="flex flex-col gap-3 pt-2">
                    <Link to="/desbloquear-alerta" className="flex items-center justify-center gap-2 w-full bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-orange-500/20 active:scale-95">
                      <Sparkles className="w-4 h-4" /> Gestionar Plan
                    </Link>
                    {alertSubStatus !== 'cancelled' && (
                      <button type="button" onClick={() => setShowCancelSub(true)} className="flex items-center justify-center gap-2 w-full bg-red-500/5 hover:bg-red-500/10 text-red-400 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/10 active:scale-95">
                        Cancelar Suscripción
                      </button>
                    )}
                    {alertSubStatus === 'cancelled' && (
                      <p className="text-center text-[10px] text-amber-400/80 font-bold italic">
                        Cancelada. Acceso hasta el {accessUntil ? new Date(accessUntil).toLocaleDateString('es-CL') : 'fin del período'}.
                      </p>
                    )}
                 </div>
               </>
             ) : (
               <div className="bg-gray-950/50 rounded-[2rem] p-8 border border-white/5 text-center space-y-6 relative overflow-hidden group">
                 <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 blur-[50px] rounded-full group-hover:bg-orange-500/20 transition-all duration-700"></div>
                 <div className="relative">
                   <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-500/20 shadow-inner">
                     <LockIcon className="w-8 h-8 text-orange-500" />
                   </div>
                   <h4 className="text-lg font-black text-white">Potencia tu Panadería</h4>
                   <p className="text-xs text-gray-400 leading-relaxed max-w-[240px] mx-auto mt-2">
                     Desbloquea el envío de alertas automáticas vía WhatsApp.
                   </p>
                 </div>
                 <Link to="/desbloquear-alerta" className="relative flex items-center justify-center gap-3 w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-orange-950/40 active:scale-95">
                   Activar Alerta Pan <Sparkles className="w-4 h-4" />
                 </Link>
               </div>
             )}
          </div>

          {/* Configuración de expiración y strikes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-950/50 rounded-2xl p-5 border border-white/5">
              <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase flex items-center gap-2">
                <Clock className="w-3 h-3" /> Tiempo máximo de retiro
              </label>
              <p className="text-gray-500 text-[10px] mb-3 leading-tight">Si el cliente no retira tras marcarlo como "Listo", se cancela.</p>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  value={expiryMinutes}
                  onChange={(e) => setExpiryMinutes(e.target.value)}
                  onBlur={() => {
                    const val = Math.max(5, Math.min(120, Number(expiryMinutes) || 30));
                    setExpiryMinutes(val);
                  }}
                  className="w-20 bg-gray-950 text-white text-center rounded-xl px-2 py-3 border border-white/5 focus:border-orange-500 focus:outline-none transition-all text-lg font-bold"
                />
                <span className="text-gray-400 text-xs">minutos</span>
              </div>
            </div>

            <div className="bg-gray-950/50 rounded-2xl p-5 border border-white/5">
              <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase flex items-center gap-2">
                <Ban className="w-3 h-3" /> Límite de Strikes
              </label>
              <p className="text-gray-500 text-[10px] mb-3 leading-tight">Cantidad de veces que un cliente puede fallar antes de ser bloqueado.</p>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  value={maxStrikes}
                  onChange={(e) => setMaxStrikes(e.target.value)}
                  onBlur={() => {
                    const val = Math.max(1, Math.min(10, Number(maxStrikes) || 3));
                    setMaxStrikes(val);
                  }}
                  className="w-20 bg-gray-950 text-white text-center rounded-xl px-2 py-3 border border-white/5 focus:border-orange-500 focus:outline-none transition-all text-lg font-bold"
                />
                <span className="text-gray-400 text-xs">strikes máx.</span>
              </div>
            </div>
          </div>

          {/* Configuración de Aviso Previo */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800/40 rounded-3xl p-6 border border-white/5 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-orange-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-1" data-tour="warning-settings">
                  <Bell className="w-3.5 h-3.5" /> Aviso Automático
                </label>
                <h3 className="text-white font-bold text-sm">Recordatorio por WhatsApp</h3>
                <p className="text-gray-500 text-[10px] leading-relaxed mt-1 max-w-[200px]">
                  Notifica al cliente minutos antes de que su pedido expire.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setEnableWarning(!enableWarning)}
                className={`w-14 h-7 rounded-full p-1 transition-all duration-300 shadow-inner flex items-center ${enableWarning ? 'bg-orange-600' : 'bg-gray-950 border border-white/5'}`}
              >
                <div className={`bg-white w-5 h-5 rounded-full shadow-lg transition-transform duration-300 transform ${enableWarning ? 'translate-x-7' : 'translate-x-0'}`} />
              </button>
            </div>

            {enableWarning && (
              <div className="flex items-center gap-3 pt-3 border-t border-white/5 animate-fadeIn">
                <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Avisar</span>
                <div className="flex items-center bg-gray-950/50 rounded-xl border border-white/5 px-3 py-1 scale-95 origin-left">
                  <input 
                    type="number" 
                    value={warningMinutes}
                    onChange={(e) => setWarningMinutes(e.target.value)}
                    onBlur={() => {
                      const val = Math.max(1, Math.min(Number(expiryMinutes) - 1, Number(warningMinutes) || 10));
                      setWarningMinutes(val);
                    }}
                    className="w-12 bg-transparent text-white text-center focus:outline-none text-base font-black"
                  />
                  <span className="text-gray-500 text-[10px] font-black uppercase ml-2">minutos</span>
                </div>
                <span className="text-gray-500 text-[10px] italic">antes del límite</span>
              </div>
            )}
          </div>

          <div className="pt-4">
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
                {loading ? 'Guardando cambios...' : 'GUARDAR CAMBIOS'}
             </button>
          </div>
        </form>

        <div className="mt-10 pt-10 border-t border-white/5 flex flex-col items-center gap-3">
           <p className="text-theme-muted text-sm text-center">
              Tu correo de acceso es: <span className="text-theme-base font-mono">{user?.email}</span>
           </p>
           <Link to="/terminos" target="_blank" className="text-[10px] text-theme-subtle hover:text-orange-500 font-bold transition-all mt-2 uppercase tracking-widest">
             Términos y condiciones
           </Link>
        </div>

        {/* Modal de cancelación de suscripción */}
        {showCancelSub && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-fadeIn">
            <div className="bg-gray-900 border border-red-500/20 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl animate-scaleIn text-center border-t-8 border-t-red-500">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-black mb-4">¿Cancelar suscripción?</h3>
              <p className="text-gray-400 mb-4 leading-relaxed text-sm">
                Tu acceso a ALERTA PAN se mantendrá activo hasta el final del período pagado. No se realizarán reembolsos parciales.
              </p>
              {accessUntil && (
                <p className="text-amber-400 text-xs font-bold mb-6">
                  Acceso disponible hasta: {new Date(accessUntil).toLocaleDateString('es-CL')}
                </p>
              )}
              <div className="flex flex-col gap-3">
                <button onClick={handleCancelSubscription} disabled={loadingCancel} className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black shadow-lg shadow-red-950/40 transition-all active:scale-95 disabled:opacity-50">
                  {loadingCancel ? 'Cancelando...' : 'SÍ, CANCELAR'}
                </button>
                <button onClick={() => setShowCancelSub(false)} className="w-full py-4 rounded-2xl bg-gray-950 hover:bg-gray-700 text-gray-400 font-bold transition-all border border-white/5">
                  VOLVER
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cambio de contraseña */}
        <PasswordChange />
      </div>
    </div>
  );
}

function PasswordChange() {
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [showForm, setShowForm] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });

    if (newPass.length < 6) {
      setMsg({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    if (newPass !== confirmPass) {
      setMsg({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    
    if (error) {
      setMsg({ type: 'error', text: translateError(error.message) });
    } else {
      setMsg({ type: 'success', text: '¡Contraseña actualizada con éxito!' });
      setNewPass('');
      setConfirmPass('');
      setShowForm(false);
    }
    setLoading(false);
    setIsConfirming(false);
  };

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    if (newPass.length < 6) {
      setMsg({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    if (newPass !== confirmPass) {
      setMsg({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }
    setIsConfirming(true);
  };

  return (
    <div className="mt-8 pt-8 border-t border-white/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-sm uppercase tracking-wide flex items-center gap-2">
          <LockIcon className="w-3 h-3" /> Cambiar Contraseña
        </h3>
        <button onClick={() => setShowForm(!showForm)}
          className="text-orange-500 hover:text-orange-400 text-sm font-bold flex items-center gap-1 transition-all">
          {showForm ? 'Cancelar' : 'Cambiar'}
        </button>
      </div>

      {msg.text && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-slideDown">
          <div className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center gap-3 font-bold text-sm ${
            msg.type === 'success' 
              ? 'bg-emerald-600/90 text-white border-emerald-500 shadow-emerald-900/40' 
              : 'bg-red-600/90 text-white border-red-500 shadow-red-900/40'
          }`}>
              {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
              <span className="flex-1">{msg.text}</span>
              <button onClick={() => setMsg({ type: '', text: '' })} className="hover:opacity-70 transition-opacity">
                <X className="w-4 h-4" />
              </button>
          </div>
        </div>
      )}

      {showForm && (
        <>
          <form onSubmit={handleInitialSubmit} className="space-y-4 animate-fadeIn">
            <div>
              <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase">Nueva Contraseña</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={newPass} onChange={e => setNewPass(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-gray-950 text-white rounded-xl px-5 py-3 border border-white/5 focus:border-orange-500 focus:outline-none transition-all pr-12" required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-orange-500 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase">Confirmar Contraseña</label>
              <div className="relative">
                <input type={showConfirm ? "text" : "password"} value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full bg-gray-950 text-white rounded-xl px-5 py-3 border border-white/5 focus:border-orange-500 focus:outline-none transition-all pr-12" required />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-orange-500 transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {newPass && confirmPass && newPass !== confirmPass && (
              <p className="text-red-400 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Las contraseñas no coinciden
              </p>
            )}
            <button type="submit" disabled={loading || newPass !== confirmPass || newPass.length < 6}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50">
              {loading ? 'Actualizando...' : 'ACTUALIZAR CONTRASEÑA'}
            </button>
          </form>

          {/* Modal de Confirmación */}
          {isConfirming && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-fadeIn">
              <div className="bg-gray-900 border border-orange-500/20 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl animate-scaleIn text-center border-t-8 border-t-orange-500">
                <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <LockIcon className="w-10 h-10 text-orange-500" />
                </div>
                <h3 className="text-2xl font-black mb-4">¿Estás seguro?</h3>
                <p className="text-gray-400 mb-8 leading-relaxed text-sm">
                  Estás a punto de cambiar tu contraseña de acceso. Deberás usar la nueva clave la próxima vez que inicies sesión.
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => handleChangePassword({ preventDefault: () => {} } as React.FormEvent)}
                    className="w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black shadow-lg shadow-orange-950/40 transition-all active:scale-95">
                    SÍ, CAMBIAR AHORA
                  </button>
                  <button onClick={() => setIsConfirming(false)}
                    className="w-full py-4 rounded-2xl bg-gray-950 hover:bg-gray-700 text-gray-400 font-bold transition-all border border-white/5">
                    CANCELAR
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
