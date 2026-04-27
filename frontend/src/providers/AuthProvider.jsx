import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  getIdToken,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "../auth/firebase";

const AuthContext = createContext(null);

function mapProfile(user, tokenResult) {
  if (!user) return null;

  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email?.split("@")[0] || "User",
    photoURL: user.photoURL || "",
    isAdmin: tokenResult?.claims?.admin === true,
    claims: tokenResult?.claims || {},
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = useMemo(() => getFirebaseAuth(), []);

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const tokenResult = await getIdTokenResult(nextUser);
      setUser(nextUser);
      setProfile(mapProfile(nextUser, tokenResult));
      setLoading(false);
    });

    return unsubscribe;
  }, [auth]);

  const value = useMemo(
    () => ({
      authReady: isFirebaseConfigured,
      loading,
      user,
      profile,
      async signInWithEmail(email, password) {
        if (!auth) throw new Error("Firebase Auth chưa được cấu hình.");
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const tokenResult = await getIdTokenResult(credential.user, true);
        setUser(credential.user);
        setProfile(mapProfile(credential.user, tokenResult));
        return credential.user;
      },
      async signUpWithEmail(name, email, password) {
        if (!auth) throw new Error("Firebase Auth chưa được cấu hình.");
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (name?.trim()) {
          await updateProfile(credential.user, { displayName: name.trim() });
        }
        const tokenResult = await getIdTokenResult(credential.user, true);
        setUser(credential.user);
        setProfile(
          mapProfile(
            {
              ...credential.user,
              displayName: name?.trim() || credential.user.displayName,
            },
            tokenResult
          )
        );
        return credential.user;
      },
      async signOutUser() {
        if (!auth) return;
        await signOut(auth);
        setUser(null);
        setProfile(null);
      },
      async getToken(forceRefresh = false) {
        if (!auth?.currentUser) return null;
        return getIdToken(auth.currentUser, forceRefresh);
      },
      async refreshClaims() {
        if (!auth?.currentUser) return null;
        const tokenResult = await getIdTokenResult(auth.currentUser, true);
        setProfile(mapProfile(auth.currentUser, tokenResult));
        return tokenResult;
      },
    }),
    [auth, loading, profile, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
