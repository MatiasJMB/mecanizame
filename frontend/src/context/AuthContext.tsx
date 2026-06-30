import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  bakeryId: number | null;
  bakeryName: string;
  businessHours: any;
  orderExpiryMinutes: number;
  isActive: boolean;
  isAlertUnlocked: boolean;
  alertAccessUntil: string | null;
  alertPlan: string | null;
  alertBillingCycle: string | null;
  alertSubscriptionStatus: string | null;
  isAdmin: boolean;
  hasSeenTour: boolean;
  setHasSeenTour: (val: boolean) => void;
  refreshBakery: () => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [bakeryId, setBakeryId] = useState<number | null>(null);
  const [bakeryName, setBakeryName] = useState('');
  const [businessHours, setBusinessHours] = useState<any>(null);
  const [orderExpiryMinutes, setOrderExpiryMinutes] = useState<number>(30);
  const [isActive, setIsActive] = useState(true);
  const [isAlertUnlocked, setIsAlertUnlocked] = useState(false);
  const [alertAccessUntil, setAlertAccessUntil] = useState<string | null>(null);
  const [alertPlan, setAlertPlan] = useState<string | null>(null);
  const [alertBillingCycle, setAlertBillingCycle] = useState<string | null>(null);
  const [alertSubscriptionStatus, setAlertSubscriptionStatus] = useState<string | null>(null);
  const [hasSeenTour, setHasSeenTour] = useState(true); // Default a true para evitar parpadeos
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Iniciamos la escucha de cambios de sesión una sola vez
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        // Solo mostrar loader global si no tenemos bakeryId (es la carga real de la app)
        const shouldShowGlobalLoader = !bakeryId;
        
        Promise.all([
          checkAdminRole(currentUser.id, currentUser.email),
          fetchBakeryId(currentUser.id, shouldShowGlobalLoader)
        ]).catch(console.error); // El setLoading(false) ahora se maneja internamente en fetchBakeryId
      } else {
        setBakeryId(null);
        setBakeryName('');
        setBusinessHours(null);
        setOrderExpiryMinutes(30);
        setIsActive(true);
        setIsAlertUnlocked(false);
        setAlertAccessUntil(null);
        setAlertPlan(null);
        setAlertBillingCycle(null);
        setAlertSubscriptionStatus(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      authSub.unsubscribe();
    };
  }, []); 

  const checkAdminRole = async (userId: string, email?: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
        
      setIsAdmin(data?.role === 'admin' || email === 'matias.moreno101@gmail.com');
    } catch (e) {
      setIsAdmin(email === 'matias.moreno101@gmail.com');
    }
  };

  const fetchBakeryId = async (userId: string, isInitial: boolean = false, retryCount = 0): Promise<void> => {
    // Solo mostramos el loader global si es la carga inicial
    if (isInitial && retryCount === 0) setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('bakeries')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (data && !error) {
        const hasValidAlertAccess = !!data.is_alert_unlocked && (!data.alert_access_until || new Date(data.alert_access_until) > new Date());
        setBakeryId(data.id);
        setBakeryName(data.name || '');
        setBusinessHours(data.business_hours);
        setOrderExpiryMinutes(data.order_expiry_minutes || 30);
        setHasSeenTour(data.has_seen_tour);
        setIsActive(data.is_active ?? true);
        setIsAlertUnlocked(hasValidAlertAccess);
        setAlertAccessUntil(data.alert_access_until ?? null);
        setAlertPlan(data.alert_plan ?? null);
        setAlertBillingCycle(data.alert_billing_cycle ?? null);
        setAlertSubscriptionStatus(data.alert_subscription_status ?? null);
        if (isInitial) setLoading(false);
      } else {
        if (retryCount < 5) {
          // Esperar 500ms y reintentar, por si el trigger de la base de datos aún no termina
          await new Promise(resolve => setTimeout(resolve, 500));
          return fetchBakeryId(userId, isInitial, retryCount + 1);
        }
        
        console.warn("⚠️ No se encontró panadería. Creando panadería de recuperación...");
        // Fallback: si el trigger falló, crear la panadería manualmente
        const { data: userObj } = await supabase.auth.getUser();
        const meta = userObj?.user?.user_metadata || {};
        
        const { data: newBakery, error: insertError } = await supabase
          .from('bakeries')
          .insert({
            user_id: userId,
            name: meta.bakery_name || 'Mi Panadería',
            contact_phone: meta.phone || '',
            location: meta.location || '',
            region: meta.region || '',
            comuna: meta.comuna || '',
            ciudad: meta.ciudad || ''
          })
          .select('*')
          .maybeSingle();

        if (newBakery && !insertError) {
          setBakeryId(newBakery.id);
          setBakeryName(newBakery.name || '');
          setBusinessHours(newBakery.business_hours);
          setOrderExpiryMinutes(newBakery.order_expiry_minutes || 30);
          setHasSeenTour(newBakery.has_seen_tour);
          setIsActive(newBakery.is_active ?? true);
          if (isInitial) setLoading(false);
          return;
        }

        setBakeryId(null);
        setBakeryName('');
        if (isInitial) setLoading(false);
      }
    } catch (e) {
      console.error("Error fetching bakery:", e);
      if (isInitial) setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  const refreshBakery = async () => {
    if (!user?.id) return;
    await fetchBakeryId(user.id, false); // Carga silenciosa
  };

  return (
    <AuthContext.Provider value={{ session, user, bakeryId, bakeryName, businessHours, orderExpiryMinutes, hasSeenTour, setHasSeenTour, isActive, isAlertUnlocked, alertAccessUntil, alertPlan, alertBillingCycle, alertSubscriptionStatus, isAdmin, refreshBakery, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
