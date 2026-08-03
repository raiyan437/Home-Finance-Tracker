import React from 'react';
import { Moon, Sun } from 'lucide-react';

interface ThemeSwitchProps {
  theme: 'dark' | 'light';
  onToggle: () => void;
  className?: string;
}

export const ThemeSwitch: React.FC<ThemeSwitchProps> = ({ theme, onToggle, className = '' }) => {
  const isDark = theme === 'dark';
  const nextTheme = isDark ? 'light' : 'dark';

  return (
    <button
      type="button"
      className={`theme-switch ${isDark ? 'is-dark' : 'is-light'} ${className}`.trim()}
      onClick={onToggle}
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <span className="theme-switch__thumb" aria-hidden="true" />
      <span className="theme-switch__icon theme-switch__icon--sun" aria-hidden="true">
        <Sun size={17} strokeWidth={2.4} />
      </span>
      <span className="theme-switch__icon theme-switch__icon--moon" aria-hidden="true">
        <Moon size={16} strokeWidth={2.5} />
      </span>
    </button>
  );
};
