import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserId, UserProfile, House, HouseMember } from '../types';
import { USERS } from '../utils/settlementEngine';
import { auth, db } from '../config/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, updateDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

interface AuthContextType {
  activeUserId: UserId;
  userProfile: User;
  dbUserProfile: UserProfile | null;
  currentHouse: House | null;
  firebaseUser: FirebaseUser | null;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUserId, setActiveUserId] = useState<UserId>(() => {
    const saved = localStorage.getItem(ACTIVE_USER_STORAGE_KEY) as UserId;
    return saved && USERS[saved] ? saved : 'raiyan';
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [dbUserProfile, setDbUserProfile] = useState<UserProfile | null>(null);
  const [currentHouse, setCurrentHouse] = useState<House | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return () => {};
    }
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setDbUserProfile(null);
        setCurrentHouse(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Realtime listener for User Profile in Firestore
  useEffect(() => {
    if (!db || !firebaseUser) return;

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsub = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const profileData = docSnap.data() as UserProfile;
          setDbUserProfile(profileData);
        } else {
          // If no doc exists yet, create default
          const now = new Date().toISOString();
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            avatar: firebaseUser.photoURL || undefined,
            houseId: null,
            role: null,
            createdAt: now,
          };
          setDoc(userDocRef, newProfile).catch((err) => console.warn('Error creating user profile:', err));
          setDbUserProfile(newProfile);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('User Profile Firestore listener warning:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firebaseUser]);

  // 3. Realtime listener for Active House in Firestore
  useEffect(() => {
    if (!db || !dbUserProfile?.houseId) {
      setCurrentHouse(null);
      return;
    }

    const houseDocRef = doc(db, 'houses', dbUserProfile.houseId);
    const unsub = onSnapshot(
      houseDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setCurrentHouse(docSnap.data() as House);
        } else {
          // If house was deleted, clear user's houseId
          setCurrentHouse(null);
        }
      },
      (err) => console.warn('House Firestore listener warning:', err)
    );

    return () => unsub();
  }, [dbUserProfile?.houseId]);

  const switchProfile = (userId: UserId) => {
    if (USERS[userId]) {
      setActiveUserId(userId);
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    setFirebaseUser(cred.user);
  };

  const signUpWithEmail = async (email: string, pass: string, displayName: string) => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName });

    const now = new Date().toISOString();
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      displayName: displayName.trim(),
      email: email.trim(),
      houseId: null,
      role: null,
      createdAt: now,
    };

    if (db) {
      await setDoc(doc(db, 'users', cred.user.uid), newProfile);
    }

    setFirebaseUser(cred.user);
    setDbUserProfile(newProfile);
  };

  const loginOrSignUpDemoAccount = async (email: string, pass: string, displayName: string, housemateId: UserId) => {
    switchProfile(housemateId);
    if (!auth) return;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      try {
        await signUpWithEmail(email, pass, displayName);
      } catch (signUpErr) {
        console.warn('Demo account sign up fallback error:', signUpErr);
      }
    }
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
    setFirebaseUser(null);
    setDbUserProfile(null);
    setCurrentHouse(null);
  };

  // Create House Handler
  const createHouse = async (houseName: string) => {
    if (!firebaseUser) throw new Error('You must be logged in to create a house');
    const name = houseName.trim();
    if (!name) throw new Error('House name cannot be empty');

    // Generate unique 6-character code e.g. "HM-8823"
    const randomCode = `HM-${Math.floor(1000 + Math.random() * 9000)}`;
    const houseId = `house-${Date.now()}`;
    const now = new Date().toISOString();

    const leaderMember: HouseMember = {
      uid: firebaseUser.uid,
      displayName: dbUserProfile?.displayName || firebaseUser.displayName || 'Leader',
      email: firebaseUser.email || '',
      avatar: dbUserProfile?.avatar,
      role: 'leader',
      joinedAt: now,
    };

    const newHouse: House = {
      id: houseId,
      code: randomCode,
      name,
      leaderUid: firebaseUser.uid,
      members: [leaderMember],
      createdAt: now,
    };

    if (db) {
      await setDoc(doc(db, 'houses', houseId), newHouse);
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        houseId,
        role: 'leader',
      });
    }

    setCurrentHouse(newHouse);
    setDbUserProfile((prev) => (prev ? { ...prev, houseId, role: 'leader' } : null));
  };

  // Join House Handler
  const joinHouse = async (houseCode: string) => {
    if (!firebaseUser) throw new Error('You must be logged in to join a house');
    const cleanCode = houseCode.trim().toUpperCase();
    if (!cleanCode) throw new Error('Please enter a house code');

    if (!db) throw new Error('Database connection not available');

    const housesQuery = query(collection(db, 'houses'), where('code', '==', cleanCode));
    const snapshot = await getDocs(housesQuery);

    if (snapshot.empty) {
      throw new Error(`No house found with code "${cleanCode}". Please check and try again.`);
    }

    const houseDoc = snapshot.docs[0];
    const houseData = houseDoc.data() as House;

    // Check if user is already a member
    const isAlreadyMember = houseData.members.some((m) => m.uid === firebaseUser.uid);
    if (!isAlreadyMember) {
      const now = new Date().toISOString();
      const newMember: HouseMember = {
        uid: firebaseUser.uid,
        displayName: dbUserProfile?.displayName || firebaseUser.displayName || 'Member',
        email: firebaseUser.email || '',
        avatar: dbUserProfile?.avatar,
        role: 'member',
        joinedAt: now,
      };

      const updatedMembers = [...houseData.members, newMember];

      await updateDoc(doc(db, 'houses', houseData.id), {
        members: updatedMembers,
      });

      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        houseId: houseData.id,
        role: 'member',
      });
    } else {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        houseId: houseData.id,
        role: 'member',
      });
    }
  };

  // Kick Member Handler (Leader Only)
  const kickMember = async (targetUid: string) => {
    if (!firebaseUser || !currentHouse) return;
    if (currentHouse.leaderUid !== firebaseUser.uid) {
      throw new Error('Only the House Leader can kick members');
    }

    if (!db) return;

    // Remove member from house members list
    const updatedMembers = currentHouse.members.filter((m) => m.uid !== targetUid);
    await updateDoc(doc(db, 'houses', currentHouse.id), {
      members: updatedMembers,
    });

    // Clear target user's houseId and role
    await updateDoc(doc(db, 'users', targetUid), {
      houseId: null,
      role: null,
    });
  };

  // Leave House Handler (Member Only)
  const leaveHouse = async () => {
    if (!firebaseUser || !currentHouse) return;
    if (currentHouse.leaderUid === firebaseUser.uid) {
      throw new Error('House Leader cannot leave the house. You can delete or transfer ownership.');
    }

    if (!db) return;

    // Remove active user from house members list
    const updatedMembers = currentHouse.members.filter((m) => m.uid !== firebaseUser.uid);
    await updateDoc(doc(db, 'houses', currentHouse.id), {
      members: updatedMembers,
    });

    // Clear active user's houseId and role
    await updateDoc(doc(db, 'users', firebaseUser.uid), {
      houseId: null,
      role: null,
    });
  };

  const userProfile = USERS[activeUserId] || USERS.raiyan;

  return (
    <AuthContext.Provider
      value={{
        activeUserId,
        userProfile,
        dbUserProfile,
        currentHouse,
        firebaseUser,
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
