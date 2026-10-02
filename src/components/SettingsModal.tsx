import React, { useState } from 'react';
import { X, User, RotateCcw, Check, Sparkles, AlertTriangle } from 'lucide-react';
import { UserProfile, updateCallsign } from '../utils/auth';
import { resetProgress } from '../utils/storage';
import { playSound } from '../utils/sound';

interface SettingsModalProps {
  isOpen: boolean;
  currentUser: UserProfile | null;
  onClose: () => void;
  onCallsignChanged: (updatedUser: UserProfile) => void;
  onProgressReset: () => void;
  onFullReset: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onCallsignChanged,
  onProgressReset,
  onFullReset,
}) => {
  const [newCallsign, setNewCallsign] = useState(currentUser?.displayName || '');
  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const [confirmResetType, setConfirmResetType] = useState<'progress' | 'full' | null>(null);

  if (!isOpen) return null;

  const handleSaveCallsign = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCallsign.trim();
    if (!trimmed) return;
    playSound('success');
    const updated = updateCallsign(trimmed);
    onCallsignChanged(updated);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2500);
  };

  const handleConfirmReset = () => {
    if (confirmResetType === 'progress') {
      playSound('error');
      resetProgress(false);
      onProgressReset();
      setConfirmResetType(null);
      onClose();
    } else if (confirmResetType === 'full') {
      playSound('error');
      resetProgress(true);
      onFullReset();
      setConfirmResetType(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="card-base w-full max-w-lg p-6 sm:p-8 rounded-[14px] space-y-6 text-text font-sans relative shadow-2xl">
        {/* Close Button */}
        <button
          onClick={() => {
            playSound('click');
            onClose();
          }}
          className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[10px] bg-surface-2 hover:bg-border border border-border text-text-muted hover:text-text transition-colors cursor-pointer"
          aria-label="Close settings"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-xs font-semibold text-link">
            <Sparkles className="w-3.5 h-3.5 text-link" />
            <span>Flight Deck Settings</span>
          </div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-text">
            Pilot Configuration & Reset
          </h2>
          <p className="text-xs sm:text-sm text-text-muted">
            Update your flight callsign or reset your command mastery streak.
          </p>
        </div>

        {/* Section 1: Change Callsign */}
        <div className="p-4 rounded-[12px] bg-surface-2 border border-border space-y-3">
          <label htmlFor="settings-callsign" className="text-xs font-bold uppercase tracking-wider text-text-muted block">
            Change Pilot Callsign
          </label>
          <form onSubmit={handleSaveCallsign} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <User className="w-4 h-4 absolute left-3.5 top-3.5 text-text-muted" strokeWidth={1.75} />
              <input
                id="settings-callsign"
                type="text"
                required
                maxLength={40}
                value={newCallsign}
                onChange={(e) => setNewCallsign(e.target.value)}
                placeholder="Enter callsign..."
                style={{ fontSize: '16px' }}
                className="w-full pl-10 pr-3 py-2.5 rounded-[10px] border border-border bg-surface text-text placeholder-text-muted focus:outline-none focus:border-accent min-h-[44px]"
              />
            </div>
            <button
              type="submit"
              disabled={!newCallsign.trim() || newCallsign.trim() === currentUser?.displayName}
              className="btn-primary text-sm px-5 py-2.5 shrink-0 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              {isSavedNotice ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Update Callsign</span>
              )}
            </button>
          </form>
          {isSavedNotice && (
            <p className="text-xs text-success font-medium flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>Callsign updated successfully!</span>
            </p>
          )}
        </div>

        {/* Section 2: Reset Progress Options */}
        <div className="p-4 rounded-[12px] bg-surface-2 border border-border space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Reset Progress Options
          </div>

          {confirmResetType === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmResetType('progress')}
                className="btn-secondary text-xs sm:text-sm py-3 px-3.5 gap-2 border-border hover:border-danger hover:text-danger justify-center cursor-pointer min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Lessons Only</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetType('full')}
                className="btn-secondary text-xs sm:text-sm py-3 px-3.5 gap-2 border-danger/40 text-danger hover:bg-danger/10 justify-center cursor-pointer min-h-[44px]"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Reset All & Callsign</span>
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-[10px] bg-danger/10 border border-danger space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-danger">
                    {confirmResetType === 'progress' 
                      ? 'Confirm: Reset all mastered commands?' 
                      : 'Confirm: Erase callsign and return to onboarding?'}
                  </div>
                  <div className="text-text-muted">
                    {confirmResetType === 'progress'
                      ? 'This resets all 37 command checkpoints to unlearned while preserving your callsign.'
                      : 'This clears your local storage state and returns to the initial "What is your name, pilot?" screen.'}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmResetType(null)}
                  className="btn-secondary text-xs py-2 px-3 min-h-[36px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="px-4 py-2 rounded-[8px] bg-danger text-accent-ink text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer min-h-[36px]"
                >
                  Yes, Proceed
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-text-muted pt-1">
          All data is stored directly in your browser under a single local key.
        </div>
      </div>
    </div>
  );
};
