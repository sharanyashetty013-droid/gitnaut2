import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  BookOpen, 
  Gamepad2, 
  Layers, 
  Flame, 
  User, 
  LogOut, 
  RotateCcw, 
  Compass,
  Sparkles,
  LogIn
} from 'lucide-react';
import { UserProfile, logoutUser } from '../utils/auth';
import { getAggregatedStats, subscribeToActivity } from '../utils/activityEvents';
import { playSound, isSoundEnabled, setSoundEnabled } from '../utils/sound';

interface HeaderProps {
  currentView: 'learn' | 'practice' | 'cheatsheet' | 'admin';
  practiceSubTab?: 'campaign' | 'arcade' | 'sandbox';
  currentUser: UserProfile | null;
  onNavigateLearn: () => void;
  onNavigatePractice: (subTab?: 'campaign' | 'arcade' | 'sandbox') => void;
  onNavigateCheatSheet: () => void;
  onNavigateAdmin: () => void;
  onResetProgress: () => void;
  onOpenSettings?: () => void;
  onOpenAuth: () => void;
  onUserLoggedOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  currentUser,
  onNavigateLearn,
  onNavigatePractice,
  onNavigateCheatSheet,
  onResetProgress,
  onOpenSettings,
  onOpenAuth,
  onUserLoggedOut,
}) => {
  const [sound, setSound] = useState(() => isSoundEnabled());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [stats, setStats] = useState(() => getAggregatedStats());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToActivity(() => {
      setStats(getAggregatedStats());
    });
    return unsub;
  }, []);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  const handleToggleSound = () => {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) playSound('click');
  };

  const handleLogout = () => {
    logoutUser();
    setIsUserMenuOpen(false);
    onUserLoggedOut();
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-surface border-b border-border transition-colors overflow-x-hidden">
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 min-w-0">
        {/* Left: Brand Logo */}
        <button
          onClick={() => {
            playSound('click');
            onNavigateLearn();
          }}
          className="flex items-center gap-2 text-left transition-opacity hover:opacity-90 focus:outline-none shrink-0 cursor-pointer min-h-[44px]"
          aria-label="Gitnaut home"
        >
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-ink shadow-xs shrink-0">
            <Compass className="w-5 h-5 text-accent-ink" strokeWidth={1.75} />
          </div>
          <span className="font-heading font-bold text-lg sm:text-xl text-text tracking-normal leading-tight">
            Gitnaut
          </span>
        </button>

        {/* Center: Desktop Top Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-semibold h-16">
          {[
            { id: 'learn', label: 'Learn', icon: BookOpen, action: onNavigateLearn },
            { id: 'practice', label: 'Practice', icon: Gamepad2, action: () => onNavigatePractice() },
            { id: 'cheatsheet', label: 'Cheat sheet', icon: Layers, action: onNavigateCheatSheet },
          ].map((tab) => {
            const isActive = currentView === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  playSound('click');
                  tab.action();
                }}
                className={`h-full px-4 flex items-center gap-2 border-b-2 font-semibold transition-colors cursor-pointer min-h-[44px] ${
                  isActive
                    ? 'border-accent text-accent font-bold'
                    : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                <Icon className="w-4 h-4 text-current" strokeWidth={1.75} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Area */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0" ref={menuRef}>
          {/* Direct Exit button for ANY pilot (Named or Guest) */}
          <button
            onClick={handleLogout}
            className="text-xs font-semibold text-danger hover:text-danger/90 bg-danger/10 hover:bg-danger/20 border border-danger/30 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-[8px] cursor-pointer min-h-[36px] sm:min-h-[40px] flex items-center gap-1.5 transition-colors"
            title="Exit flight deck and return to 1st page"
            aria-label="Exit flight deck"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>

          {/* Audio toggle */}
          <button
            onClick={handleToggleSound}
            className="flex min-w-[36px] sm:min-w-[40px] min-h-[36px] sm:min-h-[40px] items-center justify-center rounded-[10px] border border-border bg-surface-2 hover:bg-border text-text-muted hover:text-text transition-colors cursor-pointer"
            title={sound ? 'Mute sound effects' : 'Enable sound effects'}
            aria-label="Toggle sound"
          >
            {sound ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-current" strokeWidth={1.75} /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-current" strokeWidth={1.75} />}
          </button>

          {/* Avatar & Account Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="min-h-[36px] sm:min-h-[40px] flex items-center justify-center px-2 sm:px-3 py-1 rounded-[10px] border border-border bg-surface-2 hover:bg-border text-xs sm:text-sm font-semibold text-text cursor-pointer transition-colors gap-1.5 sm:gap-2 max-w-[130px] sm:max-w-[180px]"
              aria-label="User account menu"
            >
              {currentUser ? (
                <>
                  <span className="inline-block truncate max-w-[65px] sm:max-w-[110px] text-xs sm:text-sm">{currentUser.displayName}</span>
                  <span className="w-6 h-6 rounded-[8px] bg-accent text-accent-ink flex items-center justify-center font-bold text-xs shrink-0">
                    <User className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.75} />
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs sm:text-sm font-medium text-text-muted">Guest</span>
                  <span className="w-6 h-6 rounded-[8px] bg-surface border border-border flex items-center justify-center text-text-muted shrink-0">
                    <User className="w-3.5 h-3.5 text-current" strokeWidth={1.75} />
                  </span>
                </>
              )}
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-surface border border-border rounded-[12px] shadow-xl p-2 space-y-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2.5 border-b border-border">
                  <div className="font-bold text-sm text-text truncate">
                    {currentUser?.displayName || 'Cadet Explorer'}
                  </div>
                  <div className="text-xs text-text-muted truncate">
                    {currentUser?.displayName?.toLowerCase() === 'guest' ? 'Guest Explorer Session' : currentUser?.email}
                  </div>
                  <div className="text-xs text-accent font-semibold mt-1">
                    Mastered: {stats.masteredCount} of 37 Commands
                  </div>
                </div>

                {/* When in guest mode: highlight Set Callsign & Exit Guest */}
                {currentUser?.displayName?.toLowerCase() === 'guest' ? (
                  <>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        if (onOpenSettings) onOpenSettings();
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm font-bold text-accent hover:bg-surface-2 rounded-[10px] flex items-center gap-2 min-h-[44px] cursor-pointer transition-colors"
                    >
                      <User className="w-4 h-4 text-accent" strokeWidth={2} />
                      <span>Enter your pilot name</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2.5 text-sm font-semibold text-danger hover:bg-surface-2 rounded-[10px] flex items-center gap-2 min-h-[44px] cursor-pointer transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-danger" strokeWidth={2} />
                      <span>Exit Guest mode (1st page)</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Change callsign / Settings */}
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        if (onOpenSettings) {
                          onOpenSettings();
                        } else {
                          onResetProgress();
                        }
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-text hover:bg-surface-2 rounded-[10px] flex items-center gap-2 min-h-[44px] cursor-pointer transition-colors"
                    >
                      <User className="w-4 h-4 text-link" strokeWidth={1.75} />
                      <span>Change callsign / settings</span>
                    </button>

                    {/* Exit to 1st page */}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2.5 text-sm font-semibold text-danger hover:bg-surface-2 rounded-[10px] flex items-center gap-2 min-h-[44px] cursor-pointer transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-danger" strokeWidth={1.75} />
                      <span>Exit to 1st page</span>
                    </button>
                  </>
                )}

                {/* Mobile: Sound Toggle inside Menu */}
                <button
                  onClick={handleToggleSound}
                  className="w-full text-left px-3 py-2.5 text-sm text-text hover:bg-surface-2 rounded-[10px] flex items-center justify-between min-h-[44px] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {sound ? <Volume2 className="w-4 h-4 text-accent" strokeWidth={1.75} /> : <VolumeX className="w-4 h-4 text-text-muted" strokeWidth={1.75} />}
                    <span>Sound Effects</span>
                  </div>
                  <span className="text-sm font-bold text-accent">{sound ? 'ON' : 'OFF'}</span>
                </button>

                {/* Reset progress */}
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onResetProgress();
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-text-muted hover:text-text hover:bg-surface-2 rounded-[10px] flex items-center gap-2 min-h-[44px] cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-current" strokeWidth={1.75} />
                  <span>Reset progress</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
