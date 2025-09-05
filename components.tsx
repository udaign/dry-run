
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Theme, PhotoWidgetOutputMode, Tab } from './types';
import { trackEvent } from './analytics';

export const Dropzone: React.FC<{ onFileSelect: (file: File, method: 'drag_drop' | 'click') => void; isLoading: boolean; compact?: boolean; theme: Theme; accept?: string; context?: Tab; }> = ({ onFileSelect, isLoading, compact = false, theme, accept = "image/*", context }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = (file: File | undefined | null, method: 'drag_drop' | 'click') => {
        if (file && (accept === "image/*" || accept.includes(file.type))) {
            onFileSelect(file, method);
        } else if (file) {
            trackEvent('upload_error', {
                feature: context,
                reason: 'unsupported_file_type',
                file_type: file.type
            });
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        handleFile(file, 'drag_drop');
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        handleFile(file, 'click');
        if (event.target) {
            event.target.value = '';
        }
    };

    const dropzoneClasses = isDragging
        ? (theme === 'dark' ? 'border-white bg-nothing-gray-dark' : 'border-black bg-day-gray-light')
        : (theme === 'dark' ? 'border-gray-600 bg-transparent hover:border-gray-400' : 'border-gray-400 bg-transparent hover:border-gray-600');

    const dropTexts = {
        pfp: {
            bold: "Drag & Drop or Click",
            normal: "to load a profile picture",
        },
        wallpaper: {
            bold: "Drag & Drop or Click",
            normal: "to load a wallpaper",
        },
        photoWidget: {
            bold: "Drag & Drop or Click",
            normal: "to load a PNG image",
        },
        valueAliasing: {
            bold: "Drag & Drop or Click",
            normal: "to load an image",
        },
    };

    const currentTexts = context && dropTexts[context] 
        ? dropTexts[context] 
        : { bold: "Drag & Drop Image Here", normal: "or click to browse" };

    return (
        <div
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            className={`w-full ${!compact ? 'flex-grow' : ''} text-center border-2 border-dashed cursor-pointer transition-colors duration-300 flex items-center justify-center rounded-lg ${compact ? 'py-4' : ''} ${dropzoneClasses}`}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleInputChange}
                accept={accept}
                className="hidden"
            />
            <div className={`flex flex-col items-center justify-center space-y-2 ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                 {compact ? (
                    <p className="text-md font-semibold">Replace Image</p>
                ) : (
                    <>
                        <span className="text-6xl" role="img" aria-label="Folder icon">📁</span>
                        <p className={`text-xl font-semibold ${theme === 'dark' ? 'text-nothing-light' : 'text-day-text'}`}>{currentTexts.bold}</p>
                        <p className="text-sm">{currentTexts.normal}</p>
                        <p className="text-xs mt-1">(all image processing happens locally)</p>
                    </>
                )}
            </div>
        </div>
    );
};

export const EnhancedSlider: React.FC<{
  label: string;
  labelPrefix?: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  onChangeCommitted: (value: number) => void;
  onReset: () => void;
  disabled?: boolean;
  theme: Theme;
  isMobile: boolean;
}> = ({ label, labelPrefix, value, onChange, onChangeCommitted, onReset, disabled, theme, isMobile }) => {
    const handleCommit = (val: number) => {
        const clampedValue = Math.max(0, Math.min(100, val));
        onChange(clampedValue);
        onChangeCommitted(clampedValue);
    };
    
    const inputId = `slider-${label.replace(/\s+/g, '-')}`;

    return (
        <div className={`${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} space-y-2`}>
            <label htmlFor={inputId} className="text-sm">{labelPrefix}{label}</label>
            <div className="flex items-center space-x-3">
                <input
                    id={inputId}
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    onMouseUp={() => handleCommit(value)}
                    onTouchEnd={() => handleCommit(value)}
                    disabled={disabled}
                    className={`w-full h-2 appearance-none cursor-pointer disabled:opacity-50 rounded-lg ${theme === 'dark' ? 'bg-nothing-gray-dark accent-white' : 'bg-day-gray-light accent-black'} ${isMobile ? 'touch-none' : ''}`}
                />
                <div className="w-16 text-center font-sans text-sm font-semibold tabular-nums">
                    {value}
                </div>
                <button
                  onClick={() => {
                    trackEvent('reset_single_control', { control_name: label });
                    onReset();
                  }}
                  disabled={disabled}
                  className={`${theme === 'dark' ? 'text-nothing-gray-light hover:text-white disabled:hover:text-nothing-gray-light' : 'text-day-gray-dark hover:text-black disabled:hover:text-day-gray-dark'} transition-colors disabled:opacity-50`}
                  aria-label={`Reset ${label}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export const UndoRedoControls: React.FC<{ onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean; theme: Theme }> = ({ onUndo, onRedo, canUndo, canRedo, theme }) => (
  <div className="flex items-center justify-center space-x-4">
    <button
      onClick={onUndo}
      disabled={!canUndo}
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md ${theme === 'dark' ? 'bg-gray-700 text-nothing-light hover:bg-gray-600 disabled:hover:bg-gray-700' : 'bg-gray-200 text-day-text hover:bg-gray-300 disabled:hover:bg-gray-200'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <polyline points="9 14 4 9 9 4"></polyline>
        <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
      </svg>
      <span>Undo</span>
    </button>
    <button
      onClick={onRedo}
      disabled={!canRedo}
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md ${theme === 'dark' ? 'bg-gray-700 text-nothing-light hover:bg-gray-600 disabled:hover:bg-gray-700' : 'bg-gray-200 text-day-text hover:bg-gray-300 disabled:hover:bg-gray-200'}`}
    >
      <span>Redo</span>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <polyline points="15 14 20 9 15 4"></polyline>
        <path d="M4 20v-7a4 4 0 0 1 4-4h12"></path>
      </svg>
    </button>
  </div>
);

export const ToggleSwitch: React.FC<{
    leftLabel: string;
    rightLabel: string;
    isChecked: boolean; // Corresponds to the right label being active
    onToggle: () => void;
    theme: Theme;
    id: string;
}> = ({ leftLabel, rightLabel, isChecked, onToggle, theme, id }) => {
    return (
        <div className="flex items-center justify-between w-full">
            <label htmlFor={id} className={`text-sm font-normal transition-colors cursor-pointer ${!isChecked ? (theme === 'dark' ? 'text-nothing-light' : 'text-day-text') : (theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark')}`}>
                {leftLabel}
            </label>
            <button 
                id={id}
                role="switch" 
                aria-checked={isChecked} 
                onClick={onToggle} 
                className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light'}`}
                aria-label={`Switch between ${leftLabel} and ${rightLabel}, current is ${isChecked ? rightLabel : leftLabel}`}
            >
                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isChecked ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <label htmlFor={id} className={`text-sm font-normal transition-colors cursor-pointer ${isChecked ? (theme === 'dark' ? 'text-nothing-light' : 'text-day-text') : (theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark')}`}>
                {rightLabel}
            </label>
        </div>
    );
};

export const SegmentedControl: React.FC<{
    options: { key: string; label: React.ReactNode }[];
    selected: string;
    onSelect: (key: string) => void;
    theme: Theme;
}> = ({ options, selected, onSelect, theme }) => {
    const baseButtonClasses = `w-1/2 py-2 text-sm font-semibold transition-colors duration-200 focus:outline-none rounded-md flex items-center justify-center space-x-2`;
    const selectedClasses = theme === 'dark' ? 'bg-nothing-light text-nothing-dark font-bold' : 'bg-day-text text-day-bg font-bold';
    const unselectedClasses = theme === 'dark' ? 'bg-nothing-gray-dark hover:bg-gray-700 text-nothing-light' : 'bg-day-gray-light hover:bg-gray-300 text-day-text';

    return (
        <div className={`flex space-x-1 p-1 rounded-lg ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-gray-200'}`}>
            {options.map(option => (
                <button
                    key={option.key}
                    onClick={() => onSelect(option.key)}
                    className={`${baseButtonClasses} ${selected === option.key ? selectedClasses : unselectedClasses}`}
                    aria-pressed={selected === option.key}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};

export const ToastNotification: React.FC<{
  show: boolean;
  onClose: () => void;
  theme: Theme;
  isMobile: boolean;
  imageRendered: boolean;
  className?: string;
}> = ({ show, onClose, theme, isMobile, imageRendered, className = '' }) => {
  const SHARE_LINK = "https://nothing.community/d/38047-introducing-matrices-a-handy-utility-to-create-matrix-styled-imagery";

  const mobileBottomOffset = imageRendered ? 'bottom-20' : 'bottom-4';

  const containerClasses = isMobile
    ? `fixed inset-x-4 ${mobileBottomOffset}`
    : 'absolute bottom-8 right-8 w-full max-w-sm';

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef(0);

  const timerRef = useRef<number | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      trackEvent('toast_dismiss', { method: 'timeout' });
      onClose();
    }, 7000);
  }, [onClose]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (show) {
      startTimer();
    } else {
      clearTimer();
    }
    return () => {
      clearTimer();
    };
  }, [show, startTimer, clearTimer]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    clearTimer();
    touchStartRef.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || !isSwiping) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current;
    if (deltaX > 0) { // Only allow swiping to the right
      setSwipeOffset(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile) return;
    setIsSwiping(false);
    if (swipeOffset > 100) { // Dismiss threshold
      trackEvent('toast_dismiss', { method: 'swipe' });
      onClose();
    } else {
      setSwipeOffset(0);
      startTimer();
    }
  };
  
  useEffect(() => {
    if (!show) {
      // Allow exit animation to complete before resetting swipe position
      setTimeout(() => {
        setSwipeOffset(0);
      }, 500);
    }
  }, [show]);

  return (
    <div
      aria-live="polite"
      className={`z-50 transition-all duration-500 ease-in-out ${containerClasses} ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
      } ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${swipeOffset}px)`,
        transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
      }}
    >
      <div
        className={`relative w-full rounded-lg shadow-2xl p-4 ${
          theme === 'dark' ? 'bg-nothing-gray-dark text-nothing-light' : 'bg-white text-day-text border border-gray-200'
        }`}
      >
        <div className="flex items-center space-x-4 md:flex-col md:items-stretch md:space-y-3 md:space-x-0">
          <div className="flex-grow">
            <p className="font-semibold">You seem to love it?!</p>
            <p className={`text-sm ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
              Help spread the word. Share it to the community thread.
            </p>
          </div>

          <div className="flex-shrink-0">
            <a
              href={SHARE_LINK}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent('share_community_toast_click');
                onClose();
              }}
              className={`block w-full text-center px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                theme === 'dark' ? 'bg-nothing-light text-nothing-dark hover:bg-opacity-90' : 'bg-day-text text-day-bg hover:bg-opacity-90'
              }`}
            >
              Share Now
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};