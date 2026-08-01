import React, { useState } from 'react';
import { LiquidMetal } from '@paper-design/shaders-react';

export interface LiquidMetalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  borderWidth?: number;
  colorBack?: string;
  colorTint?: string;
  speed?: number;
  repetition?: number;
  distortion?: number;
  scale?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const LiquidMetalButton: React.FC<LiquidMetalButtonProps> = ({
  children,
  icon,
  borderWidth = 3,
  colorBack = '#888888',
  colorTint = '#ffffff',
  speed = 0.5,
  repetition = 4,
  distortion = 0.2,
  scale = 1,
  size = 'md',
  className = '',
  style = {},
  disabled,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const sizePadding = {
    sm: '6px 14px',
    md: '10px 22px',
    lg: '14px 28px',
  };

  const fontSize = {
    sm: '0.82rem',
    md: '0.92rem',
    lg: '1.05rem',
  };

  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`liquid-metal-btn ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${borderWidth}px`,
        borderRadius: '9999px',
        overflow: 'hidden',
        border: 'none',
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease',
        transform: isHovered && !disabled ? 'translateY(-2px) scale(1.02)' : 'none',
        boxShadow: isHovered && !disabled
          ? '0 12px 35px -6px rgba(255, 255, 255, 0.35), 0 0 25px rgba(228, 228, 231, 0.5)'
          : '0 4px 14px rgba(0, 0, 0, 0.2)',
        ...style,
      }}
      {...props}
    >
      {/* Rotating Rainbow Neon Border Overlay on Hover */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '9999px',
          padding: `${borderWidth}px`,
          background: 'conic-gradient(from var(--rotating-border-angle, 0deg), #3b82f6, #8b5cf6, #ec4899, #f43f5e, #f59e0b, #10b981, #06b6d4, #3b82f6)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          opacity: isHovered ? 1 : 0.4,
          transition: 'opacity 0.35s ease',
          pointerEvents: 'none',
          zIndex: 1,
          animation: isHovered ? 'spinRotatingBorder 2s linear infinite' : 'none',
        }}
      />

      {/* Liquid Metal Shader Canvas Background / Border */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '9999px',
          overflow: 'hidden',
          opacity: isHovered ? 1 : 0.45,
          transition: 'opacity 0.4s ease',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <LiquidMetal
          colorBack={colorBack}
          colorTint={colorTint}
          speed={isHovered ? speed * 1.8 : speed * 0.4}
          repetition={repetition}
          distortion={distortion}
          softness={0}
          shiftRed={0.3}
          shiftBlue={-0.3}
          angle={45}
          shape="none"
          scale={scale}
          fit="cover"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Inner Button Body */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          borderRadius: '9999px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: sizePadding[size],
          fontSize: fontSize[size],
          fontWeight: 800,
          background: isHovered ? 'rgba(18, 18, 20, 0.88)' : 'rgba(24, 24, 27, 0.95)',
          color: '#ffffff',
          backdropFilter: 'blur(12px)',
          transition: 'background 0.3s ease, color 0.3s ease',
          width: '100%',
          justifyContent: 'center',
        }}
      >
        {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
        <span>{children}</span>
      </div>
    </button>
  );
};

export default LiquidMetalButton;
