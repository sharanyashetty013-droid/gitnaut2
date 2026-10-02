/**
 * Gitnaut Real Backend Authentication System
 * Backed by SQLite users & progress tables.
 * Sessions managed via secure httpOnly JWT cookies (no localStorage for user data).
 */
import { getAggregatedStats, logActivityEvent } from './activityEvents';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar: string;
  role: 'Junior Dev' | 'Full-Stack Ninja' | 'DevOps Lead' | 'Open Source Hero' | 'Admin Operative';
  specialPerk: string;
  xp: number;
  level: number;
  joinedAt: string;
  sshKeyFingerprint?: string;
  gpgKeyId?: string;
  badges: string[];
  lastLogin?: string;
  isAdmin?: boolean;
}

export interface BackendUser {
  id: string;
  email: string;
  created_at: string;
}

export interface BackendProgress {
  id: string;
  user_id: string;
  mission_id: string;
  mastery: number;
  streak: number;
  updated_at: string;
}

export const ROLE_PERKS: Record<UserProfile['role'], string> = {
  'Junior Dev': 'Foundations: Step-by-step interactive command visualizer & syntax guides',
  'Full-Stack Ninja': 'Parallel Realities: Multi-branch checkout and clean merge conflict drills',
  'DevOps Lead': 'Continuous Integration: Remote push, fetch, and linear history rebase mastery',
  'Open Source Hero': 'Collaboration: Clean commit hygiene, stash recovery, and pull requests',
  'Admin Operative': 'Flight Command: Global mission telemetry inspection enabled',
};

// Pure in-memory state — no user credentials or tokens in localStorage
let inMemoryUser: UserProfile | null = null;
let guestSessionActive = false;

export function buildUserProfile(user: BackendUser, progressList: BackendProgress[] = []): UserProfile {
  const username = user.email.split('@')[0] || 'gitnaut';
  const totalMastered = progressList.filter((p) => p.mastery > 0).length;
  const maxStreak = progressList.reduce((max, p) => Math.max(max, p.streak || 0), 0);
  const xp = totalMastered * 50 + maxStreak * 10;
  const level = Math.floor(xp / 100) + 1;

  return {
    id: user.id,
    username,
    email: user.email,
    displayName: username,
    avatar: '',
    role: 'Junior Dev',
    specialPerk: ROLE_PERKS['Junior Dev'],
    xp,
    level,
    joinedAt: user.created_at ? user.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
    badges: totalMastered > 0 ? ['Recruit Onboarded', 'Star Scout'] : ['Cadet Enlisted'],
    lastLogin: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function getCurrentUser(): UserProfile | null {
  return inMemoryUser;
}

export function isGuestMode(): boolean {
  return guestSessionActive;
}

export function setGuestMode(active: boolean): void {
  guestSessionActive = active;
}

/**
 * Validates session with backend /api/me (reads httpOnly JWT cookie)
 */
export async function fetchCurrentUser(): Promise<UserProfile | null> {
  try {
    const res = await fetch('/api/me', {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      inMemoryUser = null;
      return null;
    }

    const data = await res.json();
    if (data.user) {
      // Also fetch progress for user to restore mastery stats
      let progressList: BackendProgress[] = [];
      try {
        const progressRes = await fetch('/api/progress', {
          method: 'GET',
          credentials: 'include',
        });
        if (progressRes.ok) {
          const pData = await progressRes.json();
          progressList = pData.progress || [];
        }
      } catch {
        // progress fetch optional on init
      }

      const profile = buildUserProfile(data.user, progressList);
      inMemoryUser = profile;
      guestSessionActive = false;
      return profile;
    }

    inMemoryUser = null;
    return null;
  } catch {
    inMemoryUser = null;
    return null;
  }
}

/**
 * Authenticate with real backend POST /api/login
 */
export async function authenticateWithEmail(
  email: string,
  passwordPlain: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: email.trim(),
        password: passwordPlain,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'Invalid credentials',
      };
    }

    if (data.user) {
      let progressList: BackendProgress[] = [];
      try {
        const pRes = await fetch('/api/progress', {
          method: 'GET',
          credentials: 'include',
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          progressList = pData.progress || [];
        }
      } catch {
        // ignore
      }

      const profile = buildUserProfile(data.user, progressList);
      inMemoryUser = profile;
      guestSessionActive = false;
      return { success: true, user: profile };
    }

    return { success: false, error: 'Invalid response from server' };
  } catch {
    return { success: false, error: 'Unable to connect to authentication server' };
  }
}

/**
 * Register with real backend POST /api/signup
 */
export async function registerNewUser(params: {
  name?: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: params.email.trim(),
        password: params.password,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'Registration failed',
      };
    }

    if (data.user) {
      const profile = buildUserProfile(data.user, []);
      if (params.name && params.name.trim()) {
        profile.displayName = params.name.trim();
      }
      inMemoryUser = profile;
      guestSessionActive = false;
      return { success: true, user: profile };
    }

    return { success: false, error: 'Invalid response from server' };
  } catch {
    return { success: false, error: 'Unable to connect to authentication server' };
  }
}

/**
 * Clear session cookie via POST /api/logout
 */
export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // ignore
  } finally {
    inMemoryUser = null;
    guestSessionActive = false;
  }
}

/**
 * Load progress from real backend GET /api/progress
 */
export async function fetchBackendProgress(): Promise<BackendProgress[]> {
  try {
    const res = await fetch('/api/progress', {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.progress || [];
  } catch {
    return [];
  }
}

/**
 * Save progress to real backend POST /api/progress
 */
export async function saveBackendProgress(
  items: Array<{ mission_id: string; mastery: number; streak: number }>
): Promise<boolean> {
  try {
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(items),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function getAllUsers(): UserProfile[] {
  return inMemoryUser ? [inMemoryUser] : [];
}

export function addXP(points: number): UserProfile | null {
  if (!inMemoryUser) return null;
  logActivityEvent({
    type: 'drill',
    xp: points,
  });
  const stats = getAggregatedStats();
  inMemoryUser.xp = stats.xp;
  inMemoryUser.level = Math.floor(stats.xp / 100) + 1;
  return inMemoryUser;
}

export function unlockBadge(badgeName: string): boolean {
  if (!inMemoryUser) return false;
  if (!inMemoryUser.badges.includes(badgeName)) {
    inMemoryUser.badges.push(badgeName);
    logActivityEvent({
      type: 'mission',
      xp: 50,
    });
    return true;
  }
  return false;
}
