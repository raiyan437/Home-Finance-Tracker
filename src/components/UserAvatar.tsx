import React from 'react';
import type { User } from '../types';

interface UserAvatarProps {
  user?: User | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 42, className = '', style = {} }) => {
  const safeUser = user || { name: 'User', avatar: undefined, color: '#3b82f6' };
  const isImage =
    typeof safeUser.avatar === 'string' &&
    (safeUser.avatar.startsWith('data:') || safeUser.avatar.startsWith('http'));

  const initial = (safeUser.name?.trim().charAt(0) || 'U').toUpperCase();

  return (
    <div
      className={`avatar-badge-large ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: safeUser.color || '#3b82f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        color: 'white',
        fontSize: `${size * 0.42}px`,
        overflow: 'hidden',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
        border: '2px solid rgba(255, 255, 255, 0.15)',
        flexShrink: 0,
        ...style,
      }}
    >
      {isImage ? (
        <img
          src={safeUser.avatar}
          alt={safeUser.name || 'Avatar'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        initial
      )}
    </div>
  );
};
