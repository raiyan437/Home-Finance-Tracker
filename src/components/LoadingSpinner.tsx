import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading data...',
  fullScreen = false,
}) => {
  const content = (
    <div className="loading-content" role="status" aria-live="polite">
      <div className="spinner-ring">
        <div className="spinner-core" />
      </div>
      {message && (
        <span className="loading-message">
          {message}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loading-fullscreen">
        {content}
      </div>
    );
  }

  return content;
};
