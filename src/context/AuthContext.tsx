import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserId, UserProfile, House, HouseMember } from '../types';
import { USERS } from '../utils/settlementEngine';
import {
  loadUsersDB,
  saveUsersDB,
  loadHousesDB,
  saveHousesDB,
  getActiveSession,
  setActiveSession,
} from '../utils/mockAuthDatabase';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User as FirebaseUser } from 'firebase/auth';

interface AuthContextType {
  activeUserId: UserId;
  userProfile: User;
  dbUserProfile: UserProfile | null;
  currentHouse: House | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  switchProfile: (userId: UserId) => void;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  loginOrSignUpDemoAccount: (email: string, pass: string, displayName: string, housemateId: UserId) => Promise<void>;
  logout: () => Promise<void>;
  createHouse: (houseName: string) => Promise<void>;
  joinHouse: (houseCode: string) => Promise<void>;
  kickMember: (targetUid: string) => Promise<void>;
  leaveHouse: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_USER_STORAGE_KEY = 'home_finance_active_user_v1';

// Strict Authorized Accounts Map
const AUTHORIZED_DEMO_ACCOUNTS: Record<string, { pass: string; id: UserId; displayName: string }> = {
  'raiyan@gmail.com': { pass: 'dummy123', id: 'raiyan', displayName: 'Raiyan' },
  'himel@gmail.com': { pass: 'dummy123', id: 'himel', displayName: 'Himel' },
  'lazim@gmail.com': { pass: 'dummy123', id: 'lazim', displayName: 'Lazim' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUserId, setActiveUserId] = useState<UserId>(() => {
    const saved = localStorage.getItem(ACTIVE_USER_STORAGE_KEY) as UserId;
    return saved && USERS[saved] ? saved : 'raiyan';
  });

  const [dbUserProfile, setDbUserProfile] = useState<UserProfile | null>(() => getActiveSession());
  const [currentHouse, setCurrentHouse] = useState<House | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync House state whenever dbUserProfile changes
  useEffect(() => {
    if (!dbUserProfile?.houseId) {
      setCurrentHouse(null);
      return;
    }
    const houses = loadHousesDB();
    const house = houses.find((h) => h.id === dbUserProfile.houseId) || null;
    setCurrentHouse(house);
  }, [dbUserProfile?.houseId]);

  const switchProfile = (userId: UserId) => {
    if (USERS[userId]) {
      setActiveUserId(userId);
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
    }
  };

  // Login Handler (Strict Demo Account Enforcement)
  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const demo = AUTHORIZED_DEMO_ACCOUNTS[cleanEmail];

    // STRICT VALIDATION: Reject any non-approved email or password combination
    if (!demo || pass !== demo.pass) {
      setLoading(false);
      throw new Error(
        'Access Denied: Only pre-approved housemate accounts (raiyan@gmail.com, himel@gmail.com, lazim@gmail.com) with password "dummy123" are authorized.'
      );
    }

    // 1. Attempt optional Firebase login if configured
    if (auth) {
      try {
        await signInWithEmailAndPassword(auth, cleanEmail, pass);
      } catch (fbErr) {
        console.warn('Firebase Auth notice (falling back to local database):', fbErr);
      }
    }

    // 2. Local Database Authentication
    const users = loadUsersDB();
    let existingUser = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!existingUser) {
      existingUser = {
        uid: `user-${demo.id}-001`,
        displayName: demo.displayName,
        email: cleanEmail,
        houseId: 'house-demo-001',
        role: demo.id === 'raiyan' ? 'leader' : 'member',
        createdAt: new Date().toISOString(),
      };
      saveUsersDB([...users, existingUser]);
    }

    switchProfile(demo.id);
    setActiveSession(existingUser);
    setDbUserProfile(existingUser);
    setLoading(false);
  };

  // Sign Up Handler (Strict Demo Account Enforcement)
  const signUpWithEmail = async (email: string, pass: string, displayName: string) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const demo = AUTHORIZED_DEMO_ACCOUNTS[cleanEmail];

    if (!demo || pass !== demo.pass) {
      setLoading(false);
      throw new Error(
        'Access Denied: Registration is restricted to pre-approved housemate credentials (raiyan@gmail.com, himel@gmail.com, lazim@gmail.com) with password "dummy123".'
      );
    }

    if (auth) {
      try {
        await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      } catch (fbErr) {
        console.warn('Firebase Sign Up notice:', fbErr);
      }
    }

    const users = loadUsersDB();
    let existing = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!existing) {
      existing = {
        uid: `user-${demo.id}-001`,
        displayName: displayName.trim() || demo.displayName,
        email: cleanEmail,
        houseId: 'house-demo-001',
        role: demo.id === 'raiyan' ? 'leader' : 'member',
        createdAt: new Date().toISOString(),
      };
      saveUsersDB([...users, existing]);
    } else {
      existing.displayName = displayName.trim() || existing.displayName;
      saveUsersDB(users);
    }

    switchProfile(demo.id);
    setActiveSession(existing);
    setDbUserProfile(existing);
    setLoading(false);
  };

  // 1-Click Demo Login
  const loginOrSignUpDemoAccount = async (email: string, pass: string, _displayName: string, housemateId: UserId) => {
    switchProfile(housemateId);
    await loginWithEmail(email, pass);
  };

  // Logout Handler
  const logout = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {}
    }
    setActiveSession(null);
    setDbUserProfile(null);
    setCurrentHouse(null);
  };

  // Create House Handler
  const createHouse = async (houseName: string) => {
    if (!dbUserProfile) throw new Error('You must be logged in to create a house');
    const name = houseName.trim();
    if (!name) throw new Error('House name cannot be empty');

    const randomCode = `HM-${Math.floor(1000 + Math.random() * 9000)}`;
    const houseId = `house-${Date.now()}`;
    const now = new Date().toISOString();

    const leaderMember: HouseMember = {
      uid: dbUserProfile.uid,
      displayName: dbUserProfile.displayName,
      email: dbUserProfile.email,
      role: 'leader',
      joinedAt: now,
    };

    const newHouse: House = {
      id: houseId,
      code: randomCode,
      name,
      leaderUid: dbUserProfile.uid,
      members: [leaderMember],
      createdAt: now,
    };

    const houses = loadHousesDB();
    saveHousesDB([...houses, newHouse]);

    const users = loadUsersDB();
    const updatedUsers = users.map((u) => {
      if (u.uid === dbUserProfile.uid) {
        return { ...u, houseId, role: 'leader' as const };
      }
      return u;
    });
    saveUsersDB(updatedUsers);

    const updatedProfile = { ...dbUserProfile, houseId, role: 'leader' as const };
    setActiveSession(updatedProfile);
    setDbUserProfile(updatedProfile);
    setCurrentHouse(newHouse);
  };

  // Join House Handler
  const joinHouse = async (houseCode: string) => {
    if (!dbUserProfile) throw new Error('You must be logged in to join a house');
    const cleanCode = houseCode.trim().toUpperCase();
    if (!cleanCode) throw new Error('Please enter a house code');

    const houses = loadHousesDB();
    const house = houses.find((h) => h.code.toUpperCase() === cleanCode);

    if (!house) {
      throw new Error(`No house found with code "${cleanCode}". Please verify and try again.`);
    }

    const isAlreadyMember = house.members.some((m) => m.uid === dbUserProfile.uid);
    if (!isAlreadyMember) {
      const now = new Date().toISOString();
      const newMember: HouseMember = {
        uid: dbUserProfile.uid,
        displayName: dbUserProfile.displayName,
        email: dbUserProfile.email,
        role: 'member',
        joinedAt: now,
      };

      house.members.push(newMember);
      saveHousesDB(houses);
    }

    const users = loadUsersDB();
    const updatedUsers = users.map((u) => {
      if (u.uid === dbUserProfile.uid) {
        return { ...u, houseId: house.id, role: 'member' as const };
      }
      return u;
    });
    saveUsersDB(updatedUsers);

    const updatedProfile = { ...dbUserProfile, houseId: house.id, role: 'member' as const };
    setActiveSession(updatedProfile);
    setDbUserProfile(updatedProfile);
    setCurrentHouse(house);
  };

  // Kick Member Handler
  const kickMember = async (targetUid: string) => {
    if (!dbUserProfile || !currentHouse) return;
    if (currentHouse.leaderUid !== dbUserProfile.uid) {
      throw new Error('Only the House Leader can kick members');
    }

    const houses = loadHousesDB();
    const house = houses.find((h) => h.id === currentHouse.id);
    if (house) {
      house.members = house.members.filter((m) => m.uid !== targetUid);
      saveHousesDB(houses);
      setCurrentHouse({ ...house });
    }

    const users = loadUsersDB();
    const updatedUsers = users.map((u) => {
      if (u.uid === targetUid) {
        return { ...u, houseId: null, role: null };
      }
      return u;
    });
    saveUsersDB(updatedUsers);
  };

  // Leave House Handler
  const leaveHouse = async () => {
    if (!dbUserProfile || !currentHouse) return;

    const houses = loadHousesDB();
    const house = houses.find((h) => h.id === currentHouse.id);
    if (house) {
      house.members = house.members.filter((m) => m.uid !== dbUserProfile.uid);
      saveHousesDB(houses);
    }

    const users = loadUsersDB();
    const updatedUsers = users.map((u) => {
      if (u.uid === dbUserProfile.uid) {
        return { ...u, houseId: null, role: null };
      }
      return u;
    });
    saveUsersDB(updatedUsers);

    const updatedProfile = { ...dbUserProfile, houseId: null, role: null };
    setActiveSession(updatedProfile);
    setDbUserProfile(updatedProfile);
    setCurrentHouse(null);
  };

  const userProfile = USERS[activeUserId] || USERS.raiyan;

  return (
    <AuthContext.Provider
      value={{
        activeUserId,
        userProfile,
        dbUserProfile,
        currentHouse,
        firebaseUser: null,
        isAuthenticated: Boolean(dbUserProfile),
        loading,
        switchProfile,
        loginWithEmail,
        signUpWithEmail,
        loginOrSignUpDemoAccount,
        logout,
        createHouse,
        joinHouse,
        kickMember,
        leaveHouse,
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
