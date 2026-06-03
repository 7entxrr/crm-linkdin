"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import { getUserProfile } from "@/lib/firebase/auth";
import type { AppUser, UserRole } from "@/types";

interface AuthContextValue {
  firebaseUser: User | null;
  profile: AppUser | null;
  role: UserRole | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (user: User | null) => {
    if (!user) {
      setProfile(null);
      return;
    }
    const p = await getUserProfile(user.uid);
    setProfile(p);
  };

  const refreshProfile = async () => {
    await loadProfile(firebaseUser);
  };

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      await loadProfile(user);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        role: profile?.role ?? null,
        loading,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
