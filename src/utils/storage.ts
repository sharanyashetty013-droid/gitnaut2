import { UserProgress } from '../types/git';
import { GIT_STAGES } from '../data/gitStages';

export const GITNAUT_STORAGE_KEY = 'gitnaut_state';

export interface GitnautState {
  callsign: string;
  learnedCommandIds: string[];
  lastLearnedCommandId: string | null;
  streakDates: string[]; // ISO YYYY-MM-DD
  completedStageIds: string[];
  xp: number;
  level: number;
  joinedAt: string;
  badges: string[];
}

type StorageChangeListener = (state: GitnautState | null) => void;
const listeners = new Set<StorageChangeListener>();

export function subscribeToStorage(listener: StorageChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyStorageChange(state: GitnautState | null): void {
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.error('Storage listener error', e);
    }
  });
}

export function getLocalTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayKey(): string {
  return getLocalTodayDateStr();
}

/**
 * Reads the single Gitnaut state from localStorage.
 */
export function getGitnautState(): GitnautState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GITNAUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      callsign: typeof parsed.callsign === 'string' ? parsed.callsign : '',
      learnedCommandIds: Array.isArray(parsed.learnedCommandIds) ? parsed.learnedCommandIds : [],
      lastLearnedCommandId: typeof parsed.lastLearnedCommandId === 'string' ? parsed.lastLearnedCommandId : null,
      streakDates: Array.isArray(parsed.streakDates) ? parsed.streakDates : [getLocalTodayDateStr()],
      completedStageIds: Array.isArray(parsed.completedStageIds) ? parsed.completedStageIds : [],
      xp: typeof parsed.xp === 'number' ? parsed.xp : 0,
      level: typeof parsed.level === 'number' ? parsed.level : 1,
      joinedAt: typeof parsed.joinedAt === 'string' ? parsed.joinedAt : getLocalTodayDateStr(),
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
    };
  } catch (e) {
    console.error('Error reading Gitnaut state from localStorage', e);
    return null;
  }
}

/**
 * Saves the single Gitnaut state into localStorage.
 */
export function saveGitnautState(state: GitnautState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GITNAUT_STORAGE_KEY, JSON.stringify(state));
    notifyStorageChange(state);
  } catch (e) {
    console.error('Error saving Gitnaut state to localStorage', e);
  }
}

/**
 * Checks if a callsign already exists in localStorage.
 * If yes, onboarding is skipped and app goes straight to flight deck.
 */
export function hasSavedCallsign(): boolean {
  const state = getGitnautState();
  return Boolean(state && state.callsign && state.callsign.trim().length > 0);
}

/**
 * Initializes or updates pilot with callsign.
 * If callsign is "Guest" or empty, sets "Guest".
 */
export function setPilotCallsign(name: string): GitnautState {
  const trimmed = name.trim() || 'Guest';
  const existing = getGitnautState();
  const today = getLocalTodayDateStr();

  const nextState: GitnautState = existing
    ? {
        ...existing,
        callsign: trimmed,
        streakDates: existing.streakDates.includes(today) ? existing.streakDates : [...existing.streakDates, today],
      }
    : {
        callsign: trimmed,
        learnedCommandIds: [],
        lastLearnedCommandId: null,
        streakDates: [today],
        completedStageIds: [],
        xp: 0,
        level: 1,
        joinedAt: today,
        badges: trimmed === 'Guest' ? ['Guest Cadet'] : ['Recruit Onboarded'],
      };

  saveGitnautState(nextState);
  return nextState;
}

/**
 * Updates callsign in settings without resetting progress.
 */
export function changePilotCallsign(newCallsign: string): GitnautState {
  const trimmed = newCallsign.trim() || 'Guest';
  const state = getGitnautState() || {
    callsign: trimmed,
    learnedCommandIds: [],
    lastLearnedCommandId: null,
    streakDates: [getLocalTodayDateStr()],
    completedStageIds: [],
    xp: 0,
    level: 1,
    joinedAt: getLocalTodayDateStr(),
    badges: ['Recruit Onboarded'],
  };

  const updated: GitnautState = {
    ...state,
    callsign: trimmed,
  };

  saveGitnautState(updated);
  return updated;
}

/**
 * Loads UserProgress for the stage and lesson components.
 */
export function loadProgress(): UserProgress {
  const state = getGitnautState();
  if (!state) {
    return {
      learnedCommandIds: [],
      lastLearnedCommandId: null,
      streakDates: [getLocalTodayDateStr()],
      completedStageIds: [],
    };
  }

  // Recalculate completed stages based on current commands
  const completedStageIds: string[] = [];
  for (const stage of GIT_STAGES) {
    if (stage.commands.length === 0) continue;
    const allStageDone = stage.commands.every((cmd) => state.learnedCommandIds.includes(cmd.id));
    if (allStageDone) {
      completedStageIds.push(stage.id);
    }
  }

  return {
    learnedCommandIds: state.learnedCommandIds,
    lastLearnedCommandId: state.lastLearnedCommandId,
    streakDates: state.streakDates,
    completedStageIds,
  };
}

export function saveProgress(progress: UserProgress): void {
  const state = getGitnautState() || {
    callsign: 'Guest',
    learnedCommandIds: [],
    lastLearnedCommandId: null,
    streakDates: [getLocalTodayDateStr()],
    completedStageIds: [],
    xp: 0,
    level: 1,
    joinedAt: getLocalTodayDateStr(),
    badges: [],
  };

  const today = getLocalTodayDateStr();
  const streakSet = new Set(progress.streakDates);
  streakSet.add(today);

  const xp = progress.learnedCommandIds.length * 50;
  const level = Math.floor(xp / 100) + 1;

  const updated: GitnautState = {
    ...state,
    learnedCommandIds: progress.learnedCommandIds,
    lastLearnedCommandId: progress.lastLearnedCommandId,
    streakDates: Array.from(streakSet).sort(),
    completedStageIds: progress.completedStageIds,
    xp,
    level,
  };

  saveGitnautState(updated);
}

/**
 * Toggles command learned state in the single localStorage key.
 */
export function toggleLearnedState(commandId: string): {
  progress: UserProgress;
  isNowLearned: boolean;
  stageJustCompleted: string | null;
} {
  const state = getGitnautState() || {
    callsign: 'Guest',
    learnedCommandIds: [],
    lastLearnedCommandId: null,
    streakDates: [getLocalTodayDateStr()],
    completedStageIds: [],
    xp: 0,
    level: 1,
    joinedAt: getLocalTodayDateStr(),
    badges: [],
  };

  const beforeCompleted = state.completedStageIds;
  const isLearned = state.learnedCommandIds.includes(commandId);
  const nextLearned = isLearned
    ? state.learnedCommandIds.filter((id) => id !== commandId)
    : [...state.learnedCommandIds, commandId];

  const today = getLocalTodayDateStr();
  const streakSet = new Set(state.streakDates);
  streakSet.add(today);

  // Recalculate completed stages
  const nextCompleted: string[] = [];
  let stageJustCompleted: string | null = null;

  for (const stage of GIT_STAGES) {
    if (stage.commands.length === 0) continue;
    const allStageDone = stage.commands.every((cmd) => nextLearned.includes(cmd.id));
    if (allStageDone) {
      nextCompleted.push(stage.id);
      if (!beforeCompleted.includes(stage.id) && !isLearned) {
        stageJustCompleted = stage.title;
      }
    }
  }

  const xp = nextLearned.length * 50;
  const level = Math.floor(xp / 100) + 1;

  const nextBadges = [...state.badges];
  if (nextLearned.length >= 1 && !nextBadges.includes('First Commit')) {
    nextBadges.push('First Commit');
  }
  if (nextCompleted.length >= 1 && !nextBadges.includes('Stage Master')) {
    nextBadges.push('Stage Master');
  }

  const updatedState: GitnautState = {
    ...state,
    learnedCommandIds: nextLearned,
    lastLearnedCommandId: isLearned ? (nextLearned[nextLearned.length - 1] || null) : commandId,
    streakDates: Array.from(streakSet).sort(),
    completedStageIds: nextCompleted,
    xp,
    level,
    badges: nextBadges,
  };

  saveGitnautState(updatedState);

  const updatedProgress: UserProgress = {
    learnedCommandIds: nextLearned,
    lastLearnedCommandId: updatedState.lastLearnedCommandId,
    streakDates: updatedState.streakDates,
    completedStageIds: nextCompleted,
  };

  return {
    progress: updatedProgress,
    isNowLearned: !isLearned,
    stageJustCompleted,
  };
}

/**
 * Resets all progress while keeping or resetting callsign.
 */
export function resetProgress(resetCallsign: boolean = false): UserProgress {
  if (resetCallsign) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(GITNAUT_STORAGE_KEY);
      notifyStorageChange(null);
    }
    return {
      learnedCommandIds: [],
      lastLearnedCommandId: null,
      streakDates: [getLocalTodayDateStr()],
      completedStageIds: [],
    };
  }

  const existing = getGitnautState();
  const callsign = existing?.callsign || 'Guest';
  const today = getLocalTodayDateStr();

  const resetState: GitnautState = {
    callsign,
    learnedCommandIds: [],
    lastLearnedCommandId: null,
    streakDates: [today],
    completedStageIds: [],
    xp: 0,
    level: 1,
    joinedAt: existing?.joinedAt || today,
    badges: ['Fresh Start'],
  };

  saveGitnautState(resetState);

  return {
    learnedCommandIds: [],
    lastLearnedCommandId: null,
    streakDates: [today],
    completedStageIds: [],
  };
}
