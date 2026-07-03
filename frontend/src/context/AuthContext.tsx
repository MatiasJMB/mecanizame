import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/api/client';
import { setActiveOrg } from '@/api';
import { billingInfo } from '@/lib/billing';
import type { Organization, Membership, Role } from '@/types';
import type { User, Session } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

// Re-export para compatibilidad con imports existentes (`import { type Organization } from AuthContext`).
export type { Organization, Membership } from '@/types';

const IMPERSONATE_KEY = 'mecanizame-impersonate-org';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  memberships: Membership[];
  organization: Organization | null;        // taller activo real del usuario (no impersonado)
  activeOrganization: Organization | null;  // impersonado si super-admin, si no organization
  organizationId: string | null;
  organizationName: string;
  role: Role | null;                        // rol en el taller activo (null si impersona/super-admin)
  isSuperAdmin: boolean;
  isImpersonating: boolean;
  needsOnboarding: boolean;
  activeOrgSuspended: boolean;              // taller activo suspendido/deshabilitado
  activeOrgPending: boolean;               // taller activo pendiente de aprobación del super-admin
  switching: boolean;
  loading: boolean;
  blockedMsg: string | null;
  switchOrg: (orgId: string) => Promise<void>;
  refreshMemberships: () => Promise<void>;
  refreshOrganization: () => Promise<void>; // alias de refreshMemberships (compat)
  impersonate: (org: Organization) => void;
  stopImpersonating: () => void;
  signOut: () => Promise<void>;
  clearBlocked: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [impersonatedOrg, setImpersonatedOrg] = useState<Organization | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const initialLoaded = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const showLoader = !initialLoaded.current;
        // Diferir las llamadas a supabase.* FUERA del callback: hacerlas con `await` aquí dentro
        // puede provocar un deadlock con el lock interno de GoTrue (la app se queda en "Cargando…"
        // hasta recargar la página). El setTimeout(0) libera el callback y deja que el refresco de
        // token termine antes de consultar la base.
        setTimeout(() => {
          void (async () => {
            try {
              await Promise.all([
                checkSuperAdmin(currentUser.id),
                fetchMemberships(currentUser.id, showLoader),
              ]);
            } catch (e) { console.error(e); }
            finally { initialLoaded.current = true; }
          })();
        }, 0);
      } else {
        initialLoaded.current = false;
        setMemberships([]);
        setActiveOrgId(null);
        setImpersonatedOrg(null);
        setIsSuperAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSuperAdmin = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
      const superAdmin = !!data?.is_super_admin;
      setIsSuperAdmin(superAdmin);
      if (superAdmin) rehydrateImpersonation();
      else setImpersonatedOrg(null);
      return superAdmin;
    } catch {
      setIsSuperAdmin(false);
      return false;
    }
  };

  const rehydrateImpersonation = async () => {
    const id = localStorage.getItem(IMPERSONATE_KEY);
    if (!id) return;
    const { data } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle();
    if (data) setImpersonatedOrg(data as Organization);
    else localStorage.removeItem(IMPERSONATE_KEY);
  };

  const fetchMemberships = async (userId: string, isInitial = false): Promise<void> => {
    if (isInitial) setLoading(true);
    try {
      const [{ data: prof }, { data: rows }] = await Promise.all([
        supabase.from('profiles').select('active_org_id').eq('id', userId).maybeSingle(),
        supabase.from('memberships').select('role, organization_id, organizations(*)').eq('user_id', userId).order('created_at'),
      ]);
      const mships: Membership[] = ((rows ?? []) as any[])
        .filter((r) => r.organizations)
        .map((r) => ({ role: r.role as Role, organization: r.organizations as Organization }));
      setMemberships(mships);
      const ids = mships.map((m) => m.organization.id);
      const active = (prof?.active_org_id && ids.includes(prof.active_org_id)) ? prof.active_org_id : (ids[0] ?? null);
      setActiveOrgId(active);
    } catch (e) {
      console.error('Error cargando membresías:', e);
      setMemberships([]);
      setActiveOrgId(null);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  // --- Derivados ---
  const activeMembership = memberships.find((m) => m.organization.id === activeOrgId) ?? null;
  const organization = activeMembership?.organization ?? null;
  const isImpersonating = !!(isSuperAdmin && impersonatedOrg);
  const role: Role | null = isImpersonating ? null : (activeMembership?.role ?? null);
  const activeOrganization = isImpersonating ? impersonatedOrg : organization;
  const bi = organization ? billingInfo(organization.paid_until) : null;
  const activeOrgSuspended = !isImpersonating && !!organization && (organization.is_active === false || (bi?.blocking ?? false));
  const activeOrgPending = !isImpersonating && !!organization && organization.is_approved === false;
  const needsOnboarding = !!session && !isSuperAdmin && memberships.length === 0 && !loading;

  const switchOrg = async (orgId: string) => {
    if (orgId === activeOrgId || !memberships.some((m) => m.organization.id === orgId)) return;
    setSwitching(true);
    // Mover el taller activo server-side ANTES de cambiar el estado local: así la RLS ya
    // apunta al taller nuevo cuando las páginas recargan por su dep-array [organizationId].
    const { error } = await setActiveOrg(orgId);
    setSwitching(false);
    if (error) { toast.error('No se pudo cambiar de taller'); return; }
    setActiveOrgId(orgId);
  };

  const refreshMemberships = async () => {
    if (user?.id) await fetchMemberships(user.id, false);
  };

  // Reacciona en vivo a cambios del taller activo (super-admin habilita/deshabilita, registra pago,
  // o elimina el taller). Ya NO desloguea: recalcula el estado o cambia a otro taller.
  useEffect(() => {
    if (!organization || isSuperAdmin) return;
    const orgId = organization.id;
    const ch = supabase
      .channel(`org-status-${orgId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'organizations', filter: `id=eq.${orgId}` }, (payload: any) => {
        const next = payload.new;
        if (next) setMemberships((prev) => prev.map((m) => (m.organization.id === orgId ? { ...m, organization: { ...m.organization, ...next } } : m)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'organizations', filter: `id=eq.${orgId}` }, () => {
        setMemberships((prev) => {
          const remaining = prev.filter((m) => m.organization.id !== orgId);
          setActiveOrgId(remaining[0]?.organization.id ?? null);
          return remaining;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, isSuperAdmin]);

  const impersonate = (org: Organization) => {
    if (!isSuperAdmin) return;
    localStorage.setItem(IMPERSONATE_KEY, org.id);
    setImpersonatedOrg(org);
  };

  const stopImpersonating = () => {
    localStorage.removeItem(IMPERSONATE_KEY);
    setImpersonatedOrg(null);
  };

  const signOut = async () => {
    setLoading(true);
    localStorage.removeItem(IMPERSONATE_KEY);
    await supabase.auth.signOut();
  };

  const clearBlocked = () => setBlockedMsg(null);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        memberships,
        organization,
        activeOrganization,
        organizationId: activeOrganization?.id ?? null,
        organizationName: activeOrganization?.name ?? '',
        role,
        isSuperAdmin,
        isImpersonating,
        needsOnboarding,
        activeOrgSuspended,
        activeOrgPending,
        switching,
        loading,
        blockedMsg,
        switchOrg,
        refreshMemberships,
        refreshOrganization: refreshMemberships,
        impersonate,
        stopImpersonating,
        signOut,
        clearBlocked,
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
