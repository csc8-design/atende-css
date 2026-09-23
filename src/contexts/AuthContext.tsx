import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "manager" | "agent";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { id: string; full_name: string; avatar_url: string | null; phone: string | null } | null;
  roles: AppRole[];
  isManager: boolean;
  isAdmin: boolean;
  isAgent: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, phone")
      .eq("user_id", userId)
      .single();
    setProfile(data);
  };

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles((data || []).map((r: any) => r.role as AppRole));
  };

  useEffect(() => {
    let initialized = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Apenas eventos que realmente indicam logout devem limpar o estado.
        // Eventos transitórios (TOKEN_REFRESHED com falha temporária, INITIAL_SESSION
        // disparado antes do getSession resolver, etc.) não devem deslogar o usuário.
        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          setLoading(false);
          return;
        }

        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          // Defer fetch para evitar deadlock dentro do callback
          setTimeout(() => {
            fetchProfile(newSession.user.id);
            fetchRoles(newSession.user.id);
          }, 0);
          setLoading(false);
        } else if (initialized) {
          // Ignora null inicial; só age se já inicializamos e for um evento explícito
          // (que não é SIGNED_OUT — tratado acima). Mantém sessão atual.
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      initialized = true;
      if (existing) {
        setSession(existing);
        setUser(existing.user);
        fetchProfile(existing.user.id);
        fetchRoles(existing.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isManager = roles.includes("manager") || roles.includes("admin");
  const isAdmin = roles.includes("admin");
  const isAgent = roles.includes("agent");

  return (
    <AuthContext.Provider
      value={{ user, session, profile, roles, isManager, isAdmin, isAgent, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
