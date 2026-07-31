import type { UserProfile, House } from '../types';

const USERS_DB_KEY = 'home_finance_users_db_v3';
const HOUSES_DB_KEY = 'home_finance_houses_db_v3';
const ACTIVE_SESSION_KEY = 'home_finance_active_session_v3';

// Empty Production User & House DB Default Arrays
const DEFAULT_USERS: UserProfile[] = [];

// Helper: Load Users DB
export const loadUsersDB = (): UserProfile[] => {
  const saved = localStorage.getItem(USERS_DB_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse users db:', e);
    }
  }
  localStorage.setItem(USERS_DB_KEY, JSON.stringify(DEFAULT_USERS));
  return DEFAULT_USERS;
};

// Helper: Save Users DB
export const saveUsersDB = (users: UserProfile[]) => {
  localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
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
      const user: UserProfile = JSON.parse(saved);
      const allUsers = loadUsersDB();
      return allUsers.find((u) => u.uid === user.uid) || user;
    } catch (e) {
      return null;
    }
  }
  return null;
};

// Helper: Save Active Session
export const setActiveSession = (user: UserProfile | null) => {
  if (user) {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
};

// Helper: Reset Mock DB to Clean State
export const resetMockDBToDefault = () => {
  saveUsersDB([]);
  saveHousesDB([]);
  setActiveSession(null);
};
