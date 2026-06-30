import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Key, AlertCircle, CheckCircle2, Eye, EyeOff, MapPin } from 'lucide-react';
import { CHILE_DATA } from '../lib/chile-data';
import { translateError } from '../lib/auth-errors';
import PhoneInput from '../components/PhoneInput';

export default function Register() {
  useEffect(() => { document.title = 'AhoraPan - Registro'; }, []);
  const { session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [comuna, setComuna] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [location, setLocation] = useState('');
  const [inviteKey, setInviteKey] = useState('');
  
  // Filtrar comunas según región seleccionada
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      setLoading(false);
      return;
    }

    if (!termsAccepted) {
      setError('Debes aceptar los términos y condiciones para continuar.');
      setLoading(false);
      return;
    }

    // Validar clave de invitación
    const { data: keyData, error: keyError } = await supabase
      .from('invitation_keys')
      .select('id, is_used')
      .eq('key_code', inviteKey.trim().toUpperCase())
      .single();

    if (keyError || !keyData) {
      setError('Clave de invitación inválida. Solicita una al administrador.');
      setLoading(false);
      return;
    }

    if (keyData.is_used) {
      setError('Esta clave ya fue utilizada. Solicita una nueva.');
      setLoading(false);
      return;
    }

    const formattedCiudad = formatCityName(ciudad);

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          bakery_name: name,
          phone,
          location,
          region,
          comuna,
          ciudad: formattedCiudad
        }
      }
    });

    if (authError) {
      setError(translateError(authError.message));
      setLoading(false);
      return;
    }

    // Supabase devuelve error nulo pero un usuario sin identidades si el correo ya existe
    if (authData?.user && authData.user.identities && authData.user.identities.length === 0) {
      setError('Este correo electrónico ya está registrado.');
      setLoading(false);
      return;
    }

    if (!authData.session) {
      setSuccess('Registro exitoso. Por favor, revisa tu correo electrónico para confirmar tu cuenta y luego inicia sesión.');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      return;
    }

    // Marcar clave como usada
    await supabase.from('invitation_keys').update({
      is_used: true,
      used_by_email: email,
      used_at: new Date().toISOString()
    }).eq('id', keyData.id);

    // Fallback: Si el trigger de BD (on_auth_user_created_profile) está fallando o desactivado,
    // insertamos el perfil manualmente aquí para asegurar que exista.
    if (authData?.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: email,
        role: email === 'matias.moreno101@gmail.com' ? 'admin' : 'owner'
      });
      if (profileError && profileError.code !== '23505') { // Ignorar error de duplicado si el trigger sí funcionó
        console.warn("No se pudo crear el perfil de respaldo:", profileError);
      }
    }

    // Sin email confirmation, la sesión se crea inmediatamente.
    // El trigger de BD crea la panadería automáticamente.
    // Breve espera para que el trigger de la BD termine.
    setSuccess('Sucursal creada con éxito. Preparando tu panel...');
    setTimeout(() => {
      navigate('/');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex py-10 items-center justify-center p-4 relative overflow-hidden">
      {/* Luces de fondo decorativas */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[90px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[90px] rounded-full" />

      <div className="max-w-md lg:max-w-6xl w-full bg-gray-900/60 backdrop-blur-2xl rounded-[2.5rem] md:rounded-[3rem] shadow-2xl p-7 md:p-12 border border-white/10 relative z-10 mx-4 flex flex-col lg:flex-row lg:items-start lg:gap-16">
        <div className="lg:w-1/3 lg:sticky lg:top-8">
          <div className="text-center lg:text-left mb-8 lg:mb-0">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
              Crea tu <br />
              <span className="gradient-orange-text">
                Sucursal
              </span>
            </h2>
            <p className="text-gray-400 text-lg">Únete a la red Ahora Pan y digitaliza tu panadería hoy mismo.</p>
            
            <div className="hidden lg:block mt-12 space-y-6">
              <div className="flex items-center gap-4 text-gray-500">
                <div className="w-10 h-10 rounded-2xl bg-gray-900/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-sm font-medium">Gestión de pedidos en tiempo real</p>
              </div>
              <div className="flex items-center gap-4 text-gray-500">
                <div className="w-10 h-10 rounded-2xl bg-gray-900/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-sm font-medium">Notificaciones automáticas</p>
              </div>
              <div className="flex items-center gap-4 text-gray-500">
                <div className="w-10 h-10 rounded-2xl bg-gray-900/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-sm font-medium">Panel de administración premium</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:w-2/3">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl mb-6 text-sm flex items-center gap-3 font-bold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-2xl mb-6 text-sm flex items-center gap-3 font-bold">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              {success}
            </div>
          )}
          
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase">Nombre del Local</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Panadería Las Lomas"
                autoComplete="organization"
                className="w-full bg-gray-950/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 transition-colors"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase">WhatsApp de Contacto</label>
                <PhoneInput 
                  value={phone}
                  onChange={(val) => setPhone(val)}
                  required 
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase">Región</label>
                <select 
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    setComuna('');
                  }}
                  className="w-full bg-gray-950/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 transition-colors"
                  required
                >
                  <option value="">Selecciona Región</option>
                  {CHILE_DATA.map(r => (
                    <option key={r.region} value={r.region}>{r.region}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase">Comuna</label>
                <select 
                  value={comuna}
                  onChange={(e) => setComuna(e.target.value)}
                  className="w-full bg-gray-950/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 transition-colors"
                  disabled={!region}
                  required
                >
                  <option value="">Selecciona Comuna</option>
                  {availableComunas.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase">Ciudad / Sector</label>
                <input 
                  type="text" 
                  list="ciudades-list"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  placeholder="Ej: Playa Ancha"
                  className="w-full bg-gray-950/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 transition-colors"
                  required 
                />
                <datalist id="ciudades-list">
                  {existingCities.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase flex items-center gap-2">
                <MapPin className="w-3 h-3 text-orange-500" /> Dirección (Calle y Número)
              </label>
              <input 
                type="text" 
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej: Av. Argentina 123"
                className="w-full bg-gray-950/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 transition-colors"
                required 
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                className="w-full bg-gray-950/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 transition-colors"
                required
              />
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase">Contraseña (+6)</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    minLength={6}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full bg-gray-950/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 transition-colors pr-20"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-500 hover:text-orange-400 transition-colors p-2"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase">Confirmar</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full bg-gray-950/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 transition-colors pr-12"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-500 hover:text-orange-400 transition-colors p-2"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase flex items-center gap-2">
                <Key className="w-3 h-3 text-orange-500" /> Clave de Invitación
              </label>
              <input 
                type="text" 
                value={inviteKey}
                onChange={(e) => {
                  let val = e.target.value.toUpperCase();
                  if (val.length === 4 && inviteKey.length === 3 && val === 'APAN') {
                    val = val + '-';
                  }
                  setInviteKey(val);
                }}
                placeholder="Ej: APAN-XXXX"
                className="w-full bg-gray-950/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 transition-colors font-mono tracking-widest text-center uppercase"
                required 
              />
              <p className="text-gray-500 text-[11px] mt-1 text-center">Solicita tu clave al administrador de Ahora Pan</p>
            </div>

            <div className="flex items-start gap-3 bg-gray-900/30 p-4 rounded-2xl border border-white/5 select-none cursor-pointer group hover:bg-gray-900/40 transition-all" onClick={() => setTermsAccepted(!termsAccepted)}>
              <div className={`mt-0.5 w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center shrink-0 ${termsAccepted ? 'bg-orange-600 border-orange-600' : 'border-white/5 bg-gray-950 group-hover:border-gray-500'}`}>
                {termsAccepted && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
              <p className="text-[11px] md:text-xs text-gray-400 leading-tight">
                Acepto los <Link to="/terminos?from=register" target="_blank" className="text-orange-500 font-bold hover:underline" onClick={(e) => e.stopPropagation()}>términos y condiciones</Link> de uso de la plataforma Ahora Pan y el tratamiento de mis datos de negocio.
              </p>
            </div>

            <button 
              type="submit" 
              disabled={loading || !termsAccepted}
              className="w-full mt-4 bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? 'Registrando...' : 'Crear Cuenta'}
            </button>
          </form>

          <p className="text-gray-500 text-center mt-8 text-sm">
            ¿Ya tienes cuenta? <Link to="/login" className="text-orange-500 hover:text-orange-400 ml-1">Inicia sesión aquí</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
