import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gerador" | "reciclador" | "transportadora" | "operador";

export type ProfileStatus = "pending" | "approved" | "rejected" | "suspended";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  realRole: AppRole | null;
  roles: AppRole[];
  status: ProfileStatus | null;
  hasPendingRequest: boolean;
  isDemo: boolean;
  timeZone: string;
  refresh: () => Promise<void>;
}

const IMPERSONATE_KEY = "batterylink.impersonate_role";

export function getImpersonatedRole(): AppRole | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(IMPERSONATE_KEY);
  return (v as AppRole) || null;
}
export function setImpersonatedRole(role: AppRole | null) {
  if (typeof window === "undefined") return;
  if (role) window.localStorage.setItem(IMPERSONATE_KEY, role);
  else window.localStorage.removeItem(IMPERSONATE_KEY);
  window.dispatchEvent(new Event("impersonate-change"));
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [status, setStatus] = useState<ProfileStatus | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [timeZone, setTimeZone] = useState("America/Sao_Paulo");
  const [loading, setLoading] = useState(true);
  const [impersonate, setImpersonate] = useState<AppRole | null>(getImpersonatedRole());

  const loadMeta = useCallback(async (userId: string) => {
    const [{ data: roleRows }, { data: profile }, { data: req }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("profiles")
        .select("status,suspended_at,is_demo,timezone")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("registration_requests")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "pending")
        .limit(1),
    ]);
    setRoles((roleRows ?? []).map((r) => r.role as AppRole));
    setStatus(profile?.suspended_at ? "suspended" : ((profile?.status as ProfileStatus) ?? null));
    setIsDemo(Boolean(profile?.is_demo));
    setTimeZone(profile?.timezone || "America/Sao_Paulo");
    setHasPendingRequest((req ?? []).length > 0);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) await loadMeta(data.session.user.id);
    else {
      setRoles([]);
      setStatus(null);
      setHasPendingRequest(false);
      setIsDemo(false);
      setTimeZone("America/Sao_Paulo");
    }
  }, [loadMeta]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refresh();
      if (mounted) setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s?.user) void loadMeta(s.user.id);
      else {
        setRoles([]);
        setStatus(null);
        setHasPendingRequest(false);
        setIsDemo(false);
        setTimeZone("America/Sao_Paulo");
      }
    });
    const onImp = () => setImpersonate(getImpersonatedRole());
    window.addEventListener("impersonate-change", onImp);
    window.addEventListener("storage", onImp);
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("impersonate-change", onImp);
      window.removeEventListener("storage", onImp);
    };
  }, [refresh, loadMeta]);

  const realRole: AppRole | null = roles.includes("admin") ? "admin" : (roles[0] ?? null);
  const effective: AppRole | null = realRole === "admin" && impersonate ? impersonate : realRole;

  return {
    loading,
    session,
    user: session?.user ?? null,
    role: effective,
    realRole,
    roles,
    status,
    hasPendingRequest,
    isDemo,
    timeZone,
    refresh,
  };
}
