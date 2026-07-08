import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { Profile } from "./types";
import { initPurchases, getEntitlementTier } from "./revenue-cat";
import { identifyUser, resetAnalytics } from "./analytics";
import {
  registerForPushNotificationsAsync,
  clearPushRegistration,
} from "./notifications";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) {
      // RevenueCat entitlement wins over the DB column when active.
      const rcTier = await getEntitlementTier();
      const merged: Profile = {
        ...(data as Profile),
        subscription_tier: rcTier ?? (data as Profile).subscription_tier,
      };
      setProfile(merged);
      identifyUser(userId, {
        email: merged.email,
        company_name: merged.company_name,
        producer_name: merged.producer_name,
        subscription_tier: merged.subscription_tier,
      });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        initPurchases(session.user.id);
        registerForPushNotificationsAsync(session.user.id);
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        registerForPushNotificationsAsync(session.user.id);
        loadProfile(session.user.id);
      } else {
        clearPushRegistration();
        setProfile(null);
        resetAnalytics();
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
