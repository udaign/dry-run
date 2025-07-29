
import React, { useRef, useState } from 'react';
import { Theme, PhotoWidgetOutputMode } from './types';

export const Dropzone: React.FC<{ onFileSelect: (file: File) => void; isLoading: boolean; compact?: boolean; theme: Theme; accept?: string; }> = ({ onFileSelect, isLoading, compact = false, theme, accept = "image/*" }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = (file: File | undefined | null) => {
        if (file && (accept === "image/*" || accept.includes(file.type))) {
            onFileSelect(file);
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
        handleFile(file);
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        handleFile(file);
        if (event.target) {
            event.target.value = '';
        }
    };

    const dropzoneClasses = isDragging
        ? (theme === 'dark' ? 'border-white bg-nothing-gray-dark' : 'border-black bg-day-gray-light')
        : (theme === 'dark' ? 'border-gray-600 bg-transparent hover:border-gray-400' : 'border-gray-400 bg-transparent hover:border-gray-600');


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
                        <p className={`text-xl font-semibold ${theme === 'dark' ? 'text-nothing-light' : 'text-day-text'}`}>Drag & Drop Image Here</p>
                        <p className="text-sm">or click to browse</p>
                        {accept === "image/png" && <p className="text-xs mt-1">(accepts PNG files only)</p>}
                    </>
                )}
            </div>
        </div>
    );
};

export const EnhancedSlider: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  onChangeCommitted: (value: number) => void;
  onReset: () => void;
  disabled?: boolean;
  theme: Theme;
  isMobile: boolean;
}> = ({ label, value, onChange, onChangeCommitted, onReset, disabled, theme, isMobile }) => {
    const handleCommit = (val: number) => {
        const clampedValue = Math.max(0, Math.min(100, val));
        onChange(clampedValue);
        onChangeCommitted(clampedValue);
    };

    const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numValue = parseInt(e.target.value, 10);
        onChange(isNaN(numValue) ? 0 : numValue);
    };

    const handleNumberInputBlur = () => {
        handleCommit(value);
    };
    
    return (
        <div className={`${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} space-y-2`}>
            <label htmlFor={label} className="text-sm">{label}</label>
            <div className="flex items-center space-x-3">
                <input
                    id={label}
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
                <input
                    type="number"
                    min="0"
                    max="100"
                    value={value.toString()}
                    onChange={handleNumberInputChange}
                    onBlur={handleNumberInputBlur}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                        }
                    }}
                    disabled={disabled}
                    className={`w-16 text-center p-1 font-sans text-sm rounded-md focus:outline-none focus:ring-2 ${theme === 'dark' ? 'bg-nothing-gray-dark text-nothing-light focus:ring-white' : 'bg-day-gray-light text-day-text focus:ring-black'}`}
                />
                <button onClick={onReset} disabled={disabled} className={`${theme === 'dark' ? 'text-nothing-gray-light hover:text-white disabled:hover:text-nothing-gray-light' : 'text-day-gray-dark hover:text-black disabled:hover:text-day-gray-dark'} transition-colors disabled:opacity-50`} aria-label={`Reset ${label}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
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
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
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
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <polyline points="15 14 20 9 15 4"></polyline>
        <path d="M4 20v-7a4 4 0 0 1 4-4h12"></path>
      </svg>
    </button>
  </div>
);

export const ColorSelector: React.FC<{
    options: { [key: string]: { color: string; name: string } };
    selected: string;
    onSelect: (key: string) => void;
    theme: Theme;
}> = ({ options, selected, onSelect, theme }) => {
    const baseButtonClasses = `w-1/2 py-2 text-sm font-semibold transition-colors duration-200 focus:outline-none rounded-md flex items-center justify-center space-x-2`;
    const selectedClasses = theme === 'dark' ? 'bg-nothing-light text-nothing-dark font-bold' : 'bg-day-text text-day-bg font-bold';
    const unselectedClasses = theme === 'dark' ? 'bg-nothing-gray-dark hover:bg-gray-700 text-nothing-light' : 'bg-day-gray-light hover:bg-gray-300 text-day-text';

    return (
        <div className={`flex space-x-1 p-1 rounded-lg ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-gray-200'}`}>
            {Object.entries(options).map(([key, { name, color }]) => (
                <button
                    key={key}
                    onClick={() => onSelect(key)}
                    className={`${baseButtonClasses} ${selected === key ? selectedClasses : unselectedClasses}`}
                    aria-label={`Select background color ${name}`}
                    aria-pressed={selected === key}
                >
                    <span style={{ backgroundColor: color }} className={`w-4 h-4 rounded-full border ${key === 'white' ? 'border-gray-400' : 'border-transparent'}`}></span>
                    <span className={`text-sm font-medium`}>{name}</span>
                </button>
            ))}
        </div>
    );
};

export const WallpaperTypeSelector: React.FC<{
    selected: 'phone' | 'desktop';
    onSelect: (type: 'phone' | 'desktop') => void;
    theme: Theme;
}> = ({ selected, onSelect, theme }) => {
    const baseButtonClasses = `w-1/2 py-2 text-sm font-semibold transition-colors duration-200 focus:outline-none rounded-md`;
    const selectedClasses = theme === 'dark' ? 'bg-nothing-light text-nothing-dark font-bold' : 'bg-day-text text-day-bg font-bold';
    const unselectedClasses = theme === 'dark' ? 'bg-nothing-gray-dark hover:bg-gray-700 text-nothing-light' : 'bg-day-gray-light hover:bg-gray-300 text-day-text';

    return (
        <div className={`flex space-x-2 p-1 rounded-lg ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-gray-200'}`}>
            <button
                onClick={() => onSelect('phone')}
                className={`${baseButtonClasses} ${selected === 'phone' ? selectedClasses : unselectedClasses}`}
                aria-pressed={selected === 'phone'}
            >
                Phone
            </button>
            <button
                onClick={() => onSelect('desktop')}
                className={`${baseButtonClasses} ${selected === 'desktop' ? selectedClasses : unselectedClasses}`}
                aria-pressed={selected === 'desktop'}
            >
                Desktop
            </button>
        </div>
    );
};

export const OutputModeSelector: React.FC<{
    selected: PhotoWidgetOutputMode;
    onSelect: (mode: PhotoWidgetOutputMode) => void;
    theme: Theme;
}> = ({ selected, onSelect, theme }) => {
    const baseButtonClasses = `w-1/3 py-2 text-sm font-semibold transition-colors duration-200 focus:outline-none rounded-md`;
    const selectedClasses = theme === 'dark' ? 'bg-nothing-light text-nothing-dark font-bold' : 'bg-day-text text-day-bg font-bold';
    const unselectedClasses = theme === 'dark' ? 'bg-nothing-gray-dark hover:bg-gray-700 text-nothing-light' : 'bg-day-gray-light hover:bg-gray-300 text-day-text';
    const modes: { key: PhotoWidgetOutputMode, name: string }[] = [
        { key: 'transparent', name: 'Transparent' },
        { key: 'dark', name: 'Dark' },
        { key: 'light', name: 'Light' },
    ];

    return (
        <div className={`flex space-x-1 p-1 rounded-lg ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-gray-200'}`}>
            {modes.map(mode => (
                <button
                    key={mode.key}
                    onClick={() => onSelect(mode.key)}
                    className={`${baseButtonClasses} ${selected === mode.key ? selectedClasses : unselectedClasses}`}
                    aria-pressed={selected === mode.key}
                >
                    {mode.name}
                </button>
            ))}
        </div>
    );
};