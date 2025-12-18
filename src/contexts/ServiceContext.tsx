import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getCrowdfundService, type CrowdfundService, type Profile } from "@/services/crowdfundService";

interface ServiceContextValue {
  service: CrowdfundService | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const ServiceContext = createContext<ServiceContextValue | null>(null);

export function ServiceProvider({ children }: { children: ReactNode }) {
  const [service, setService] = useState<CrowdfundService | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function init() {
      const svc = await getCrowdfundService();
      setService(svc);

      const currentSession = await svc.getSession();
      setSession(currentSession);

      if (currentSession) {
        const userProfile = await svc.getProfile();
        setProfile(userProfile);
      }

      unsubscribe = svc.onAuthStateChange(async (newSession) => {
        setSession(newSession);
        if (newSession) {
          const userProfile = await svc.getProfile();
          setProfile(userProfile);
        } else {
          setProfile(null);
        }
      });

      setLoading(false);
    }

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (service && session) {
      const userProfile = await service.getProfile();
      setProfile(userProfile);
    }
  };

  return (
    <ServiceContext.Provider value={{ service, session, profile, loading, refreshProfile }}>
      {children}
    </ServiceContext.Provider>
  );
}

export function useService() {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error("useService must be used within ServiceProvider");
  }
  return context;
}
