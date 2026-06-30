import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export type Organization = {
  id: string;
  name: string;
  slug: string | null;
  plan: string | null;
  logo_url: string | null;
  brand_color: string | null;
  business_hours: any;
  is_active: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  organization: Organization | null;
  organizationId: string | null;
  organizationName: string;
  isSuperAdmin: boolean;
  loading: boolean;
  refreshOrganization: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const showLoader = !organization;
        Promise.all([
          checkSuperAdmin(currentUser.id),
          fetchOrganization(currentUser.id, showLoader),
        ]).catch(console.error);
      } else {
        setOrganization(null);
        setIsSuperAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSuperAdmin = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', userId)
        .maybeSingle();
      setIsSuperAdmin(!!data?.is_super_admin);
    } catch {
      setIsSuperAdmin(false);
    }
  };

  const fetchOrganization = async (
    userId: string,
    isInitial: boolean = false,
    retryCount = 0,
  ): Promise<void> => {
    if (isInitial && retryCount === 0) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('memberships')
        .select('organization_id, organizations(*)')
        .eq('user_id', userId)
        .order('created_at')
        .limit(1)
        .maybeSingle();

      const org = (data?.organizations as Organization | undefined) ?? null;

      if (org && !error) {
        setOrganization(org);
        if (isInitial) setLoading(false);
        return;
      }

      // El trigger de signup puede tardar: reintentar antes del fallback.
      if (retryCount < 5) {
        await new Promise((r) => setTimeout(r, 500));
        return fetchOrganization(userId, isInitial, retryCount + 1);
      }

      // Fallback: crear organización + membership vía RPC SECURITY DEFINER.
      console.warn('⚠️ Sin organización; ejecutando ensure_org_for_current_user…');
      const { error: rpcError } = await supabase.rpc('ensure_org_for_current_user', { p_name: 'Mi Taller' });
      if (!rpcError) {
        const { data: retryData } = await supabase
          .from('memberships')
          .select('organization_id, organizations(*)')
          .eq('user_id', userId)
          .order('created_at')
          .limit(1)
          .maybeSingle();
        setOrganization((retryData?.organizations as Organization | undefined) ?? null);
      }
      if (isInitial) setLoading(false);
    } catch (e) {
      console.error('Error cargando organización:', e);
      if (isInitial) setLoading(false);
    }
  };

  const refreshOrganization = async () => {
    if (!user?.id) return;
    await fetchOrganization(user.id, false);
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        organization,
        organizationId: organization?.id ?? null,
        organizationName: organization?.name ?? '',
        isSuperAdmin,
        loading,
        refreshOrganization,
        signOut,
      }}
    >
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
