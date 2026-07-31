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
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { syncSaveUser, syncSaveHouse, subscribeHouse } from '../utils/firebaseSync';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';

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
  updateUserProfilePhoto: (avatarUrl: string) => Promise<void>;
  changeUserPassword: (currentPass: string, newPass: string) => Promise<void>;
  logout: () => Promise<void>;
  createHouse: (houseName: string, customHouseCode?: string) => Promise<void>;
  joinHouse: (houseCode: string) => Promise<void>;
  updateHouseName: (newName: string) => Promise<void>;
  kickMember: (targetUid: string) => Promise<void>;
  leaveHouse: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_USER_STORAGE_KEY = 'home_finance_active_user_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUserId, setActiveUserId] = useState<UserId>(() => {
    const saved = localStorage.getItem(ACTIVE_USER_STORAGE_KEY) as UserId;
    return saved && USERS[saved] ? saved : 'raiyan';
  });

  const [dbUserProfile, setDbUserProfile] = useState<UserProfile | null>(() => getActiveSession());
  const [currentHouse, setCurrentHouse] = useState<House | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(false);

  // Connect Firebase Auth Listener & Sync Profile from Firestore (Bug 1.1)
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user && isFirebaseConfigured && db) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const fbProfile = userSnap.data() as UserProfile;
            setDbUserProfile((prev) => ({ ...prev, ...fbProfile }));
            setActiveSession(fbProfile);
            syncHouseForUser(fbProfile);
          }
        } catch (e) {
          console.warn('Firestore auth listener sync notice:', e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Helper: Refresh house object from DB based on user profile (with Firestore cloud sync)
  const syncHouseForUser = async (profile: UserProfile | null) => {
    if (!profile?.houseId) {
      setCurrentHouse(null);
      return;
    }
    const houses = loadHousesDB();
    const house = houses.find((h) => h.id === profile.houseId) || null;
    if (house) {
      setCurrentHouse({ ...house });
    }

    if (isFirebaseConfigured && db && profile.houseId) {
      try {
        const docRef = doc(db, 'houses', profile.houseId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const firestoreHouse = snap.data() as House;
          setCurrentHouse({ ...firestoreHouse });
          const idx = houses.findIndex((h) => h.id === firestoreHouse.id);
          if (idx >= 0) houses[idx] = firestoreHouse;
          else houses.push(firestoreHouse);
          saveHousesDB(houses);
        }
      } catch (err) {
        console.warn('Firestore syncHouseForUser notice:', err);
      }
    }
  };

  // Sync House state whenever dbUserProfile reference or values change
  useEffect(() => {
    syncHouseForUser(dbUserProfile);
  }, [dbUserProfile?.houseId]);

  // Realtime House Roster Listener (Live multi-user roster updates across devices)
  useEffect(() => {
    if (!currentHouse?.id) return;
    const unsub = subscribeHouse(currentHouse.id, (updatedHouse) => {
      if (updatedHouse) {
        setCurrentHouse(updatedHouse);
        const houses = loadHousesDB();
        const existingIdx = houses.findIndex((h) => h.id === updatedHouse.id);
        if (existingIdx >= 0) {
          houses[existingIdx] = updatedHouse;
          saveHousesDB(houses);
        } else {
          saveHousesDB([...houses, updatedHouse]);
        }
      }
    });
    return () => unsub();
  }, [currentHouse?.id]);

  const switchProfile = (userId: UserId) => {
    if (USERS[userId]) {
      setActiveUserId(userId);
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
    }
  };

  // Strict Login Handler
  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    let firebaseUid: string | null = null;

    if (auth) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        firebaseUid = userCred.user.uid;
      } catch (fbErr: any) {
        // If account was deleted in Firebase Console or credentials don't match, purge stale local cache & throw error
        const users = loadUsersDB();
        const filtered = users.filter((u) => u.email.toLowerCase() !== cleanEmail);
        saveUsersDB(filtered);
        setLoading(false);
        throw new Error('Invalid email or password. Please verify your credentials or Sign Up.');
      }
    }

    const users = loadUsersDB();
    let existingUser = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!existingUser && !firebaseUid) {
      setLoading(false);
      throw new Error('Invalid email or password. Please verify your credentials or Sign Up.');
    }

    if (!existingUser) {
      existingUser = {
        uid: firebaseUid || `user-${Date.now()}`,
        displayName: cleanEmail.split('@')[0],
        email: cleanEmail,
        password: pass,
        houseId: null,
        role: null,
        createdAt: new Date().toISOString(),
      };
      saveUsersDB([...users, existingUser]);
    } else if (pass) {
      existingUser.password = pass;
      saveUsersDB(users);
    }

    setActiveSession(existingUser);
    setDbUserProfile(existingUser);
    syncHouseForUser(existingUser);
    syncSaveUser(existingUser);
    setLoading(false);
  };

  // Open Sign Up Handler
  const signUpWithEmail = async (email: string, pass: string, displayName: string) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLoading(false);
      throw new Error('Please provide a valid email address.');
    }
    if (!pass || pass.length < 6) {
      setLoading(false);
      throw new Error('Password must be at least 6 characters long.');
    }

    const users = loadUsersDB();
    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (existing) {
      setLoading(false);
      throw new Error('Email is already registered. Please log in.');
    }

    let firebaseUid: string | null = null;

    if (auth) {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        firebaseUid = userCred.user.uid;
      } catch (fbErr: any) {
        if (fbErr.code === 'auth/email-already-in-use') {
          setLoading(false);
          throw new Error('Email is already registered. Please log in.');
        } else {
          console.warn('Firebase signup notice:', fbErr);
        }
      }
    }

    const newUser: UserProfile = {
      uid: firebaseUid || `user-${Date.now()}`,
      displayName: displayName.trim() || cleanEmail.split('@')[0],
      email: cleanEmail,
      password: pass,
      houseId: null,
      role: null,
      createdAt: new Date().toISOString(),
    };

    saveUsersDB([...users, newUser]);
    setActiveSession(newUser);
    setDbUserProfile(newUser);
    syncHouseForUser(newUser);
    syncSaveUser(newUser);
    setLoading(false);
  };

  // Update User Profile Photo Handler
  const updateUserProfilePhoto = async (avatarUrl: string) => {
    if (!dbUserProfile) throw new Error('You must be logged in to update profile photo.');

    const users = loadUsersDB();
    const updatedUsers = users.map((u) => {
      if (u.uid === dbUserProfile.uid) {
        return { ...u, avatar: avatarUrl };
      }
      return u;
    });
    saveUsersDB(updatedUsers);

    const updatedProfile = { ...dbUserProfile, avatar: avatarUrl };
    setActiveSession(updatedProfile);
    setDbUserProfile(updatedProfile);
    syncSaveUser(updatedProfile);

    if (auth?.currentUser) {
      try {
        await updateProfile(auth.currentUser, { photoURL: avatarUrl });
      } catch (e) {
        console.warn('Firebase profile photo update notice:', e);
      }
    }
  };

  // Change User Password Handler
  const changeUserPassword = async (currentPass: string, newPass: string) => {
    if (!dbUserProfile) throw new Error('You must be logged in to change password.');
    if (!newPass || newPass.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const users = loadUsersDB();
    const targetUser = users.find((u) => u.uid === dbUserProfile.uid);

    if (targetUser?.password && targetUser.password !== currentPass) {
      throw new Error('Current password is incorrect.');
    }

    if (auth?.currentUser && auth.currentUser.email) {
      try {
        const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPass);
        await reauthenticateWithCredential(auth.currentUser, cred);
        await updatePassword(auth.currentUser, newPass);
      } catch (fbErr: any) {
        if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
          throw new Error('Current password is incorrect.');
        }
        console.warn('Firebase reauth notice:', fbErr);
      }
    }

    // Save updated password in local DB
    const updatedUsers = users.map((u) => {
      if (u.uid === dbUserProfile.uid) {
        return { ...u, password: newPass };
      }
      return u;
    });
    saveUsersDB(updatedUsers);

    const updatedProfile = { ...dbUserProfile, password: newPass };
    setActiveSession(updatedProfile);
    setDbUserProfile(updatedProfile);
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
  const createHouse = async (houseName: string, customHouseCode?: string) => {
    if (!dbUserProfile) throw new Error('You must be logged in to create a house');
    const name = houseName.trim();
    if (!name) throw new Error('House name cannot be empty');

    let cleanCode = (customHouseCode || '').trim().toUpperCase();
    if (!cleanCode) {
      cleanCode = `HM-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const houses = loadHousesDB();
    const existingCodeMatch = houses.find((h) => h.code.toUpperCase() === cleanCode);
    if (existingCodeMatch) {
      throw new Error(`Warning: House code '${cleanCode}' is already taken. Please choose a different unique code.`);
    }

    if (isFirebaseConfigured && db) {
      try {
        const q = query(collection(db, 'houses'), where('code', '==', cleanCode));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          throw new Error(`Warning: House code '${cleanCode}' is already taken. Please choose a different unique code.`);
        }
      } catch (err: any) {
        if (err.message && err.message.includes('already taken')) throw err;
      }
    }

    const houseId = `house-${Date.now()}`;
    const now = new Date().toISOString();

    const leaderMember: HouseMember = {
      uid: dbUserProfile.uid,
      displayName: dbUserProfile.displayName,
      email: dbUserProfile.email,
      avatar: dbUserProfile.avatar,
      role: 'leader',
      joinedAt: now,
    };

    const newHouse: House = {
      id: houseId,
      code: cleanCode,
      name,
      leaderUid: dbUserProfile.uid,
      members: [leaderMember],
      createdAt: now,
    };

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
    await syncSaveHouse(newHouse);
    await syncSaveUser(updatedProfile);
  };

  // Join House Handler (Supports Local & Firestore Cross-Device Queries)
  const joinHouse = async (houseCode: string) => {
    if (!dbUserProfile) throw new Error('You must be logged in to join a house');
    const cleanCode = houseCode.trim().toUpperCase();
    if (!cleanCode) throw new Error('Please enter a house code');

    const houses = loadHousesDB();
    let house = houses.find((h) => h.code.toUpperCase() === cleanCode);

    // Cross-Device Fallback: If not found in local browser storage, query Firestore!
    if (!house && isFirebaseConfigured && db) {
      try {
        const q = query(collection(db, 'houses'), where('code', '==', cleanCode));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          house = snapshot.docs[0].data() as House;
        }
      } catch (err) {
        console.warn('Firestore joinHouse query fallback notice:', err);
      }
    }

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
        avatar: dbUserProfile.avatar,
        role: 'member',
        joinedAt: now,
      };

      house.members.push(newMember);

      // Save/update house in local DB
      const existingIdx = houses.findIndex((h) => h.id === house!.id);
      if (existingIdx >= 0) {
        houses[existingIdx] = house;
        saveHousesDB(houses);
      } else {
        saveHousesDB([...houses, house]);
      }
    }

    const users = loadUsersDB();
    const updatedUsers = users.map((u) => {
      if (u.uid === dbUserProfile.uid) {
        return { ...u, houseId: house!.id, role: 'member' as const };
      }
      return u;
    });
    saveUsersDB(updatedUsers);

    const updatedProfile = { ...dbUserProfile, houseId: house.id, role: 'member' as const };
    setActiveSession(updatedProfile);
    setDbUserProfile(updatedProfile);
    setCurrentHouse({ ...house });
    await syncSaveHouse(house);
    await syncSaveUser(updatedProfile);
  };

  // Update House Name Handler (Leader Power)
  const updateHouseName = async (newName: string) => {
    if (!currentHouse) throw new Error('No active house found');
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('House name cannot be empty');

    const updatedHouse = { ...currentHouse, name: trimmed };
    const houses = loadHousesDB();
    const updatedHouses = houses.map((h) => (h.id === currentHouse.id ? updatedHouse : h));
    saveHousesDB(updatedHouses);
    setCurrentHouse(updatedHouse);
    syncSaveHouse(updatedHouse);
  };

  // Kick Member Handler (Leader Power)
  const kickMember = async (targetUid: string) => {
    if (!currentHouse) throw new Error('No active house found');
    if (currentHouse.leaderUid === targetUid) throw new Error('House leader cannot be kicked from house');

    const updatedMembers = currentHouse.members.filter((m) => m.uid !== targetUid);
    const updatedHouse = { ...currentHouse, members: updatedMembers };

    const houses = loadHousesDB();
    const updatedHouses = houses.map((h) => (h.id === currentHouse.id ? updatedHouse : h));
    saveHousesDB(updatedHouses);
    setCurrentHouse(updatedHouse);
    syncSaveHouse(updatedHouse);

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
    if (currentHouse.leaderUid === dbUserProfile.uid) {
      throw new Error('House Leaders cannot leave house. Delete or transfer ownership first.');
    }

    const updatedMembers = currentHouse.members.filter((m) => m.uid !== dbUserProfile.uid);
    const updatedHouse = { ...currentHouse, members: updatedMembers };

    const houses = loadHousesDB();
    const updatedHouses = houses.map((h) => (h.id === currentHouse.id ? updatedHouse : h));
    saveHousesDB(updatedHouses);

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
    syncSaveHouse(updatedHouse);
    syncSaveUser(updatedProfile);
  };

  const userProfile: User = {
    id: activeUserId,
    name: dbUserProfile?.displayName || USERS[activeUserId]?.name || 'User',
    avatar: dbUserProfile?.avatar || USERS[activeUserId]?.avatar || activeUserId,
    color: USERS[activeUserId]?.color || '#3b82f6',
  };

  return (
    <AuthContext.Provider
      value={{
        activeUserId,
        userProfile,
        dbUserProfile,
        currentHouse,
        firebaseUser: firebaseUser || auth?.currentUser || null,
        isAuthenticated: Boolean(dbUserProfile),
        loading,
        switchProfile,
        loginWithEmail,
        signUpWithEmail,
        updateUserProfilePhoto,
        changeUserPassword,
        logout,
        createHouse,
        joinHouse,
        updateHouseName,
        kickMember,
        leaveHouse,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
