/* oxlint-disable react/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { User, UserId, UserProfile, House, HouseMember, Expense, Settlement, PersonalWalletSettings } from '../types';
import { USERS, calculateNetBalances, getCanonicalHouseMembers, getHouseUsers } from '../features/settlementEngine';
import { loadExpenses, loadSettlements, houseStorageScope } from '../services/storage';
import {
  loadUsersDB,
  saveUsersDB,
  cacheUserProfile,
  loadHousesDB,
  saveHousesDB,
  getActiveSession,
  setActiveSession,
  saveLocalCredential,
  verifyLocalCredential,
} from '../services/mockAuthDatabase';
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import {
  syncSaveUser,
  syncSaveUserAvatar,
  syncSaveUserWalletSettings,
  syncSaveHouse,
  subscribeHouse,
  hasPendingLedgerMutations,
  sanitizeForFirestore,
  getPendingProfileOverlay,
} from '../services/firebaseSync';
import { createProfileFromIdentity, normalizeCloudProfile } from '../features/profileReconciliation';
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
import { createId } from '../utils/ids';

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
  updateUserProfilePhoto: (avatarUrl: string | null) => Promise<void>;
  updatePersonalWalletSettings: (settings: Partial<PersonalWalletSettings>) => Promise<void>;
  changeUserPassword: (currentPass: string, newPass: string) => Promise<void>;
  logout: () => Promise<void>;
  createHouse: (houseName: string, customHouseCode?: string) => Promise<void>;
  joinHouse: (houseCode: string) => Promise<void>;
  updateHouseName: (newName: string) => Promise<void>;
  kickMember: (targetUid: string) => Promise<void>;
  transferLeadership: (targetUid: string) => Promise<void>;
  leaveHouse: (expenses?: Expense[], settlements?: Settlement[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_USER_STORAGE_KEY = 'home_finance_active_user_v1';

const applyProfileAvatarToHouse = (house: House, uid: string, avatarUrl: string | null): House | null => {
  // Keep the persisted members order stable. The callable comment path and
  // roster rules treat order as part of the denormalized document shape.
  const sourceMembers = Array.isArray(house.members) && house.members.length > 0
    ? house.members
    : getCanonicalHouseMembers(house);
  if (!sourceMembers.some((member) => member.uid === uid)) return null;
  const members = sourceMembers.map((member) => {
    if (member.uid !== uid) return member;
    const { avatar: _memberAvatar, ...memberWithoutAvatar } = member;
    return avatarUrl ? { ...memberWithoutAvatar, avatar: avatarUrl } : memberWithoutAvatar;
  });
  return {
    ...house,
    members,
    memberUids: house.memberUids?.length ? house.memberUids : members.map((member) => member.uid),
    memberMap: Object.fromEntries(members.map((member) => [member.uid, member])),
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUserId, setActiveUserId] = useState<UserId>(() => {
    const saved = localStorage.getItem(ACTIVE_USER_STORAGE_KEY) as UserId;
    return saved && USERS[saved] ? saved : 'raiyan';
  });

  const [dbUserProfile, setDbUserProfile] = useState<UserProfile | null>(() => getActiveSession());
  const [currentHouse, setCurrentHouse] = useState<House | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const sessionVersionRef = useRef(0);
  const houseRefreshVersionRef = useRef(0);
  const houseSnapshotVersionRef = useRef(0);
  const dbUserProfileRef = useRef(dbUserProfile);
  dbUserProfileRef.current = dbUserProfile;

  const isSessionCurrent = (version: number, uid: string): boolean => (
    mountedRef.current
    && sessionVersionRef.current === version
    && (!auth?.currentUser || auth.currentUser.uid === uid)
  );

  const cacheHouse = (house: House): void => {
    const houses = loadHousesDB();
    const index = houses.findIndex((candidate) => candidate.id === house.id);
    if (index >= 0) houses[index] = house;
    else houses.push(house);
    saveHousesDB(houses);
  };

  // A member's profile document is private. Mirror its avatar into the shared
  // roster whenever that member signs in, so photos uploaded before the roster
  // finished loading are also repaired for every other household member.
  const reconcileProfileAvatarInHouse = async (
    profile: UserProfile,
    houseId = profile.houseId
  ): Promise<House | null> => {
    if (!isFirebaseConfigured || !db || !houseId) return null;
    let reconciledHouse: House | null = null;
    await runTransaction(db, async (transaction) => {
      const houseRef = doc(db!, 'houses', houseId);
      const snapshot = await transaction.get(houseRef);
      if (!snapshot.exists()) return;
      const latest = snapshot.data() as House;
      const member = getCanonicalHouseMembers(latest).find((candidate) => candidate.uid === profile.uid);
      if (!member || (member.avatar || null) === (profile.avatar || null)) return;
      reconciledHouse = applyProfileAvatarToHouse(latest, profile.uid, profile.avatar || null);
      if (!reconciledHouse) return;
      transaction.update(houseRef, sanitizeForFirestore({
        members: reconciledHouse.members,
        memberMap: reconciledHouse.memberMap,
      }));
    });
    return reconciledHouse;
  };

  const recoverRosterMembership = async (
    profile: UserProfile,
    hintedHouseId?: string | null
  ): Promise<UserProfile> => {
    if (!db || profile.houseId) return profile;

    try {
      let matchedHouse: House | null = null;
      if (hintedHouseId) {
        const hintedSnapshot = await getDoc(doc(db, 'houses', hintedHouseId));
        if (hintedSnapshot.exists()) {
          const hintedHouse = hintedSnapshot.data() as House;
          if (hintedHouse.members?.some((member) => member.uid === profile.uid)) matchedHouse = hintedHouse;
        }
      }

      if (!matchedHouse) {
        const membershipSnapshot = await getDocs(query(
          collection(db, 'houses'),
          where('memberUids', 'array-contains', profile.uid)
        ));
        const matches = membershipSnapshot.docs
          .map((snapshot) => snapshot.data() as House)
          .filter((house) => house.members?.some((member) => member.uid === profile.uid))
          .sort((a, b) => a.id.localeCompare(b.id));
        matchedHouse = matches[0] ?? null;
        if (matches.length > 1) {
          console.warn(`Multiple household memberships found for ${profile.uid}; using ${matchedHouse?.id}.`);
        }
      }

      if (!matchedHouse) return profile;
      cacheHouse(matchedHouse);
      return {
        ...profile,
        houseId: matchedHouse.id,
        role: matchedHouse.leaderUid === profile.uid ? 'leader' : 'member',
      };
    } catch (error) {
      // Recovery is best-effort. A rules/network failure must never erase a
      // membership that may still be valid in Firebase.
      console.warn('Household membership recovery will retry later.', error);
      return profile;
    }
  };

  const resolveFirebaseProfile = async (
    user: FirebaseUser,
    suppliedCloudProfile?: Partial<UserProfile> | null,
    sessionVersion = sessionVersionRef.current,
  ): Promise<UserProfile | null> => {
    const cached = loadUsersDB().find((candidate) => candidate.uid === user.uid);
    let cloudProfile = suppliedCloudProfile;
    let cloudDocumentExists = suppliedCloudProfile !== null;

    if (suppliedCloudProfile === undefined && db) {
      try {
        const snapshot = await getDoc(doc(db, 'users', user.uid));
        cloudDocumentExists = snapshot.exists();
        cloudProfile = snapshot.exists() ? snapshot.data() as Partial<UserProfile> : null;
      } catch (error) {
        console.warn('Cloud profile could not be refreshed; keeping the verified local cache.', error);
        const offlineProfile = cached ?? createProfileFromIdentity({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          creationTime: user.metadata.creationTime,
        });
        if (!isSessionCurrent(sessionVersion, user.uid)) return null;
        cacheUserProfile(offlineProfile);
        setActiveSession(offlineProfile);
        setDbUserProfile(offlineProfile);
        return offlineProfile;
      }
    }

    const identity = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      creationTime: user.metadata.creationTime,
    };
    const baseProfile = cloudDocumentExists && cloudProfile
      ? normalizeCloudProfile(identity, cloudProfile)
      : {
          ...createProfileFromIdentity(identity),
          ...(cached?.displayName ? { displayName: cached.displayName } : {}),
          ...(cached?.avatar ? { avatar: cached.avatar } : {}),
          ...(cached?.walletSettings ? { walletSettings: cached.walletSettings } : {}),
          ...(cached?.createdAt ? { createdAt: cached.createdAt } : {}),
        };
    const resolvedBaseProfile = await recoverRosterMembership(baseProfile, cached?.houseId);
    // Identity, avatar, and wallet mutations are independent optimistic fields.
    // A profile snapshot may be older than one of those writes, so overlay only
    // those pending fields. Membership remains cloud/roster canonical.
    const resolvedProfile = getPendingProfileOverlay(user.uid, resolvedBaseProfile);
    if (!isSessionCurrent(sessionVersion, user.uid)) return null;
    cacheUserProfile(resolvedProfile);
    setActiveSession(resolvedProfile);
    setDbUserProfile(resolvedProfile);

    const membershipRecovered = resolvedProfile.houseId !== baseProfile.houseId;
    if (!cloudDocumentExists || membershipRecovered) await syncSaveUser(resolvedProfile);
    return resolvedProfile;
  };

  // Connect Firebase Auth Listener & Realtime Profile Sync from Firestore
  useEffect(() => {
    mountedRef.current = true;
    if (!auth) {
      setLoading(false);
      return;
    }
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      const sessionVersion = ++sessionVersionRef.current;
      houseRefreshVersionRef.current += 1;
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
              void resolveFirebaseProfile(user, snap.exists() ? snap.data() as Partial<UserProfile> : null, sessionVersion)
                .then((profile) => profile ? syncHouseForUser(profile, sessionVersion) : undefined)
                .then(() => { if (isSessionCurrent(sessionVersion, user.uid)) setLoading(false); })
                .catch((error) => {
                  if (isSessionCurrent(sessionVersion, user.uid)) {
                    console.warn('Firestore profile reconciliation notice:', error);
                    setLoading(false);
                  }
                });
            },
            (err) => {
              console.warn('Firestore User Profile Sync Warning:', err);
              setLoading(false);
            }
          );
        } catch (e) {
          console.warn('Firestore auth listener sync notice:', e);
          setLoading(false);
        }
      } else {
        setActiveSession(null);
        setDbUserProfile(null);
        setCurrentHouse(null);
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      sessionVersionRef.current += 1;
      houseRefreshVersionRef.current += 1;
      houseSnapshotVersionRef.current += 1;
      unsubscribeAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  // Helper: Refresh house object from DB based on user profile (with Firestore cloud sync & auto-healing fallback)
  const syncHouseForUser = async (profile: UserProfile | null, sessionVersion = sessionVersionRef.current) => {
    const refreshVersion = ++houseRefreshVersionRef.current;
    if (!profile) {
      if (mountedRef.current) setCurrentHouse(null);
      return;
    }

    let targetHouseId = profile.houseId;

    // Offline-only recovery may use the local roster. Cloud auth always treats the
    // canonical profile document as the source of membership truth.
    if (!targetHouseId && !isFirebaseConfigured) {
      const houses = loadHousesDB();
      const matchedLocal = houses.find((h) => h.members && h.members.some((m) => m.uid === profile.uid));
      if (matchedLocal) {
        targetHouseId = matchedLocal.id;
        const healedProfile = { ...profile, houseId: targetHouseId };
        if (!isSessionCurrent(sessionVersion, profile.uid) || refreshVersion !== houseRefreshVersionRef.current) return;
        setDbUserProfile(healedProfile);
        setActiveSession(healedProfile);
        await syncSaveUser(healedProfile);
      }
    }

    if (!targetHouseId) {
      if (isSessionCurrent(sessionVersion, profile.uid) && refreshVersion === houseRefreshVersionRef.current) setCurrentHouse(null);
      return;
    }

    const houses = loadHousesDB();
    const house = houses.find((h) => h.id === targetHouseId) || null;
    if (house) {
      if (isSessionCurrent(sessionVersion, profile.uid) && refreshVersion === houseRefreshVersionRef.current) setCurrentHouse({ ...house });
    }

    if (isFirebaseConfigured && db && targetHouseId) {
      try {
        const docRef = doc(db, 'houses', targetHouseId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const firestoreHouse = snap.data() as House;
          // Verify user is still an active member in this house
          const isStillMember = getCanonicalHouseMembers(firestoreHouse).some((member) => member.uid === profile.uid);
          if (isStillMember) {
            const reconciledHouse = await reconcileProfileAvatarInHouse(profile, targetHouseId);
            const visibleHouse = reconciledHouse || firestoreHouse;
            if (!isSessionCurrent(sessionVersion, profile.uid) || refreshVersion !== houseRefreshVersionRef.current) return;
            setCurrentHouse({ ...visibleHouse });
            cacheHouse(visibleHouse);
            if (
              visibleHouse.leaderUid === profile.uid &&
              (!visibleHouse.memberUids || !visibleHouse.memberMap || visibleHouse.publicJoin === undefined)
            ) {
              await syncSaveHouse(visibleHouse);
            }
          } else {
            // User was removed / kicked from house
            if (!isSessionCurrent(sessionVersion, profile.uid) || refreshVersion !== houseRefreshVersionRef.current) return;
            setCurrentHouse(null);
            const purgedProfile = { ...profile, houseId: null, role: null };
            setDbUserProfile(purgedProfile);
            setActiveSession(purgedProfile);
            cacheUserProfile(purgedProfile);
            await syncSaveUser(purgedProfile);
          }
        } else {
          if (!isSessionCurrent(sessionVersion, profile.uid) || refreshVersion !== houseRefreshVersionRef.current) return;
          setCurrentHouse(null);
          const purgedProfile = { ...profile, houseId: null, role: null };
          setDbUserProfile(purgedProfile);
          setActiveSession(purgedProfile);
          cacheUserProfile(purgedProfile);
          await syncSaveUser(purgedProfile);
        }
      } catch (err) {
        console.warn('Firestore syncHouseForUser notice:', err);
      }
    }
  };

  // Sync House state whenever dbUserProfile reference or values change
  useEffect(() => {
    void syncHouseForUser(dbUserProfileRef.current).catch((error) => console.warn('House reconciliation notice:', error));
  }, [dbUserProfile?.uid, dbUserProfile?.houseId]);

  // Realtime House Roster Listener (Live multi-user roster updates across devices)
  useEffect(() => {
    const targetHouseId = dbUserProfile?.houseId;
    if (!targetHouseId) return;
    const sessionVersion = sessionVersionRef.current;
    const snapshotVersion = ++houseSnapshotVersionRef.current;

    const unsub = subscribeHouse(targetHouseId, (updatedHouse) => {
      if (!isSessionCurrent(sessionVersion, dbUserProfile?.uid || '') || snapshotVersion !== houseSnapshotVersionRef.current) return;
      if (updatedHouse) {
        const myUid = dbUserProfile?.uid || '';
        const amIMember = updatedHouse.members && updatedHouse.members.some((m) => m.uid === myUid);

        if (!amIMember) {
          // User was kicked/removed in real-time by house leader
          setCurrentHouse(null);
          setDbUserProfile((prev) => {
            const purged = prev ? { ...prev, houseId: null, role: null } : null;
            if (purged) {
              setActiveSession(purged);
              cacheUserProfile(purged);
            }
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
      } else {
        setCurrentHouse(null);
        setDbUserProfile((prev) => {
          const purged = prev ? { ...prev, houseId: null, role: null } : null;
          if (purged) {
            setActiveSession(purged);
            cacheUserProfile(purged);
            void syncSaveUser(purged).catch((error) => console.warn('Membership profile cleanup notice:', error));
          }
          return purged;
        });
      }
    }, (error) => {
      // Listener errors are not evidence that the user left the household.
      console.warn('Live household updates are temporarily unavailable.', error);
    });
    return () => unsub();
    }, [dbUserProfile?.houseId, dbUserProfile?.uid]);

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
    if (auth) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        const profile = await resolveFirebaseProfile(userCred.user);
        await syncHouseForUser(profile);
        setLoading(false);
        return;
      } catch (fbErr: any) {
        setLoading(false);
        switch (fbErr?.code) {
          case 'auth/invalid-email':
            throw new Error('Enter a valid email address.');
          case 'auth/network-request-failed':
            throw new Error('Unable to reach the sign-in service. Check your connection and try again.');
          case 'auth/too-many-requests':
            throw new Error('Too many sign-in attempts. Please wait a few minutes before trying again.');
          case 'auth/user-disabled':
            throw new Error('This account has been disabled. Please contact the household administrator.');
          case 'auth/invalid-credential':
          case 'auth/wrong-password':
          case 'auth/user-not-found':
            throw new Error('The email or password is incorrect. Please try again.');
          default:
            throw new Error('Sign-in could not be completed right now. Please try again.');
        }
      }
    }

    const users = loadUsersDB();
    const existingUser = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!auth && existingUser && !(await verifyLocalCredential(cleanEmail, pass))) {
      setLoading(false);
      throw new Error('Invalid email or password. Please verify your credentials or Sign Up.');
    }

    if (!existingUser) {
      setLoading(false);
      throw new Error('Invalid email or password. Please verify your credentials or Sign Up.');
    }

    setActiveSession(existingUser);
    setDbUserProfile(existingUser);
    await syncHouseForUser(existingUser);
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

    // In Firebase mode, this browser cache is not the authority for whether an
    // email can sign up. An Auth account may have been deleted from Firebase
    // while its old local profile remains on this device. We only remove that
    // stale cache entry after Firebase successfully creates the new account.
    if (existing && !auth) {
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
        }
        setLoading(false);
        throw new Error('Unable to create the account securely. Please check your connection and try again.');
      }
    }

    const newUser: UserProfile = {
      uid: firebaseUid || createId('user'),
      displayName: displayName.trim() || cleanEmail.split('@')[0],
      email: cleanEmail,
      houseId: null,
      role: null,
      createdAt: new Date().toISOString(),
    };

    // Reconcile a stale browser profile for this email without touching its old
    // UID's Firestore records, household history, or ledger data. The new Auth
    // user gets its own canonical Firebase UID and can join a household afresh.
    saveUsersDB([
      ...users.filter((user) => user.email.toLowerCase() !== cleanEmail),
      newUser,
    ]);
    if (!auth) await saveLocalCredential(newUser.uid, cleanEmail, pass);
    setActiveSession(newUser);
    setDbUserProfile(newUser);
    await syncHouseForUser(newUser);
    await syncSaveUser(newUser);
    setLoading(false);
  };

  // Update User Profile Photo Handler
  const updateUserProfilePhoto = async (avatarUrl: string | null) => {
    if (!dbUserProfile) throw new Error('You must be logged in to update profile photo.');

    const previousProfile = dbUserProfile;
    const { avatar: _previousAvatar, ...profileWithoutAvatar } = dbUserProfile;
    const updatedProfile = avatarUrl ? { ...profileWithoutAvatar, avatar: avatarUrl } : profileWithoutAvatar;

    cacheUserProfile(updatedProfile);
    setActiveSession(updatedProfile);
    setDbUserProfile(updatedProfile);

    if (isFirebaseConfigured && db) {
      const result = await syncSaveUserAvatar(dbUserProfile.uid, avatarUrl);
      if (result.failed) {
        cacheUserProfile(previousProfile);
        setActiveSession(previousProfile);
        setDbUserProfile(previousProfile);
        throw new Error(result.error?.userMessage || 'Profile photo could not be saved to the live account.');
      }
    }

    // Keep the denormalized household roster in sync as well. The profile
    // document is private to its owner, so other household members can only
    // render this photo from the shared roster. Use the canonical houseId when
    // currentHouse has not finished loading yet (a common cross-device race).
    const targetHouseId = currentHouse?.id || dbUserProfile.houseId || null;
    if (targetHouseId) {
      const cachedHouse = currentHouse || loadHousesDB().find((house) => house.id === targetHouseId) || null;

      // Reflect the change immediately from the local cache while the cloud
      // transaction is committing, including sessions that loaded offline.
      const locallyUpdatedHouse = cachedHouse
        ? applyProfileAvatarToHouse(cachedHouse, dbUserProfile.uid, avatarUrl)
        : null;
      if (locallyUpdatedHouse) {
        const houses = loadHousesDB();
        saveHousesDB(houses.some((house) => house.id === targetHouseId)
          ? houses.map((house) => (house.id === targetHouseId ? locallyUpdatedHouse : house))
          : [...houses, locallyUpdatedHouse]);
        setCurrentHouse(locallyUpdatedHouse);
      }

      if (isFirebaseConfigured && db) {
        try {
          const cloudUpdatedHouse = await reconcileProfileAvatarInHouse(updatedProfile, targetHouseId);

          if (cloudUpdatedHouse) {
            cacheHouse(cloudUpdatedHouse);
            setCurrentHouse(cloudUpdatedHouse);
          }
        } catch (error) {
          // Do not make profile-photo changes look stuck if a roster write is
          // temporarily unavailable. The user profile is already saved and
          // the realtime listener will reconcile the shared roster on retry.
          console.warn('The profile photo saved, but the house roster preview will retry later.', error);
        }
      } else if (locallyUpdatedHouse) {
        await syncSaveHouse(locallyUpdatedHouse);
      }
    }

    if (auth?.currentUser) {
      // Compact data URLs live in Firestore. Firebase Auth is only used for
      // legacy HTTPS photos and must be cleared on removal to avoid resurrection.
      if (!avatarUrl || avatarUrl.startsWith('http')) {
        await updateProfile(auth.currentUser, { photoURL: avatarUrl }).catch((error) => {
          console.warn('Firebase Auth profile photo mirror notice:', error);
        });
      }
    }
  };

  const updatePersonalWalletSettings = async (settings: Partial<PersonalWalletSettings>) => {
    if (!dbUserProfile) throw new Error('You must be logged in to update wallet settings.');
    const previousProfile = dbUserProfile;
    const updatedProfile: UserProfile = {
      ...dbUserProfile,
      walletSettings: {
        ...dbUserProfile.walletSettings,
        ...settings,
        updatedAt: new Date().toISOString(),
      },
    };

    cacheUserProfile(updatedProfile);
    setActiveSession(updatedProfile);
    setDbUserProfile(updatedProfile);

    if (isFirebaseConfigured && db) {
      const result = await syncSaveUserWalletSettings(dbUserProfile.uid, updatedProfile.walletSettings);
      if (result.failed) {
        cacheUserProfile(previousProfile);
        setActiveSession(previousProfile);
        setDbUserProfile(previousProfile);
        throw new Error(result.error?.userMessage || 'Wallet settings could not be saved to the live account.');
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
    if (auth?.currentUser && auth.currentUser.email) {
      try {
        const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPass);
        await reauthenticateWithCredential(auth.currentUser, cred);
        await updatePassword(auth.currentUser, newPass);
      } catch (fbErr: any) {
        if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
          throw new Error('Current password is incorrect.');
        }
        throw new Error('Unable to update the password securely. Please check your connection and try again.');
      }
    } else {
      const validCurrentPassword = await verifyLocalCredential(dbUserProfile.email, currentPass);
      if (!validCurrentPassword) throw new Error('Current password is incorrect.');
      await saveLocalCredential(dbUserProfile.uid, dbUserProfile.email, newPass);
    }

    saveUsersDB(users);
    setActiveSession(dbUserProfile);
  };

  // Logout Handler
  const logout = async () => {
    sessionVersionRef.current += 1;
    houseRefreshVersionRef.current += 1;
    houseSnapshotVersionRef.current += 1;
    if (auth) {
      try {
        await signOut(auth);
      } catch {
        // Local session cleanup still proceeds if the remote sign-out request fails.
      }
    }
    setActiveSession(null);
    setDbUserProfile(null);
    setCurrentHouse(null);
  };

  // Create House Handler
  const createHouse = async (houseName: string, customHouseCode?: string) => {
    if (!dbUserProfile) throw new Error('You must be logged in to create a house');
    if (dbUserProfile.houseId || currentHouse) throw new Error('Leave your current household before creating another one.');
    const name = houseName.trim();
    if (!name) throw new Error('House name cannot be empty');

    let cleanCode = (customHouseCode || '').trim().toUpperCase();
    if (!cleanCode) {
      cleanCode = `HM-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    if (!/^[A-Z0-9-]{4,10}$/.test(cleanCode)) {
      throw new Error('House code must be 4-10 characters using only letters, numbers, and hyphens.');
    }

    const houses = loadHousesDB();
    const existingCodeMatch = houses.find((h) => h.code.toUpperCase() === cleanCode);
    if (existingCodeMatch) {
      throw new Error(`Warning: House code '${cleanCode}' is already taken. Please choose a different unique code.`);
    }

    const houseId = createId('house');
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
      memberUids: [dbUserProfile.uid],
      memberMap: { [dbUserProfile.uid]: leaderMember },
      publicJoin: true,
      ledgerRevision: 0,
      createdAt: now,
    };

    const updatedProfile = { ...dbUserProfile, houseId, role: 'leader' as const };

    if (isFirebaseConfigured && db) {
      await runTransaction(db, async (transaction) => {
        const codeRef = doc(db!, 'houseCodes', cleanCode);
        const codeSnapshot = await transaction.get(codeRef);
        if (codeSnapshot.exists()) {
          throw new Error(`Warning: House code '${cleanCode}' is already taken. Please choose a different unique code.`);
        }
        transaction.set(doc(db!, 'houses', houseId), sanitizeForFirestore(newHouse));
        transaction.set(codeRef, { houseId, name, leaderUid: dbUserProfile.uid });
        transaction.set(doc(db!, 'users', dbUserProfile.uid), updatedProfile, { merge: true });
      });
    }

    saveHousesDB([...houses, newHouse]);

    const users = loadUsersDB();
    const updatedUsers = users.map((u) => {
      if (u.uid === dbUserProfile.uid) {
        return { ...u, houseId, role: 'leader' as const };
      }
      return u;
    });
    saveUsersDB(updatedUsers);

    setActiveSession(updatedProfile);
    setDbUserProfile(updatedProfile);
    setCurrentHouse(newHouse);
    if (!isFirebaseConfigured) {
      await syncSaveHouse(newHouse);
      await syncSaveUser(updatedProfile);
    }
  };

  // Join House Handler (Supports Local & Firestore Cross-Device Queries)
  const joinHouse = async (houseCode: string) => {
    if (!dbUserProfile) throw new Error('You must be logged in to join a house');
    if (dbUserProfile.houseId || currentHouse) throw new Error('Leave your current household before joining another one.');
    const cleanCode = houseCode.trim().toUpperCase();
    if (!cleanCode) throw new Error('Please enter a house code');
    if (!/^[A-Z0-9-]{4,10}$/.test(cleanCode)) throw new Error('Invalid house code format.');

    const houses = loadHousesDB();
    let house = houses.find((h) => h.code.toUpperCase() === cleanCode);

    // Cross-device lookup uses a minimal code index instead of listing every house.
    if (!house && isFirebaseConfigured && db) {
      try {
        const codeSnapshot = await getDoc(doc(db, 'houseCodes', cleanCode));
        if (codeSnapshot.exists()) {
          const targetHouseId = codeSnapshot.data().houseId as string;
          const houseSnapshot = await getDoc(doc(db, 'houses', targetHouseId));
          if (houseSnapshot.exists()) house = houseSnapshot.data() as House;
        }
      } catch (err) {
        console.warn('Firestore joinHouse query fallback notice:', err);
      }
    }

    if (!house) {
      throw new Error(`No house found with code "${cleanCode}". Please verify and try again.`);
    }
    if (house.members.length >= 10 && !house.members.some((member) => member.uid === dbUserProfile.uid)) {
      throw new Error('This household has reached the 10-member accounting limit.');
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

      if (!isFirebaseConfigured) {
        const members = [...house.members, newMember];
        house = {
          ...house,
          members,
          memberUids: members.map((member) => member.uid),
          memberMap: Object.fromEntries(members.map((member) => [member.uid, member])),
        };
      }
    }

    const updatedProfile = { ...dbUserProfile, houseId: house.id, role: 'member' as const };

    if (isFirebaseConfigured && db) {
      let committedHouse = house;
      await runTransaction(db, async (transaction) => {
        const houseRef = doc(db!, 'houses', house!.id);
        const snapshot = await transaction.get(houseRef);
        if (!snapshot.exists()) throw new Error('This household no longer exists.');
        const latestHouse = snapshot.data() as House;
        const latestMembers = latestHouse.members || [];
        const alreadyJoined = latestMembers.some((member) => member.uid === dbUserProfile.uid);
        if (!alreadyJoined && latestMembers.length >= 10) throw new Error('This household has reached the 10-member accounting limit.');
        const committedMember: HouseMember = {
          uid: dbUserProfile.uid,
          displayName: dbUserProfile.displayName,
          email: dbUserProfile.email,
          avatar: dbUserProfile.avatar,
          role: 'member',
          joinedAt: new Date().toISOString(),
        };
        committedHouse = alreadyJoined
          ? latestHouse
          : {
              ...latestHouse,
              members: [...latestMembers, committedMember],
              memberUids: Array.from(new Set([...(latestHouse.memberUids || latestMembers.map((member) => member.uid)), dbUserProfile.uid])),
              memberMap: { ...(latestHouse.memberMap || Object.fromEntries(latestMembers.map((member) => [member.uid, member]))), [dbUserProfile.uid]: committedMember },
            };
        transaction.set(houseRef, sanitizeForFirestore(committedHouse), { merge: true });
        transaction.set(doc(db!, 'users', dbUserProfile.uid), updatedProfile, { merge: true });
      });
      house = committedHouse;
    }

    const persistedHouses = loadHousesDB();
    const persistedIndex = persistedHouses.findIndex((item) => item.id === house!.id);
    if (persistedIndex >= 0) persistedHouses[persistedIndex] = house;
    else persistedHouses.push(house);
    saveHousesDB(persistedHouses);

    const users = loadUsersDB();
    const updatedUsers = users.map((u) => {
      if (u.uid === dbUserProfile.uid) {
        return { ...u, houseId: house!.id, role: 'member' as const };
      }
      return u;
    });
    saveUsersDB(updatedUsers);

    setActiveSession(updatedProfile);
    setDbUserProfile(updatedProfile);
    setCurrentHouse({ ...house });
    if (!isFirebaseConfigured) {
      await syncSaveHouse(house);
      await syncSaveUser(updatedProfile);
    }
  };

  // Update House Name Handler (Leader Power)
  const updateHouseName = async (newName: string) => {
    if (!currentHouse) throw new Error('No active house found');
    if (!dbUserProfile || currentHouse.leaderUid !== dbUserProfile.uid) {
      throw new Error('Only the House Leader can rename the household.');
    }
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('House name cannot be empty');

    const updatedHouse = { ...currentHouse, name: trimmed };
    if (isFirebaseConfigured && db) {
      await runTransaction(db, async (transaction) => {
        const houseRef = doc(db!, 'houses', currentHouse.id);
        const snapshot = await transaction.get(houseRef);
        if (!snapshot.exists() || snapshot.data().leaderUid !== dbUserProfile.uid) {
          throw new Error('Only the current House Leader can rename the household.');
        }
        transaction.update(houseRef, { name: trimmed });
        transaction.set(doc(db!, 'houseCodes', currentHouse.code.toUpperCase()), {
          houseId: currentHouse.id,
          name: trimmed,
          leaderUid: dbUserProfile.uid,
        }, { merge: true });
      });
    }
    const houses = loadHousesDB();
    const updatedHouses = houses.map((h) => (h.id === currentHouse.id ? updatedHouse : h));
    saveHousesDB(updatedHouses);
    setCurrentHouse(updatedHouse);
    if (!isFirebaseConfigured) await syncSaveHouse(updatedHouse);
  };

  // Kick Member Handler (Leader Power with settlement balance check)
  const kickMember = async (targetUid: string) => {
    if (!currentHouse) throw new Error('No active house found');
    if (!dbUserProfile || currentHouse.leaderUid !== dbUserProfile.uid) {
      throw new Error('Only the House Leader can remove members.');
    }
    if (currentHouse.leaderUid === targetUid) throw new Error('House leader cannot be kicked from house');
    if (hasPendingLedgerMutations(currentHouse.id)) throw new Error('Wait for pending ledger changes to sync before removing a member.');

    // Load active expenses & settlements for currentHouse to check target member balance
    const storageScope = houseStorageScope(currentHouse.id);
    let houseExpenses: Expense[] = loadExpenses(storageScope);
    let houseSettlements: Settlement[] = loadSettlements(storageScope);

    let ledgerRevisionBefore = currentHouse.ledgerRevision || 0;
    if (isFirebaseConfigured && db) {
      try {
        const houseSnapshot = await getDoc(doc(db, 'houses', currentHouse.id));
        if (!houseSnapshot.exists()) throw new Error('Household no longer exists.');
        ledgerRevisionBefore = Number(houseSnapshot.data().ledgerRevision || 0);
        const expSnap = await getDocs(query(collection(db, 'expenses'), where('houseId', '==', currentHouse.id)));
        const fsExpenses: Expense[] = [];
        expSnap.forEach((docSnap) => fsExpenses.push(docSnap.data() as Expense));
        houseExpenses = fsExpenses;

        const stSnap = await getDocs(query(collection(db, 'settlements'), where('houseId', '==', currentHouse.id)));
        const fsSettlements: Settlement[] = [];
        stSnap.forEach((docSnap) => fsSettlements.push(docSnap.data() as Settlement));
        houseSettlements = fsSettlements;
      } catch (err) {
        console.error('Unable to verify the latest ledger before removing a member.', err);
        throw new Error('Could not verify the live household balance. No member was removed. Please reconnect and try again.');
      }
    }

    const houseUsers = getHouseUsers(currentHouse, dbUserProfile);
    const netBalancesMap = calculateNetBalances(houseExpenses, houseSettlements, houseUsers);

    const targetMember = currentHouse.members.find((m) => m.uid === targetUid);
    const targetName = targetMember?.displayName || 'This member';

    const targetBalanceKey = Object.keys(netBalancesMap).find((k) => {
      const u = netBalancesMap[k].user;
      return k === targetUid || (u && (u.uid === targetUid || u.id === targetUid));
    });

    const targetNetBalanceCents = targetBalanceKey ? netBalancesMap[targetBalanceKey].netBalanceCents : 0;

    if (Math.abs(targetNetBalanceCents) > 0) {
      const formattedAmount = (Math.abs(targetNetBalanceCents) / 100).toFixed(2);
      if (targetNetBalanceCents > 0) {
        throw new Error(
          `Cannot kick ${targetName} while they are owed ৳${formattedAmount}. All balances must be settled first.`
        );
      } else {
        throw new Error(
          `Cannot kick ${targetName} while they owe ৳${formattedAmount}. All balances must be settled first.`
        );
      }
    }

    const updatedMembers = currentHouse.members.filter((m) => m.uid !== targetUid);
    const updatedHouse = { ...currentHouse, members: updatedMembers, memberUids: updatedMembers.map((member) => member.uid), memberMap: Object.fromEntries(updatedMembers.map((member) => [member.uid, member])) };

    if (isFirebaseConfigured && db) {
      await runTransaction(db, async (transaction) => {
        const houseRef = doc(db!, 'houses', currentHouse.id);
        const snapshot = await transaction.get(houseRef);
        if (!snapshot.exists() || snapshot.data().leaderUid !== dbUserProfile.uid) {
          throw new Error('Only the current House Leader can remove members.');
        }
        const latest = snapshot.data() as House;
        if (Number(latest.ledgerRevision || 0) !== ledgerRevisionBefore) throw new Error('The ledger changed while balances were being checked. Please try again.');
        const remainingMembers = latest.members.filter((member) => member.uid !== targetUid);
        transaction.update(houseRef, sanitizeForFirestore({
          members: remainingMembers,
          memberUids: remainingMembers.map((member) => member.uid),
          memberMap: Object.fromEntries(remainingMembers.map((member) => [member.uid, member])),
        }));
        transaction.set(doc(db!, 'users', targetUid), { houseId: null, role: null }, { merge: true });
      });
    }

    const houses = loadHousesDB();
    const updatedHouses = houses.map((h) => (h.id === currentHouse.id ? updatedHouse : h));
    saveHousesDB(updatedHouses);
    setCurrentHouse(updatedHouse);
    if (!isFirebaseConfigured) await syncSaveHouse(updatedHouse);

    const users = loadUsersDB();
    const updatedUsers = users.map((u) => {
      if (u.uid === targetUid) {
        return { ...u, houseId: null, role: null };
      }
      return u;
    });
    saveUsersDB(updatedUsers);
  };

  // Transfer Leadership Handler (Allows leader to pass ownership to any active member)
  const transferLeadership = async (targetUid: string) => {
    if (!currentHouse) throw new Error('No active house found');
    if (!dbUserProfile) throw new Error('You must be logged in to transfer leadership');

    const myUid = dbUserProfile.uid || activeUserId;
    const isCurrentLeader = currentHouse.leaderUid === myUid || dbUserProfile.role === 'leader';
    if (!isCurrentLeader) {
      throw new Error('Only the current House Leader can transfer leadership.');
    }
    if (currentHouse.leaderUid === targetUid) {
      throw new Error('You are already the House Leader.');
    }

    const targetMember = currentHouse.members.find((m) => m.uid === targetUid);
    if (!targetMember) {
      throw new Error('Target member is not part of this household.');
    }

    const updatedMembers: HouseMember[] = currentHouse.members.map((m) => {
      if (m.uid === myUid) {
        return { ...m, role: 'member' as const };
      }
      if (m.uid === targetUid) {
        return { ...m, role: 'leader' as const };
      }
      return m;
    });

    const updatedHouse: House = {
      ...currentHouse,
      leaderUid: targetUid,
      members: updatedMembers,
      memberUids: updatedMembers.map((member) => member.uid),
      memberMap: Object.fromEntries(updatedMembers.map((member) => [member.uid, member])),
    };

    if (isFirebaseConfigured && db) {
      await runTransaction(db, async (transaction) => {
        const houseRef = doc(db!, 'houses', currentHouse.id);
        const snapshot = await transaction.get(houseRef);
        if (!snapshot.exists() || snapshot.data().leaderUid !== myUid) {
          throw new Error('Only the current House Leader can transfer leadership.');
        }
        transaction.set(houseRef, sanitizeForFirestore(updatedHouse), { merge: true });
        transaction.set(doc(db!, 'users', myUid), { role: 'member' }, { merge: true });
        transaction.set(doc(db!, 'users', targetUid), { role: 'leader' }, { merge: true });
        transaction.set(doc(db!, 'houseCodes', currentHouse.code.toUpperCase()), {
          houseId: currentHouse.id,
          name: currentHouse.name,
          leaderUid: targetUid,
        }, { merge: true });
      });
    }

    const houses = loadHousesDB();
    const updatedHouses = houses.map((h) => (h.id === currentHouse.id ? updatedHouse : h));
    saveHousesDB(updatedHouses);

    const users = loadUsersDB();
    const updatedUsers = users.map((u) => {
      if (u.uid === myUid) {
        return { ...u, role: 'member' as const };
      }
      if (u.uid === targetUid) {
        return { ...u, role: 'leader' as const };
      }
      return u;
    });
    saveUsersDB(updatedUsers);

    const updatedMyProfile = { ...dbUserProfile, role: 'member' as const };
    setActiveSession(updatedMyProfile);
    setDbUserProfile(updatedMyProfile);
    setCurrentHouse(updatedHouse);

    if (!isFirebaseConfigured) {
      await syncSaveHouse(updatedHouse);
      await syncSaveUser(updatedMyProfile);
    }

    const targetUserRecord = updatedUsers.find((u) => u.uid === targetUid);
    if (targetUserRecord) {
      if (!isFirebaseConfigured) await syncSaveUser(targetUserRecord);
    }
  };

  // Leave House Handler (Enforces 0 settlement balance rule)
  const leaveHouse = async (passedExpenses?: Expense[], passedSettlements?: Settlement[]) => {
    if (!dbUserProfile || !currentHouse) return;
    if (currentHouse.leaderUid === dbUserProfile.uid) {
      throw new Error('House Leaders cannot leave house. Delete or transfer ownership first.');
    }

    const myUid = dbUserProfile.uid || activeUserId;
    if (hasPendingLedgerMutations(currentHouse.id)) throw new Error('Wait for pending ledger changes to sync before leaving the household.');

    // Load active expenses & settlements for currentHouse
    let houseExpenses: Expense[] = passedExpenses || [];
    let houseSettlements: Settlement[] = passedSettlements || [];

    if (!passedExpenses || passedExpenses.length === 0) {
      houseExpenses = loadExpenses(houseStorageScope(currentHouse.id));
    }
    if (!passedSettlements || passedSettlements.length === 0) {
      houseSettlements = loadSettlements(houseStorageScope(currentHouse.id));
    }

    // Also fetch latest Firestore expenses & settlements if Firestore is connected
    let ledgerRevisionBefore = currentHouse.ledgerRevision || 0;
    if (isFirebaseConfigured && db) {
      try {
        const houseSnapshot = await getDoc(doc(db, 'houses', currentHouse.id));
        if (!houseSnapshot.exists()) throw new Error('Household no longer exists.');
        ledgerRevisionBefore = Number(houseSnapshot.data().ledgerRevision || 0);
        const expSnap = await getDocs(query(collection(db, 'expenses'), where('houseId', '==', currentHouse.id)));
        const fsExpenses: Expense[] = [];
        expSnap.forEach((docSnap) => fsExpenses.push(docSnap.data() as Expense));
        houseExpenses = fsExpenses;

        const stSnap = await getDocs(query(collection(db, 'settlements'), where('houseId', '==', currentHouse.id)));
        const fsSettlements: Settlement[] = [];
        stSnap.forEach((docSnap) => fsSettlements.push(docSnap.data() as Settlement));
        houseSettlements = fsSettlements;
      } catch (err) {
        console.error('Unable to verify the latest ledger before leaving.', err);
        throw new Error('Could not verify your live household balance. You have not left the household. Please reconnect and try again.');
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
    const updatedHouse = { ...currentHouse, members: updatedMembers, memberUids: updatedMembers.map((member) => member.uid), memberMap: Object.fromEntries(updatedMembers.map((member) => [member.uid, member])) };

    if (isFirebaseConfigured && db) {
      await runTransaction(db, async (transaction) => {
        const houseRef = doc(db!, 'houses', currentHouse.id);
        const snapshot = await transaction.get(houseRef);
        if (!snapshot.exists()) return;
        const latest = snapshot.data() as House;
        if (Number(latest.ledgerRevision || 0) !== ledgerRevisionBefore) throw new Error('The ledger changed while balances were being checked. Please try again.');
        const remainingMembers = latest.members.filter((member) => member.uid !== dbUserProfile.uid);
        transaction.update(houseRef, sanitizeForFirestore({
          members: remainingMembers,
          memberUids: remainingMembers.map((member) => member.uid),
          memberMap: Object.fromEntries(remainingMembers.map((member) => [member.uid, member])),
        }));
        transaction.set(doc(db!, 'users', dbUserProfile.uid), { houseId: null, role: null }, { merge: true });
      });
    }

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
    if (!isFirebaseConfigured) {
      await syncSaveHouse(updatedHouse);
      await syncSaveUser(updatedProfile);
    }
  };

  const userProfile: User = {
    id: dbUserProfile?.uid || activeUserId,
    name: dbUserProfile?.displayName || USERS[activeUserId]?.name || 'User',
    avatar: dbUserProfile?.avatar || USERS[activeUserId]?.avatar || activeUserId,
    color: USERS[activeUserId]?.color || '#6750a4',
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
        updatePersonalWalletSettings,
        changeUserPassword,
        logout,
        createHouse,
        joinHouse,
        updateHouseName,
        kickMember,
        transferLeadership,
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
