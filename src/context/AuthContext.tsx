import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserId } from '../types';
import { USERS } from '../utils/settlementEngine';
import { auth } from '../config/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';

interface AuthContextType {
  activeUserId: UserId;
  userProfile: User;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  switchProfile: (userId: UserId) => void;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, housemateId: UserId) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_USER_STORAGE_KEY = 'home_finance_active_user_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUserId, setActiveUserId] = useState<UserId>(() => {
    const saved = localStorage.getItem(ACTIVE_USER_STORAGE_KEY) as UserId;
    return saved && USERS[saved] ? saved : 'raiyan';
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const switchProfile = (userId: UserId) => {
    if (USERS[userId]) {
      setActiveUserId(userId);
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    setFirebaseUser(cred.user);
  };

  const signUpWithEmail = async (email: string, pass: string, housemateId: UserId) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    setFirebaseUser(cred.user);
    switchProfile(housemateId);
  };

  const logout = async () => {
    await signOut(auth);
    setFirebaseUser(null);
  };

  const userProfile = USERS[activeUserId] || USERS.raiyan;

  return (
    <AuthContext.Provider
      value={{
        activeUserId,
        userProfile,
        firebaseUser,
        loading,
        switchProfile,
        loginWithEmail,
        signUpWithEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
