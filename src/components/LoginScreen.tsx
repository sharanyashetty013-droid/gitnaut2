import React, { useState } from 'react';
import { User, ArrowRight, X, AlertCircle, Compass, Sparkles } from 'lucide-react';
import { 
  UserProfile, 
  loginWithPilotName, 
  setGuestMode 
} from '../utils/auth';
import { playSound } from '../utils/sound';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  onContinueAsGuest: () => void;
  isModal?: boolean;
  onClose?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onContinueAsGuest,
  isModal = false,
  onClose,
}) => {
  const [pilotName, setPilotName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = pilotName.trim();
    if (!trimmed) {
      setErrorMessage('Please enter your name, pilot.');
      playSound('error');
      return;
    }

    setIsLoading(true);

    try {
      const res = await loginWithPilotName(trimmed);
      if (res.success && res.user) {
        playSound('success');
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'Failed to authenticate pilot.');
        playSound('error');
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
      playSound('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestClick = () => {
    playSound('pop');
    setGuestMode(true);
    onContinueAsGuest();
  };

  const cardClasses = `relative w-full max-w-md bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-2xl text-text font-sans min-w-0 ${
    isModal ? 'max-h-[90dvh] overflow-y-auto' : ''
  }`;

  const cardContent = (
    <div className={cardClasses}>
      {/* Close button for modals */}
      {isModal && onClose && (
        <button
          onClick={() => {
            playSound('click');
            onClose();
          }}
          className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[10px] bg-surface-2 hover:bg-border border border-border text-text-muted hover:text-text transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>
      )}

      {/* Brand & Heading */}
      <div className="text-center space-y-3 mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent text-accent-ink mx-auto shadow-md">
          <Compass className="w-7 h-7 text-accent-ink" strokeWidth={1.75} />
        </div>
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-xs font-semibold text-link">
            <Sparkles className="w-3.5 h-3.5 text-link" />
            <span>Flight Deck Pilot Onboarding</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-text tracking-normal pt-1">
            What is your name, pilot?
          </h1>
          <p className="text-sm text-text-muted leading-relaxed max-w-sm mx-auto">
            Enter your callsign to launch your flight deck and track your Git mastery streak.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 mb-4 rounded-[10px] bg-danger/15 border border-danger text-danger text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Pilot Name Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5 text-left">
          <label htmlFor="pilot-callsign" className="text-xs font-semibold text-text-muted block">
            Pilot Callsign / Name
          </label>
          <div className="relative">
            <User className="w-5 h-5 absolute left-3.5 top-3.5 text-text-muted" strokeWidth={1.75} />
            <input
              id="pilot-callsign"
              type="text"
              autoFocus
              required
              maxLength={40}
              value={pilotName}
              onChange={(e) => setPilotName(e.target.value)}
              placeholder="e.g. Maverick, Sarah, Neo, Cadet Alex..."
              style={{ fontSize: '16px' }}
              className="w-full pl-11 pr-3 py-3 rounded-[10px] border border-border bg-surface-2 text-text placeholder-text-muted focus:outline-none focus:border-accent min-h-[44px]"
            />
          </div>
        </div>

        {/* Primary Launch Button */}
        <button
          type="submit"
          disabled={isLoading || !pilotName.trim()}
          className="btn-primary w-full text-sm font-bold py-3.5 shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <span>{isLoading ? 'Authorizing Flight...' : 'Launch Flight Deck'}</span>
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </form>

      {/* Guest alternative */}
      <div className="text-center pt-4 border-t border-border mt-5">
        <button
          type="button"
          onClick={handleGuestClick}
          className="text-xs text-text-muted hover:text-link font-medium underline underline-offset-4 cursor-pointer min-h-[44px] inline-flex items-center"
        >
          Explore as guest without entering a name
        </button>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-md flex items-center justify-center p-4">
        {cardContent}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-bg flex flex-col items-center justify-center p-4">
      {cardContent}
    </div>
  );
};
