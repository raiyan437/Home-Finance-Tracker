import React from 'react';
import type { User } from '../types';

interface UserAvatarProps {
  user: User;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 42, className = '', style = {} }) => {
  const isImage = user.avatar.startsWith('/') || user.avatar.startsWith('http') || user.avatar.endsWith('.png') || user.avatar.endsWith('.jpg');

  return (
    <div
      className={`avatar-badge-large ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: user.color,
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
          src={user.avatar}
          alt={user.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        user.avatar
      )}
    </div>
  );
};
