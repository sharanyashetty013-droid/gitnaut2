/**
 * Gitnaut Pilot Profile System
 * All pilot callsign and progress data stored in localStorage under a single key: 'gitnaut_state'.
 * No server authentication, no passwords, no tokens, no server API calls.
 */
import { 
  getGitnautState, 
  setPilotCallsign, 
  changePilotCallsign, 
  hasSavedCallsign, 
  saveGitnautState,
  getLocalTodayDateStr,
  GitnautState 
} from './storage';

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

export const ROLE_PERKS: Record<UserProfile['role'], string> = {
  'Junior Dev': 'Foundations: Step-by-step interactive command visualizer & syntax guides',
  'Full-Stack Ninja': 'Parallel Realities: Multi-branch checkout and clean merge conflict drills',
  'DevOps Lead': 'Continuous Integration: Remote push, fetch, and linear history rebase mastery',
  'Open Source Hero': 'Collaboration: Clean commit hygiene, stash recovery, and pull requests',
  'Admin Operative': 'Flight Command: Global mission telemetry inspection enabled',
};

/**
 * Derives a UserProfile object from the single localStorage GitnautState.
 */
export function stateToUserProfile(state: GitnautState | null): UserProfile | null {
  if (!state || !state.callsign || !state.callsign.trim()) {
    return null;
  }

  const callsign = state.callsign.trim();
  const safeId = 'pilot_' + (callsign.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'pilot');
  const xp = state.xp || 0;
  const level = Math.max(1, state.level || Math.floor(xp / 100) + 1);

  return {
    id: safeId,
    username: callsign,
    email: `${callsign.toLowerCase().replace(/\s+/g, '_')}@gitnaut.space`,
    displayName: callsign,
    avatar: '',
    role: 'Junior Dev',
    specialPerk: ROLE_PERKS['Junior Dev'],
    xp,
    level,
    joinedAt: state.joinedAt || getLocalTodayDateStr(),
    badges: state.badges || ['Recruit Onboarded'],
    lastLogin: 'Active session',
  };
}

/**
 * Returns current pilot profile from the single localStorage key.
 */
export function getCurrentUser(): UserProfile | null {
  return stateToUserProfile(getGitnautState());
}

/**
 * Checks if pilot callsign already exists in localStorage.
 */
export { hasSavedCallsign };

/**
 * Returns true if current callsign is "Guest".
 */
export function isGuestMode(): boolean {
  const state = getGitnautState();
  return Boolean(state && state.callsign.toLowerCase() === 'guest');
}

/**
 * Sets pilot as Guest in localStorage.
 */
export function setGuestMode(_active: boolean = true): UserProfile {
  const updatedState = setPilotCallsign('Guest');
  return stateToUserProfile(updatedState)!;
}

/**
 * Launches the pilot with a callsign. Pure client-side, zero server calls.
 */
export function launchPilot(callsign: string): UserProfile {
  const updatedState = setPilotCallsign(callsign);
  return stateToUserProfile(updatedState)!;
}

/**
 * Updates callsign in settings.
 */
export function updateCallsign(newCallsign: string): UserProfile {
  const updatedState = changePilotCallsign(newCallsign);
  return stateToUserProfile(updatedState)!;
}

/**
 * Clears the callsign to return to the onboarding screen.
 */
export function logoutUser(): void {
  if (typeof window === 'undefined') return;
  const state = getGitnautState();
  if (state) {
    saveGitnautState({
      ...state,
      callsign: '',
    });
  }
}

export function getAllUsers(): UserProfile[] {
  const current = getCurrentUser();
  return current ? [current] : [];
}

export function addXP(points: number): UserProfile | null {
  const state = getGitnautState();
  if (!state) return null;

  const nextXP = Math.max(0, (state.xp || 0) + points);
  const nextLevel = Math.floor(nextXP / 100) + 1;

  const updated: GitnautState = {
    ...state,
    xp: nextXP,
    level: nextLevel,
  };

  saveGitnautState(updated);
  return stateToUserProfile(updated);
}

export function unlockBadge(badgeName: string): boolean {
  const state = getGitnautState();
  if (!state) return false;

  if (!state.badges.includes(badgeName)) {
    const updated: GitnautState = {
      ...state,
      badges: [...state.badges, badgeName],
      xp: (state.xp || 0) + 50,
      level: Math.floor(((state.xp || 0) + 50) / 100) + 1,
    };
    saveGitnautState(updated);
    return true;
  }

  return false;
}
