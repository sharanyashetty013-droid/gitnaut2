import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, X, AlertCircle, CheckCircle2, Compass } from 'lucide-react';
import { 
  UserProfile, 
  authenticateWithEmail, 
  registerNewUser, 
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
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotNotice, setForgotNotice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          setErrorMessage('Please enter your name.');
          setIsLoading(false);
          return;
        }
        if (password.length < 8) {
          setErrorMessage('Password must be at least 8 characters.');
          setIsLoading(false);
          return;
        }
        const res = await registerNewUser({ name, email, password });
        if (res.success && res.user) {
          playSound('success');
          onLoginSuccess(res.user);
        } else {
          setErrorMessage(res.error || 'Registration failed.');
          playSound('error');
        }
      } else {
        const res = await authenticateWithEmail(email, password);
        if (res.success && res.user) {
          playSound('success');
          onLoginSuccess(res.user);
        } else {
          setErrorMessage(res.error || 'Invalid credentials.');
          playSound('error');
        }
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

  const cardClasses = `relative w-full max-w-md bg-surface border border-border rounded-xl p-5 sm:p-8 shadow-xl text-text font-sans min-w-0 ${
    isModal ? 'max-h-[90dvh] overflow-y-auto' : ''
  }`;

  const cardContent = (
    <div className={cardClasses}>
      {/* Large close button for modals */}
      {isModal && onClose && (
        <button
          onClick={() => {
            playSound('click');
            onClose();
          }}
          className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[10px] bg-surface-2 hover:bg-border border border-border text-text-muted hover:text-text transition-colors cursor-pointer"
          aria-label="Close login dialog"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>
      )}

      {/* Brand Header */}
      <div className="text-center space-y-2 mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent text-accent-ink mx-auto shadow-sm">
          <Compass className="w-6 h-6 text-accent-ink" strokeWidth={1.75} />
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-text tracking-normal">
          {isSignUp ? 'Create your Gitnaut account' : 'Welcome back to Gitnaut'}
        </h1>
        <p className="text-sm text-text-muted">
          Sign in to save your verified mission mastery and constellation streak.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 mb-3 rounded-[10px] bg-danger/15 border border-danger text-danger text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>{errorMessage}</span>
        </div>
      )}

      {forgotNotice && (
        <div className="p-3 mb-3 rounded-[10px] bg-success/15 border border-success text-success text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>A password recovery link has been transmitted.</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-text-muted block">
              Callsign / Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-3.5 text-text-muted" strokeWidth={1.75} />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Dev"
                style={{ fontSize: '16px' }}
                className="w-full pl-10 pr-3 py-3 rounded-[10px] border border-border bg-surface-2 text-text placeholder-text-muted focus:outline-none focus:border-accent min-h-[44px]"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5 text-left">
          <label className="text-xs font-semibold text-text-muted block">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-text-muted" strokeWidth={1.75} />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              style={{ fontSize: '16px' }}
              className="w-full pl-10 pr-3 py-3 rounded-[10px] border border-border bg-surface-2 text-text placeholder-text-muted focus:outline-none focus:border-accent min-h-[44px]"
            />
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text-muted block">
              Password
            </label>
            {!isSignUp && (
              <button
                type="button"
                onClick={() => setForgotNotice(true)}
                className="text-xs text-text-muted hover:text-link transition-colors"
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-text-muted" strokeWidth={1.75} />
            <input
              type="password"
              required
              minLength={isSignUp ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? 'At least 8 characters' : '••••••••'}
              style={{ fontSize: '16px' }}
              className="w-full pl-10 pr-3 py-3 rounded-[10px] border border-border bg-surface-2 text-text placeholder-text-muted focus:outline-none focus:border-accent min-h-[44px]"
            />
          </div>
        </div>

        {/* ONE PRIMARY BUTTON */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full text-sm disabled:opacity-50"
        >
          <span>{isSignUp ? 'Create account' : 'Sign in'}</span>
          <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </form>

      {/* Switch between Login and Sign Up */}
      <div className="text-center pt-3">
        {isSignUp ? (
          <p className="text-xs text-text-muted">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setErrorMessage(null);
              }}
              className="font-bold text-link hover:underline cursor-pointer"
            >
              Sign in
            </button>
          </p>
        ) : (
          <p className="text-xs text-text-muted">
            New pilot?{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setErrorMessage(null);
              }}
              className="font-bold text-link hover:underline cursor-pointer"
            >
              Create account
            </button>
          </p>
        )}
      </div>

      {/* Guest alternative */}
      <div className="text-center pt-3 border-t border-border mt-3">
        <button
          type="button"
          onClick={handleGuestClick}
          className="text-xs text-text-muted hover:text-link font-medium underline underline-offset-4 cursor-pointer min-h-[44px] inline-flex items-center"
        >
          Try a lesson as guest without an account
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
