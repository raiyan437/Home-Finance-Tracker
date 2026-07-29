import type { UserProfile, House } from '../types';

const USERS_DB_KEY = 'home_finance_users_db_v2';
const HOUSES_DB_KEY = 'home_finance_houses_db_v2';
const ACTIVE_SESSION_KEY = 'home_finance_active_session_v2';

// Default Seed Accounts
const DEFAULT_USERS: UserProfile[] = [
  {
    uid: 'user-raiyan-001',
    displayName: 'Raiyan',
    email: 'raiyan@gmail.com',
    avatar: 'raiyan',
    houseId: 'house-demo-001',
    role: 'leader',
    createdAt: new Date().toISOString(),
  },
  {
    uid: 'user-himel-002',
    displayName: 'Himel',
    email: 'himel@gmail.com',
    avatar: 'himel',
    houseId: 'house-demo-001',
    role: 'member',
    createdAt: new Date().toISOString(),
  },
  {
    uid: 'user-lazim-003',
    displayName: 'Lazim',
    email: 'lazim@gmail.com',
    avatar: 'lazim',
    houseId: 'house-demo-001',
    role: 'member',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_HOUSE: House = {
  id: 'house-demo-001',
  code: 'HM-8823',
  name: 'Bachelor House Villa',
  leaderUid: 'user-raiyan-001',
  members: [
    {
      uid: 'user-raiyan-001',
      displayName: 'Raiyan',
      email: 'raiyan@gmail.com',
      role: 'leader',
      joinedAt: new Date().toISOString(),
    },
    {
      uid: 'user-himel-002',
      displayName: 'Himel',
      email: 'himel@gmail.com',
      role: 'member',
      joinedAt: new Date().toISOString(),
    },
    {
      uid: 'user-lazim-003',
      displayName: 'Lazim',
      email: 'lazim@gmail.com',
      role: 'member',
      joinedAt: new Date().toISOString(),
    },
  ],
  createdAt: new Date().toISOString(),
};

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
  const initial = [DEFAULT_HOUSE];
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
  // Default to Raiyan
  return DEFAULT_USERS[0];
};

// Helper: Save Active Session
export const setActiveSession = (user: UserProfile | null) => {
  if (user) {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
};
