import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserId, UserProfile, House, HouseMember, Expense, Settlement } from '../types';
import { USERS, calculateNetBalances, getHouseUsers } from '../features/settlementEngine';
import { loadExpenses, loadSettlements } from '../services/storage';
import {
  loadUsersDB,
  saveUsersDB,
  loadHousesDB,
  saveHousesDB,
  getActiveSession,
  setActiveSession,
} from '../services/mockAuthDatabase';
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { syncSaveUser, syncSaveHouse, subscribeHouse } from '../services/firebaseSync';
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
  leaveHouse: (expenses?: Expense[], settlements?: Settlement[]) => Promise<void>;
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

  // Connect Firebase Auth Listener & Realtime Profile Sync from Firestore
  useEffect(() => {
    if (!auth) return;
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (user && isFirebaseConfigured && db) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          unsubUserDoc = onSnapshot(
            userDocRef,
            (snap) => {
              if (snap.exists()) {
                const fbProfile = snap.data() as UserProfile;
                setDbUserProfile((prev) => ({ ...prev, ...fbProfile }));
                setActiveSession(fbProfile);
                syncHouseForUser(fbProfile);
              }
            },
            (err) => console.warn('Firestore User Profile Sync Warning:', err)
          );
        } catch (e) {
          console.warn('Firestore auth listener sync notice:', e);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  // Helper: Refresh house object from DB based on user profile (with Firestore cloud sync & auto-healing fallback)
  const syncHouseForUser = async (profile: UserProfile | null) => {
    if (!profile) {
      setCurrentHouse(null);
      return;
    }

    let targetHouseId = profile.houseId;

    // Auto-Healing Fallback 1: Check local storage for any house where user is listed as member
    if (!targetHouseId) {
      const houses = loadHousesDB();
      const matchedLocal = houses.find((h) => h.members && h.members.some((m) => m.uid === profile.uid));
      if (matchedLocal) {
        targetHouseId = matchedLocal.id;
        const healedProfile = { ...profile, houseId: targetHouseId };
        setDbUserProfile(healedProfile);
        setActiveSession(healedProfile);
        syncSaveUser(healedProfile);
      }
    }

    // Auto-Healing Fallback 2: Check Firestore `houses` collection for any house where user is listed as member
    if (!targetHouseId && isFirebaseConfigured && db) {
      try {
        const housesCol = collection(db, 'houses');
        const snap = await getDocs(housesCol);
        if (!snap.empty) {
          snap.forEach((docSnap) => {
            const h = docSnap.data() as House;
            if (h.members && h.members.some((m) => m.uid === profile.uid)) {
              targetHouseId = h.id;
              const healedProfile = { ...profile, houseId: targetHouseId };
              setDbUserProfile(healedProfile);
              setActiveSession(healedProfile);
              syncSaveUser(healedProfile);
            }
          });
        }
      } catch (err) {
        console.warn('Firestore syncHouseForUser search notice:', err);
      }
    }

    if (!targetHouseId) {
      setCurrentHouse(null);
      return;
    }

    const houses = loadHousesDB();
    const house = houses.find((h) => h.id === targetHouseId) || null;
    if (house) {
      setCurrentHouse({ ...house });
    }

    if (isFirebaseConfigured && db && targetHouseId) {
      try {
        const docRef = doc(db, 'houses', targetHouseId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const firestoreHouse = snap.data() as House;
          // Verify user is still an active member in this house
          const isStillMember = firestoreHouse.members && firestoreHouse.members.some((m) => m.uid === profile.uid);
          if (isStillMember) {
            setCurrentHouse({ ...firestoreHouse });
            const idx = houses.findIndex((h) => h.id === firestoreHouse.id);
            if (idx >= 0) houses[idx] = firestoreHouse;
            else houses.push(firestoreHouse);
            saveHousesDB(houses);
          } else {
            // User was removed / kicked from house
            setCurrentHouse(null);
            const purgedProfile = { ...profile, houseId: null, role: null };
            setDbUserProfile(purgedProfile);
            setActiveSession(purgedProfile);
            syncSaveUser(purgedProfile);
          }
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
    const targetHouseId = dbUserProfile?.houseId || currentHouse?.id;
    if (!targetHouseId) return;

    const unsub = subscribeHouse(targetHouseId, (updatedHouse) => {
      if (updatedHouse) {
        const myUid = dbUserProfile?.uid || activeUserId;
        const amIMember = updatedHouse.members && updatedHouse.members.some((m) => m.uid === myUid);

        if (!amIMember) {
          // User was kicked/removed in real-time by house leader
          setCurrentHouse(null);
          setDbUserProfile((prev) => {
            const purged = prev ? { ...prev, houseId: null, role: null } : null;
            if (purged) setActiveSession(purged);
            return purged;
          });
          return;
        }

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
  }, [dbUserProfile?.houseId, currentHouse?.id, activeUserId]);

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

    // Also update house member roster avatar across local storage & Cloud Firestore
    if (currentHouse && currentHouse.members) {
      const updatedMembers = currentHouse.members.map((m) => {
        if (m.uid === dbUserProfile.uid) {
          return { ...m, avatar: avatarUrl };
        }
        return m;
      });
      const updatedHouse = { ...currentHouse, members: updatedMembers };
      const houses = loadHousesDB();
      const updatedHouses = houses.map((h) => (h.id === currentHouse.id ? updatedHouse : h));
      saveHousesDB(updatedHouses);
      setCurrentHouse(updatedHouse);
      syncSaveHouse(updatedHouse);
    }

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

  // Leave House Handler (Enforces 0 settlement balance rule)
  const leaveHouse = async (passedExpenses?: Expense[], passedSettlements?: Settlement[]) => {
    if (!dbUserProfile || !currentHouse) return;
    if (currentHouse.leaderUid === dbUserProfile.uid) {
      throw new Error('House Leaders cannot leave house. Delete or transfer ownership first.');
    }

    const myUid = dbUserProfile.uid || activeUserId;

    // Load active expenses & settlements for currentHouse
    let houseExpenses: Expense[] = passedExpenses || [];
    let houseSettlements: Settlement[] = passedSettlements || [];

    if (!passedExpenses || passedExpenses.length === 0) {
      const localExp = loadExpenses();
      houseExpenses = localExp.filter((e) => !e.houseId || e.houseId === currentHouse.id);
    }
    if (!passedSettlements || passedSettlements.length === 0) {
      const localSt = loadSettlements();
      houseSettlements = localSt.filter((s) => !(s as any).houseId || (s as any).houseId === currentHouse.id);
    }

    // Also fetch latest Firestore expenses & settlements if Firestore is connected
    if (isFirebaseConfigured && db) {
      try {
        const expSnap = await getDocs(query(collection(db, 'expenses'), where('houseId', '==', currentHouse.id)));
        if (!expSnap.empty) {
          const fsExpenses: Expense[] = [];
          expSnap.forEach((docSnap) => fsExpenses.push(docSnap.data() as Expense));
          houseExpenses = fsExpenses;
        }

        const stSnap = await getDocs(query(collection(db, 'settlements'), where('houseId', '==', currentHouse.id)));
        if (!stSnap.empty) {
          const fsSettlements: Settlement[] = [];
          stSnap.forEach((docSnap) => fsSettlements.push(docSnap.data() as Settlement));
          houseSettlements = fsSettlements;
        }
      } catch (err) {
        console.warn('Firestore leaveHouse settlement balance check fallback notice:', err);
      }
    }

    // Compute net balances for active users in currentHouse
    const houseUsers = getHouseUsers(currentHouse, dbUserProfile);
    const netBalancesMap = calculateNetBalances(houseExpenses, houseSettlements, houseUsers);

    const myBalanceKey = Object.keys(netBalancesMap).find((k) => {
      const u = netBalancesMap[k].user;
      return k === myUid || (u && (u.uid === myUid || u.id === myUid));
    });

    const myNetBalanceCents = myBalanceKey ? netBalancesMap[myBalanceKey].netBalanceCents : 0;

    // Enforce business rule: Block leaving if user has non-zero net balance
    if (Math.abs(myNetBalanceCents) > 0) {
      const formattedAmount = (Math.abs(myNetBalanceCents) / 100).toFixed(2);
      if (myNetBalanceCents > 0) {
        throw new Error(
          `You cannot leave the household while you are owed ৳${formattedAmount}. Please settle all balances before leaving.`
        );
      } else {
        throw new Error(
          `You cannot leave the household while you owe ৳${formattedAmount}. Please pay your pending settlements before leaving.`
        );
      }
    }

    // If balance is zero and no pending settlements exist, process leaving
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
    await syncSaveHouse(updatedHouse);
    await syncSaveUser(updatedProfile);
  };

  const userProfile: User = {
    id: dbUserProfile?.uid || activeUserId,
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
