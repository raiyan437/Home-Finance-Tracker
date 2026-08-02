import type { UserProfile, House } from '../types';

const USERS_DB_KEY = 'home_finance_users_db_v3';
const HOUSES_DB_KEY = 'home_finance_houses_db_v3';
const ACTIVE_SESSION_KEY = 'home_finance_active_session_v3';
const LOCAL_CREDENTIALS_KEY = 'home_finance_local_credentials_v1';

interface LocalCredential {
  uid: string;
  email: string;
  salt: string;
  hash: string;
  iterations: number;
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const deriveCredentialHash = async (password: string, salt: Uint8Array, iterations: number): Promise<string> => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
};

const loadLocalCredentials = (): LocalCredential[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_CREDENTIALS_KEY) || '[]');
  } catch {
    return [];
  }
};

export const saveLocalCredential = async (uid: string, email: string, password: string): Promise<void> => {
  const iterations = 210_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const credential: LocalCredential = {
    uid,
    email: email.trim().toLowerCase(),
    salt: bytesToBase64(salt),
    hash: await deriveCredentialHash(password, salt, iterations),
    iterations,
  };
  const credentials = loadLocalCredentials().filter((item) => item.uid !== uid && item.email !== credential.email);
  localStorage.setItem(LOCAL_CREDENTIALS_KEY, JSON.stringify([...credentials, credential]));
};

export const verifyLocalCredential = async (email: string, password: string): Promise<boolean> => {
  const cleanEmail = email.trim().toLowerCase();
  const credential = loadLocalCredentials().find((item) => item.email === cleanEmail);
  if (!credential) return false;
  const candidate = await deriveCredentialHash(password, base64ToBytes(credential.salt), credential.iterations);
  if (candidate.length !== credential.hash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < candidate.length; i += 1) mismatch |= candidate.charCodeAt(i) ^ credential.hash.charCodeAt(i);
  return mismatch === 0;
};

// Empty Production User & House DB Default Arrays
const DEFAULT_USERS: UserProfile[] = [];

// Helper: Load Users DB
export const loadUsersDB = (): UserProfile[] => {
  const saved = localStorage.getItem(USERS_DB_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      parsed.forEach((profile: UserProfile & { password?: string }) => {
        if (profile.uid && profile.email && profile.password) {
          void saveLocalCredential(profile.uid, profile.email, profile.password);
        }
      });
      const sanitized = parsed.map(({ password: _removedPassword, ...profile }) => profile as UserProfile);
      if (parsed.some((profile) => Object.prototype.hasOwnProperty.call(profile, 'password'))) {
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(sanitized));
      }
      return sanitized;
    } catch (e) {
      console.warn('Failed to parse users db:', e);
    }
  }
  localStorage.setItem(USERS_DB_KEY, JSON.stringify(DEFAULT_USERS));
  return DEFAULT_USERS;
};

// Helper: Save Users DB
export const saveUsersDB = (users: UserProfile[]) => {
  const sanitized = users.map((user) => {
    const profile = { ...(user as UserProfile & { password?: string }) };
    delete profile.password;
    return profile;
  });
  localStorage.setItem(USERS_DB_KEY, JSON.stringify(sanitized));
};

// Helper: Load Houses DB
export const loadHousesDB = (): House[] => {
  const saved = localStorage.getItem(HOUSES_DB_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse houses db:', e);
    }
  }
  const initial: House[] = [];
  localStorage.setItem(HOUSES_DB_KEY, JSON.stringify(initial));
  return initial;
};

// Helper: Save Houses DB
export const saveHousesDB = (houses: House[]) => {
  localStorage.setItem(HOUSES_DB_KEY, JSON.stringify(houses));
};

// Helper: Get Active Session User
export const getActiveSession = (): UserProfile | null => {
  const saved = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as UserProfile & { password?: string };
      const user = { ...parsed };
      delete user.password;
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(user));
      const allUsers = loadUsersDB();
      return allUsers.find((u) => u.uid === user.uid) || user;
    } catch {
      return null;
    }
  }
  return null;
};

// Helper: Save Active Session
export const setActiveSession = (user: UserProfile | null) => {
  if (user) {
    const { password: _removedPassword, ...sanitized } = user as UserProfile & { password?: string };
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(sanitized));
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
};

// Helper: Reset Mock DB to Clean State
export const resetMockDBToDefault = () => {
  saveUsersDB([]);
  saveHousesDB([]);
  setActiveSession(null);
  localStorage.removeItem(LOCAL_CREDENTIALS_KEY);
};
