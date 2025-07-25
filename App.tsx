
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';

const CANVAS_SIZE = 1176;
const PADDING = 50;
const DEFAULT_SLIDER_VALUE = 50;
const NOTHING_DARK_COLOR = '#000000';
const WALLPAPER_PHONE_WIDTH = 1084;
const WALLPAPER_PHONE_HEIGHT = 2412;
const WALLPAPER_DESKTOP_WIDTH = 3840;
const WALLPAPER_DESKTOP_HEIGHT = 2160;
const WALLPAPER_BG_OPTIONS = {
    'black': { color: '#000000', name: 'Pure Black' },
    'white': { color: '#FFFFFF', name: 'Pure White' },
    'nothing-dark': { color: '#1b1b1b', name: 'Nothing Dark' },
    'nothing-light': { color: '#f1f0f1', name: 'Nothing White' },
};

type RawPixel = number | { r: number, g: number, b: number };
type Theme = 'light' | 'dark';
type WallpaperBgKey = keyof typeof WALLPAPER_BG_OPTIONS;

const getTimestamp = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
};

const useHistory = <T,>(initialState: T) => {
    const [history, setHistory] = useState<T[]>([initialState]);
    const [index, setIndex] = useState(0);

    const setState = useCallback((action: React.SetStateAction<T>) => {
        const resolvedState = typeof action === 'function' 
            ? (action as (prevState: T) => T)(history[index]) 
            : action;

        if (JSON.stringify(resolvedState) === JSON.stringify(history[index])) {
            return;
        }
        
        const newHistory = history.slice(0, index + 1);
        newHistory.push(resolvedState);
        setHistory(newHistory);
        setIndex(newHistory.length - 1);
    }, [history, index]);

    const undo = useCallback(() => {
        if (index > 0) {
            setIndex(index - 1);
        }
    }, [index]);

    const redo = useCallback(() => {
        if (index < history.length - 1) {
            setIndex(index + 1);
        }
    }, [index, history.length]);
    
    const reset = useCallback(() => {
        const newHistory = history.slice(0, index + 1);
        newHistory.push(initialState);
        setHistory(newHistory);
        setIndex(newHistory.length - 1);
    }, [initialState, history, index]);

    return {
        state: history[index],
        setState,
        undo,
        redo,
        reset,
        canUndo: index > 0,
        canRedo: index < history.length - 1,
    };
};


const Dropzone: React.FC<{ onFileSelect: (file: File) => void; isLoading: boolean; compact?: boolean; theme: Theme; }> = ({ onFileSelect, isLoading, compact = false, theme }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = (file: File | undefined | null) => {
        if (file && file.type.startsWith('image/')) {
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
                accept="image/*"
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
                    </>
                )}
            </div>
        </div>
    );
};

const EnhancedSlider: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  onChangeCommitted: (value: number) => void;
  onReset: () => void;
  disabled?: boolean;
  theme: Theme;
}> = ({ label, value, onChange, onChangeCommitted, onReset, disabled, theme }) => {
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
                    className={`w-full h-2 appearance-none cursor-pointer disabled:opacity-50 rounded-lg ${theme === 'dark' ? 'bg-nothing-gray-dark accent-white' : 'bg-day-gray-light accent-black'}`}
                />
                <input
                    type="number"
                    min="0"
                    max="100"
                    value={value.toString()}
                    onChange={handleNumberInputChange}
                    onBlur={handleNumberInputBlur}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                        }
                    }}
                    disabled={disabled}
                    className={`w-16 text-center p-1 font-sans text-sm rounded-md focus:outline-none focus:ring-2 ${theme === 'dark' ? 'bg-nothing-gray-dark text-nothing-light focus:ring-white' : 'bg-day-gray-light text-day-text focus:ring-black'}`}
                />
                <button onClick={onReset} disabled={disabled} className={`${theme === 'dark' ? 'text-nothing-gray-light hover:text-white disabled:hover:text-nothing-gray-light' : 'text-day-gray-dark hover:text-black disabled:hover:text-day-gray-dark'} transition-colors disabled:opacity-50`} aria-label={`Reset ${label}`}>
                    <span className="text-xl" role="img" aria-label="reset">🔄</span>
                </button>
            </div>
        </div>
    );
};


const UndoRedoControls: React.FC<{ onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean; theme: Theme }> = ({ onUndo, onRedo, canUndo, canRedo, theme }) => (
  <div className="flex items-center justify-center space-x-4">
    <button
      onClick={onUndo}
      disabled={!canUndo}
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md ${theme === 'dark' ? 'bg-gray-700 text-nothing-light hover:bg-gray-600 disabled:hover:bg-gray-700' : 'bg-gray-200 text-day-text hover:bg-gray-300 disabled:hover:bg-gray-200'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8a5 5 0 010 10H9" /></svg>
      <span>Undo</span>
    </button>
    <button
      onClick={onRedo}
      disabled={!canRedo}
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md ${theme === 'dark' ? 'bg-gray-700 text-nothing-light hover:bg-gray-600 disabled:hover:bg-gray-700' : 'bg-gray-200 text-day-text hover:bg-gray-300 disabled:hover:bg-gray-200'}`}
    >
      <span>Redo</span>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8a5 5 0 000 10h1" /></svg>
    </button>
  </div>
);

const ColorSelector: React.FC<{
    options: { [key: string]: { color: string; name: string } };
    selected: string;
    onSelect: (key: string) => void;
    theme: Theme;
    label: string;
}> = ({ options, selected, onSelect, theme, label }) => {
    return (
        <div className="space-y-2">
            <label className={`text-sm ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>{label}</label>
            <div className="grid grid-cols-2 gap-2 pt-2">
                {Object.entries(options).map(([key, { color, name }]) => (
                    <button
                        key={key}
                        onClick={() => onSelect(key)}
                        className={`flex items-center space-x-2 p-2 border-2 transition-all duration-200 focus:outline-none rounded-md ${
                            selected === key
                                ? (theme === 'dark' ? 'border-white' : 'border-black')
                                : (theme === 'dark' ? 'border-gray-800 hover:border-gray-600' : 'border-gray-300 hover:border-gray-400')
                        }`}
                        aria-label={`Select background color ${name}`}
                        aria-pressed={selected === key}
                    >
                        <div
                            className={`w-6 h-6 border rounded-full ${color === '#FFFFFF' || color === '#f1f0f1' ? 'border-gray-400' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                        ></div>
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-nothing-light' : 'text-day-text'}`}>{name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

const WallpaperTypeSelector: React.FC<{
    selected: 'phone' | 'desktop';
    onSelect: (type: 'phone' | 'desktop') => void;
    theme: Theme;
}> = ({ selected, onSelect, theme }) => {
    const baseButtonClasses = `w-1/2 py-2 text-sm font-semibold transition-colors duration-200 focus:outline-none rounded-md`;
    const selectedClasses = theme === 'dark' ? 'bg-nothing-light text-nothing-dark font-bold' : 'bg-day-text text-day-bg font-bold';
    const unselectedClasses = theme === 'dark' ? 'bg-nothing-gray-dark hover:bg-gray-700 text-nothing-light' : 'bg-day-gray-light hover:bg-gray-300 text-day-text';

    return (
        <div className="space-y-2">
            <label className={`text-sm ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>Wallpaper for</label>
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
        </div>
    );
};

const PFP_INITIAL_STATE = {
    resolution: DEFAULT_SLIDER_VALUE,
    exposure: DEFAULT_SLIDER_VALUE,
    contrast: DEFAULT_SLIDER_VALUE,
    pixelGap: DEFAULT_SLIDER_VALUE,
    isCircular: false,
    isAntiAliased: false,
    isMatrixSquare: false,
};
type PfpState = typeof PFP_INITIAL_STATE;

// A value of 16 on the old scale should now be 50.
// Old scale max value for gap was 27.6 (at slider value 100).
// At slider 16, old gap was (16/100) * 27.6 = 4.416
// New scale: we want 4.416 to correspond to slider value 50.
// New multiplier = 4.416 / 50 = 0.08832
// New max gap = 0.08832 * 100 = 8.832
const WALLPAPER_PIXEL_GAP_MULTIPLIER = 0.08832;

const WALLPAPER_INITIAL_STATE = {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: DEFAULT_SLIDER_VALUE,
    isCircular: true,
    background: 'black' as WallpaperBgKey,
};
type WallpaperState = typeof WALLPAPER_INITIAL_STATE;

const App: React.FC = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [theme, setTheme] = useState<Theme>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const [activeTab, setActiveTab] = useState<'pfp' | 'wallpaper'>('pfp');
  
  // Committed state for history
  const { state: pfpState, setState: setPfpState, undo: undoPfp, redo: redoPfp, reset: resetPfp, canUndo: canUndoPfp, canRedo: canRedoPfp } = useHistory(PFP_INITIAL_STATE);
  // Live state for real-time preview
  const [livePfpState, setLivePfpState] = useState(pfpState);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [pfpImageSrc, setPfpImageSrc] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Committed state for history
  const { state: wallpaperState, setState: setWallpaperState, undo: undoWallpaper, redo: redoWallpaper, reset: resetWallpaper, canUndo: canUndoWallpaper, canRedo: canRedoWallpaper } = useHistory(WALLPAPER_INITIAL_STATE);
  // Live state for real-time preview
  const [liveWallpaperState, setLiveWallpaperState] = useState(wallpaperState);
  const [wallpaperType, setWallpaperType] = useState<'phone' | 'desktop'>('phone');


  const wallpaperCanvasRef = useRef<HTMLCanvasElement>(null);
  const [wallpaperImageSrc, setWallpaperImageSrc] = useState<string | null>(null);
  const [wallpaperImage, setWallpaperImage] = useState<HTMLImageElement | null>(null);
  const [wallpaperIsLoading, setWallpaperIsLoading] = useState(false);
  const [showWallpaperAdvanced, setShowWallpaperAdvanced] = useState(false);
  
  const pfpFileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);
  
  const { resolution, exposure, contrast, pixelGap, isCircular, isAntiAliased, isMatrixSquare } = livePfpState;
  const { resolution: wallpaperResolution, pixelGap: wallpaperPixelGap, isCircular: wallpaperIsCircular, background: wallpaperBackground } = liveWallpaperState;

  const imageSrc = activeTab === 'pfp' ? pfpImageSrc : wallpaperImageSrc;

  // Sync live state when history (committed state) changes
  useEffect(() => {
    setLivePfpState(pfpState);
  }, [pfpState]);

  useEffect(() => {
    setLiveWallpaperState(wallpaperState);
  }, [wallpaperState]);
  
  useEffect(() => {
    const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
        setTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.body.className = '';
    if (theme === 'light') {
      document.body.classList.add('bg-day-bg');
    } else {
      document.body.classList.add('bg-nothing-dark');
    }
  }, [theme]);
  
  useEffect(() => {
    const generateFaviconSvg = (color: string) => {
        const gridSize = 10;
        const canvasSize = 25;
        const step = canvasSize / gridSize;
        const radius = step * 0.4;
        const offset = step / 2;

        let circles = '';
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const cx = offset + x * step;
                const cy = offset + y * step;
                circles += `<circle cx="${cx}" cy="${cy}" r="${radius}"/>`;
            }
        }

        return `<svg width="25" height="25" viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg"><g fill="${color}">${circles}</g></svg>`;
    };

    const color = theme === 'dark' ? '#FFFFFF' : '#000000';
    const svgString = generateFaviconSvg(color);
    const faviconUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;

    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }, [theme]);


  useEffect(() => {
    if (livePfpState.isMatrixSquare && livePfpState.isAntiAliased) {
      setPfpState(s => ({ ...s, isAntiAliased: false }));
    }
  }, [livePfpState.isMatrixSquare, livePfpState.isAntiAliased, setPfpState]);

  const diameter = useMemo(() => {
    const calculatedDiameter = 0.32 * resolution + 9;
    return Math.floor(calculatedDiameter / 2) * 2 + 1;
  }, [resolution]);

  const radius = useMemo(() => diameter / 2, [diameter]);
  const center = useMemo(() => radius - 0.5, [radius]);

  const calculatedExposure = useMemo(() => (exposure - 50) * 2, [exposure]);
  const calculatedContrast = useMemo(() => {
    if (contrast <= 50) {
      return contrast / 50;
    } else {
      return 1 + ((contrast - 50) / 50) * 2;
    }
  }, [contrast]);
  const calculatedPixelGap = useMemo(() => (pixelGap / 100) * 27.6, [pixelGap]);

  const matrixMask = useMemo(() => {
    if (isMatrixSquare) {
        return Array(diameter).fill(0).map(() => Array(diameter).fill(1));
    }
      
    const mask: number[][] = Array(diameter).fill(0).map(() => Array(diameter).fill(0));
    const isOriginalPixel = (x: number, y: number) =>
      Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2)) <= radius;

    if (!isAntiAliased) {
      for (let y = 0; y < diameter; y++) {
        for (let x = 0; x < diameter; x++) {
          mask[y][x] = isOriginalPixel(x, y) ? 1 : 0;
        }
      }
      return mask;
    }

    const supersamplingFactor = 5;
    const subPixelStep = 1 / supersamplingFactor;
    const totalSubPixels = supersamplingFactor * supersamplingFactor;

    for (let y = 0; y < diameter; y++) {
      for (let x = 0; x < diameter; x++) {
        if (isOriginalPixel(x, y)) {
          mask[y][x] = 1;
        } else {
          const distToCenter = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
          if (distToCenter < radius + 1.5) {
            let pointsInside = 0;
            for (let subY = 0; subY < supersamplingFactor; subY++) {
              for (let subX = 0; subX < supersamplingFactor; subX++) {
                const currentX = (x - 0.5 + subPixelStep * (subX + 0.5)) - center;
                const currentY = (y - 0.5 + subPixelStep * (subY + 0.5)) - center;
                if (Math.sqrt(currentX * currentX + currentY * currentY) <= radius) {
                  pointsInside++;
                }
              }
            }
            if (pointsInside > 0) {
              mask[y][x] = pointsInside / totalSubPixels;
            }
          }
        }
      }
    }
    return mask;
  }, [diameter, center, radius, isAntiAliased, isMatrixSquare]);
  
  const generateDefaultGridData = useCallback((): (RawPixel | null)[][] => {
    const initialGray = 107;
    return matrixMask.map(row =>
      row.map(coverage => (coverage > 0 ? initialGray : null))
    );
  }, [matrixMask]);

  const [rawPixelGrid, setRawPixelGrid] = useState<(RawPixel | null)[][]>([]);

  useEffect(() => {
    const regenerateGrid = async () => {
      setIsLoading(true);
      if (pfpImageSrc) {
        try {
          const img = new Image();
          img.src = pfpImageSrc;
          await img.decode();

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = diameter;
          tempCanvas.height = diameter;
          const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error("Failed to create canvas context.");

          const imgAspectRatio = img.width / img.height;
          let sWidth, sHeight, dx, dy;

          if (imgAspectRatio < 1) {
            sWidth = diameter;
            sHeight = sWidth / imgAspectRatio;
            dx = 0;
            dy = (diameter - sHeight) / 2;
          } else {
            sHeight = diameter;
            sWidth = sHeight * imgAspectRatio;
            dx = (diameter - sWidth) / 2;
            dy = 0;
          }
          
          ctx.drawImage(img, dx, dy, sWidth, sHeight);
          const imageData = ctx.getImageData(0, 0, diameter, diameter).data;
          
          const newRawGrid: (RawPixel | null)[][] = [];
          for (let y = 0; y < diameter; y++) {
            const row: (RawPixel | null)[] = [];
            for (let x = 0; x < diameter; x++) {
              if (matrixMask[y] && matrixMask[y][x] > 0) {
                const index = (y * diameter + x) * 4;
                row.push(Math.round(0.299 * imageData[index] + 0.587 * imageData[index + 1] + 0.114 * imageData[index + 2]));
              } else {
                row.push(null);
              }
            }
            newRawGrid.push(row);
          }
          setRawPixelGrid(newRawGrid);
        } catch (error) {
          console.error("Failed to reprocess image:", error);
          setPfpImageSrc(null);
        }
      } else {
        setRawPixelGrid(generateDefaultGridData());
      }
      setIsLoading(false);
    };
    regenerateGrid();
  }, [diameter, matrixMask, pfpImageSrc, generateDefaultGridData]);

  const gridColors = useMemo(() => {
    return rawPixelGrid.map(row => {
      return row.map(pixelValue => {
        if (pixelValue === null) return NOTHING_DARK_COLOR;

        const applyAdjustments = (colorValue: number) => {
          let adjusted = colorValue;
          if (pfpImageSrc) {
            adjusted = ((adjusted / 255.0 - 0.5) * calculatedContrast + 0.5) * 255.0;
            adjusted += calculatedExposure;
          }
          return Math.round(Math.max(0, Math.min(255, adjusted)));
        };

        // Glyph is always B&W
        const finalGray = applyAdjustments(typeof pixelValue === 'number' ? pixelValue : (pixelValue.r * 0.299 + pixelValue.g * 0.587 + pixelValue.b * 0.114));
        return `rgb(${finalGray}, ${finalGray}, ${finalGray})`;
      });
    });
  }, [rawPixelGrid, calculatedExposure, calculatedContrast, pfpImageSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (gridColors.length !== diameter || matrixMask.length !== diameter || (gridColors[0] && gridColors[0].length !== diameter) || (matrixMask[0] && matrixMask[0].length !== diameter)) {
      return; 
    }

    ctx.fillStyle = NOTHING_DARK_COLOR;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const drawableArea = CANVAS_SIZE - PADDING * 2;
    if (drawableArea <= 0) return;

    const totalGapSize = (diameter - 1) * calculatedPixelGap;
    const totalPixelSize = drawableArea - totalGapSize;
    const pixelRenderSize = totalPixelSize / diameter;

    if (pixelRenderSize <= 0) return;

    gridColors.forEach((row, y) => {
        row.forEach((color, x) => {
            const coverage = matrixMask[y][x];
            if (coverage > 0) {
                const drawX = PADDING + x * (pixelRenderSize + calculatedPixelGap);
                const drawY = PADDING + y * (pixelRenderSize + calculatedPixelGap);
                
                const finalPixelSize = pixelRenderSize * Math.pow(coverage, 0.35);
                const offset = (pixelRenderSize - finalPixelSize) / 2;
                
                ctx.fillStyle = color;

                if (isCircular) {
                    ctx.beginPath();
                    ctx.arc(drawX + pixelRenderSize / 2, drawY + pixelRenderSize / 2, finalPixelSize / 2, 0, 2 * Math.PI);
                    ctx.fill();
                } else {
                    ctx.fillRect(drawX + offset, drawY + offset, finalPixelSize, finalPixelSize);
                }
            }
        });
    });
    
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;
    const previewCtx = previewCanvas.getContext('2d');
    if (!previewCtx) return;

    previewCtx.clearRect(0, 0, 100, 100);
    previewCtx.save();
    if (!isMatrixSquare) {
      previewCtx.beginPath();
      previewCtx.arc(50, 50, 50, 0, Math.PI * 2);
      previewCtx.clip();
    }
    previewCtx.drawImage(canvas, 0, 0, 100, 100);
    previewCtx.restore();

  }, [gridColors, calculatedPixelGap, diameter, isCircular, matrixMask, isMatrixSquare]);

  const handlePfpFileSelect = (file: File) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const imgSrc = e.target?.result as string;
      if (imgSrc) {
        setPfpImageSrc(imgSrc);
        resetPfp();
      }
      setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };
  
  const handlePfpDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `matrices-glyphmirror-${getTimestamp()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  
  const activePixelCount = useMemo(() => {
    const totalCoverage = matrixMask.flat().reduce((sum, coverage) => sum + coverage, 0);
    return isAntiAliased ? totalCoverage.toFixed(2) : totalCoverage;
  }, [matrixMask, isAntiAliased]);

  // --- Wallpaper Logic ---

  const [currentWallpaperWidth, currentWallpaperHeight] = useMemo(() => {
    if (wallpaperType === 'desktop') {
        return [WALLPAPER_DESKTOP_WIDTH, WALLPAPER_DESKTOP_HEIGHT];
    }
    return [WALLPAPER_PHONE_WIDTH, WALLPAPER_PHONE_HEIGHT];
  }, [wallpaperType]);
  
  const handleWallpaperFileSelect = (file: File) => {
    setWallpaperIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const imgSrc = e.target?.result as string;
      setWallpaperImageSrc(imgSrc);
      resetWallpaper();
      setWallpaperIsLoading(false);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!wallpaperImageSrc) {
      setWallpaperImage(null);
      return;
    }
    setWallpaperIsLoading(true);
    const img = new Image();
    img.onload = () => {
      setWallpaperImage(img);
      setWallpaperIsLoading(false);
    };
    img.onerror = () => {
      console.error("Failed to load wallpaper image.");
      setWallpaperImageSrc(null);
      setWallpaperImage(null);
      setWallpaperIsLoading(false);
    };
    img.src = wallpaperImageSrc;
  }, [wallpaperImageSrc]);

  const wallpaperGridWidth = useMemo(() => {
      const effectiveResolution = wallpaperType === 'desktop' ? wallpaperResolution * 4 : wallpaperResolution;
      return Math.floor(10 + (effectiveResolution / 100) * 52);
  }, [wallpaperResolution, wallpaperType]);

  const wallpaperGridHeight = useMemo(() => {
      return Math.round(wallpaperGridWidth * (currentWallpaperHeight / currentWallpaperWidth));
  }, [wallpaperGridWidth, currentWallpaperWidth, currentWallpaperHeight]);

  const calculatedWallpaperPixelGap = useMemo(() => {
      return wallpaperPixelGap * WALLPAPER_PIXEL_GAP_MULTIPLIER;
  }, [wallpaperPixelGap]);

  useEffect(() => {
      const canvas = wallpaperCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.fillStyle = WALLPAPER_BG_OPTIONS[wallpaperBackground]?.color || NOTHING_DARK_COLOR;
      ctx.fillRect(0, 0, currentWallpaperWidth, currentWallpaperHeight);

      if (!wallpaperImage) {
          return;
      }
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = wallpaperGridWidth;
      tempCanvas.height = wallpaperGridHeight;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!tempCtx) return;

      const canvasAspect = currentWallpaperWidth / currentWallpaperHeight;
      const imgAspect = wallpaperImage.width / wallpaperImage.height;
      let sx = 0, sy = 0, sWidth = wallpaperImage.width, sHeight = wallpaperImage.height;

      if (imgAspect > canvasAspect) {
          sWidth = wallpaperImage.height * canvasAspect;
          sx = (wallpaperImage.width - sWidth) / 2;
      } else {
          sHeight = wallpaperImage.width / canvasAspect;
          sy = (wallpaperImage.height - sHeight) / 2;
      }

      tempCtx.drawImage(wallpaperImage, sx, sy, sWidth, sHeight, 0, 0, wallpaperGridWidth, wallpaperGridHeight);
      const imageData = tempCtx.getImageData(0, 0, wallpaperGridWidth, wallpaperGridHeight).data;

      const totalGapWidth = (wallpaperGridWidth - 1) * calculatedWallpaperPixelGap;
      const totalGapHeight = (wallpaperGridHeight - 1) * calculatedWallpaperPixelGap;
      const pixelRenderWidth = (currentWallpaperWidth - totalGapWidth) / wallpaperGridWidth;
      const pixelRenderHeight = (currentWallpaperHeight - totalGapHeight) / wallpaperGridHeight;

      for (let y = 0; y < wallpaperGridHeight; y++) {
          for (let x = 0; x < wallpaperGridWidth; x++) {
              const index = (y * wallpaperGridWidth + x) * 4;
              const r = imageData[index];
              const g = imageData[index + 1];
              const b = imageData[index + 2];
              
              ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
              
              const drawX = x * (pixelRenderWidth + calculatedWallpaperPixelGap);
              const drawY = y * (pixelRenderHeight + calculatedWallpaperPixelGap);
              
              if (wallpaperIsCircular) {
                  ctx.beginPath();
                  ctx.arc(drawX + pixelRenderWidth / 2, drawY + pixelRenderHeight / 2, Math.min(pixelRenderWidth, pixelRenderHeight) / 2, 0, 2 * Math.PI);
                  ctx.fill();
              } else {
                  ctx.fillRect(drawX, drawY, pixelRenderWidth, pixelRenderHeight);
              }
          }
      }
  }, [wallpaperImage, wallpaperGridWidth, wallpaperGridHeight, calculatedWallpaperPixelGap, wallpaperIsCircular, wallpaperBackground, currentWallpaperWidth, currentWallpaperHeight]);
  
  const handleWallpaperDownload = () => {
    const canvas = wallpaperCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `matrices-wallpaper-${getTimestamp()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  
    const handlePfpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handlePfpFileSelect(file);
        }
        if (e.target) {
            e.target.value = '';
        }
    };

    const handleWallpaperInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleWallpaperFileSelect(file);
        }
        if (e.target) {
            e.target.value = '';
        }
    };

  const tabDescriptions = {
    pfp: "Create a profile picture in glyph matrix style, replicating the glyph mirror",
    wallpaper: "Create dot-matrix styled wallpapers"
  };

  const linkClasses = theme === 'dark'
    ? 'font-medium text-nothing-light hover:text-white underline'
    : 'font-medium text-day-text hover:text-black underline';
    
  const previewContainerPadding = useMemo(() => {
    if (activeTab === 'wallpaper' && wallpaperType === 'phone') {
        if (isMobile) {
            return 'py-8 px-6';
        } else {
            return 'p-6';
        }
    }
    return 'p-4 sm:p-6';
  }, [activeTab, wallpaperType, isMobile]);

  const footerLinks = (
    <div className={`text-sm ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} opacity-80`}>
        <p>
            Made with 🤍❤️🖤 for <a href="https://nothing.community/" target="_blank" rel="noopener noreferrer" className={linkClasses}>Nothing Community</a> by <a href="https://nothing.community/u/Udaign" target="_blank" rel="noopener noreferrer" className={linkClasses}>Uday</a>.
        </p>
        <p>
            For feedback, join the discussion <a href="https://nothing.community/d/36133" target="_blank" rel="noopener noreferrer" className={linkClasses}>here</a>. For contact, DM me on <a href="https://x.com/udaign" target="_blank" rel="noopener noreferrer" className={linkClasses}>X</a>.
        </p>
    </div>
  );

  return (
    <>
      <input type="file" ref={pfpFileInputRef} onChange={handlePfpInputChange} className="hidden" accept="image/*" />
      <input type="file" ref={wallpaperFileInputRef} onChange={handleWallpaperInputChange} className="hidden" accept="image/*" />
      <div className={`min-h-screen md:h-screen w-full flex flex-col font-sans ${theme === 'dark' ? 'text-nothing-light bg-nothing-dark' : 'text-day-text bg-day-bg'} select-none`}>
        <header className={`flex-shrink-0 sticky top-0 z-30 flex justify-between items-center p-4 border-b ${theme === 'dark' ? 'bg-nothing-dark border-nothing-gray-dark' : 'bg-day-bg border-gray-300'}`}>
          <h1 className="text-xl sm:text-2xl font-bold">
            Matrices v2.5 for Nothing Community
          </h1>
          <div className="relative">
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className={`p-2 transition-colors duration-300 rounded-md ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* --- MOBILE-ONLY HIERARCHY --- */}
        <div className="block md:hidden">
            <div className="flex-shrink-0">
                <div className="pt-4 sm:pt-6">
                    <div className="flex flex-col space-y-4">
                        <div className="w-full">
                            <div className={`relative flex border-b ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
                                <button
                                    onClick={() => setActiveTab('pfp')}
                                    className={`w-1/2 py-3 text-base transition-colors duration-300 focus:outline-none ${activeTab === 'pfp' ? (theme === 'dark' ? 'text-nothing-light font-bold' : 'text-day-text font-bold') : (theme === 'dark' ? 'text-nothing-gray-light hover:text-nothing-light font-semibold' : 'text-day-gray-dark hover:text-day-text font-semibold')}`}
                                    aria-pressed={activeTab === 'pfp'}
                                >
                                    Glyph Mirror
                                </button>
                                <button
                                    onClick={() => setActiveTab('wallpaper')}
                                    className={`w-1/2 py-3 text-base transition-colors duration-300 focus:outline-none ${activeTab === 'wallpaper' ? (theme === 'dark' ? 'text-nothing-light font-bold' : 'text-day-text font-bold') : (theme === 'dark' ? 'text-nothing-gray-light hover:text-nothing-light font-semibold' : 'text-day-gray-dark hover:text-day-text font-semibold')}`}
                                    aria-pressed={activeTab === 'wallpaper'}
                                >
                                    Wallpaper
                                </button>
                                <div
                                    className={`absolute bottom-[-1px] h-[2px] ${theme === 'dark' ? 'bg-white' : 'bg-black'} transition-all duration-300 ease-in-out`}
                                    style={{ width: '50%', left: activeTab === 'pfp' ? '0%' : '50%' }}
                                    aria-hidden="true"
                                ></div>
                            </div>
                        </div>
                        <div>
                            <p className={`text-center w-full text-sm leading-normal transition-opacity duration-300 px-4 sm:px-6 ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                                {tabDescriptions[activeTab]}
                            </p>
                            <hr className={`mt-4 ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`} />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <main className="flex-grow w-full flex flex-col md:flex-row min-h-0 md:pt-0">
          {/* Left Column (Preview) */}
          <div className={`md:w-1/3 w-full flex flex-col ${!imageSrc ? 'flex-grow md:flex-grow-0' : ''} border-b md:border-b-0 md:border-r ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} md:overflow-y-auto`}>
            <div className={`flex-grow ${previewContainerPadding} ${!imageSrc ? 'min-h-[50vh] md:min-h-0' : 'min-h-0'} flex flex-col items-center justify-center`}>
                {/* PFP Preview & Dropzone */}
                <div style={{ display: activeTab === 'pfp' ? 'flex' : 'none' }} className="w-full flex-grow flex flex-col items-center justify-center">
                  {!pfpImageSrc ? (
                    <Dropzone onFileSelect={handlePfpFileSelect} isLoading={isLoading} theme={theme} />
                  ) : (
                    <div className="w-full max-w-md mx-auto">
                      <header className="text-center mb-4">
                        <p className={`${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} text-sm md:text-base`}>
                          Diameter: <span className={`font-semibold ${theme === 'dark' ? 'text-nothing-light' : 'text-day-text'}`}>{diameter}px</span> | Pixels: <span className={`font-semibold ${theme === 'dark' ? 'text-nothing-light' : 'text-day-text'}`}>{activePixelCount}</span>
                        </p>
                      </header>
                      <canvas
                        ref={canvasRef}
                        width={CANVAS_SIZE}
                        height={CANVAS_SIZE}
                        className="w-full h-auto shadow-lg rounded-lg"
                        aria-label="Pixel Matrix Canvas"
                      />
                      <div className="flex flex-col items-center my-6">
                          <p className={`text-sm ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} mb-2 text-center`}>Profile Picture Preview</p>
                          <canvas
                              ref={previewCanvasRef}
                              width={100}
                              height={100}
                              className={`shadow-lg rounded-full`}
                              aria-label="Profile Picture Preview"
                          />
                      </div>
                    </div>
                  )}
                </div>

                {/* Wallpaper Preview & Dropzone */}
                <div style={{ display: activeTab === 'wallpaper' ? 'flex' : 'none' }} className="w-full flex-grow min-h-0 flex flex-col items-center justify-center">
                  {!wallpaperImageSrc ? (
                      <Dropzone onFileSelect={handleWallpaperFileSelect} isLoading={wallpaperIsLoading} theme={theme}/>
                  ) : (
                    <canvas ref={wallpaperCanvasRef} width={currentWallpaperWidth} height={currentWallpaperHeight} className={`shadow-lg border-2 rounded-lg ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} ${
                        wallpaperType === 'phone'
                            ? (isMobile ? 'w-4/5 h-auto' : 'max-h-full w-auto')
                            : 'max-w-full max-h-full'
                    }`} aria-label="Wallpaper Canvas" />
                  )}
                </div>
            </div>
          </div>

          {/* Right Column (Controls) */}
          <div className="md:w-2/3 w-full flex flex-col">
            {/* Controls Header (Sticky on md+, HIDDEN ON MOBILE) */}
            <div className="hidden md:block flex-shrink-0">
              <div className="py-4 sm:py-6 md:py-8 md:pb-4">
                <div className="flex flex-col space-y-4">
                  <div className="w-full">
                    <div className="relative flex border-b dark:border-nothing-gray-dark border-gray-300">
                      <button
                        onClick={() => setActiveTab('pfp')}
                        className={`w-1/2 py-3 text-lg transition-colors duration-300 focus:outline-none ${
                          activeTab === 'pfp'
                            ? (theme === 'dark' ? 'text-nothing-light font-extrabold' : 'text-day-text font-extrabold')
                            : (theme === 'dark' ? 'text-nothing-gray-light hover:text-nothing-light font-semibold' : 'text-day-gray-dark hover:text-day-text font-semibold')
                        }`}
                        aria-pressed={activeTab === 'pfp'}
                      >
                        Glyph Mirror
                      </button>
                      <button
                        onClick={() => setActiveTab('wallpaper')}
                        className={`w-1/2 py-3 text-lg transition-colors duration-300 focus:outline-none ${
                          activeTab === 'wallpaper'
                            ? (theme === 'dark' ? 'text-nothing-light font-extrabold' : 'text-day-text font-extrabold')
                            : (theme === 'dark' ? 'text-nothing-gray-light hover:text-nothing-light font-semibold' : 'text-day-gray-dark hover:text-day-text font-semibold')
                        }`}
                        aria-pressed={activeTab === 'wallpaper'}
                      >
                        Wallpaper
                      </button>
                      <div
                        className={`absolute bottom-[-1px] h-1 ${theme === 'dark' ? 'bg-white' : 'bg-black'} transition-all duration-300 ease-in-out`}
                        style={{
                          width: '50%',
                          left: activeTab === 'pfp' ? '0%' : '50%',
                        }}
                        aria-hidden="true"
                      ></div>
                    </div>
                  </div>
                  <div>
                    <p className={`text-center w-full text-sm leading-normal transition-opacity duration-300 ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                      {tabDescriptions[activeTab]}
                    </p>
                    <hr className={`mt-2 ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`} />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Controls Body (Scrollable on md+) */}
            <div className="flex-grow md:overflow-y-auto">
              <div className="max-w-md mx-auto w-full flex flex-col space-y-6 px-6 sm:px-6 md:px-8 pt-6 md:pt-3 pb-8 sm:pb-6 md:pb-8">
                {/* PFP Controls */}
                <div style={{ display: activeTab === 'pfp' && pfpImageSrc ? 'block' : 'none' }}>
                  <div className="w-full space-y-4">
                    <UndoRedoControls onUndo={undoPfp} onRedo={redoPfp} canUndo={canUndoPfp} canRedo={canRedoPfp} theme={theme} />
                    <EnhancedSlider theme={theme} label="Resolution" value={resolution} onChange={v => setLivePfpState(s => ({...s, resolution: v}))} onChangeCommitted={v => setPfpState(s => ({...s, resolution: v}))} onReset={() => setPfpState(s => ({...s, resolution: DEFAULT_SLIDER_VALUE}))} disabled={isLoading} />
                    <EnhancedSlider theme={theme} label="Exposure" value={exposure} onChange={v => setLivePfpState(s => ({...s, exposure: v}))} onChangeCommitted={v => setPfpState(s => ({...s, exposure: v}))} onReset={() => setPfpState(s => ({...s, exposure: DEFAULT_SLIDER_VALUE}))} disabled={!pfpImageSrc || isLoading} />
                    <EnhancedSlider theme={theme} label="Contrast" value={contrast} onChange={v => setLivePfpState(s => ({...s, contrast: v}))} onChangeCommitted={v => setPfpState(s => ({...s, contrast: v}))} onReset={() => setPfpState(s => ({...s, contrast: DEFAULT_SLIDER_VALUE}))} disabled={!pfpImageSrc || isLoading} />
                    <EnhancedSlider theme={theme} label="Pixel Gap" value={pixelGap} onChange={v => setLivePfpState(s => ({...s, pixelGap: v}))} onChangeCommitted={v => setPfpState(s => ({...s, pixelGap: v}))} onReset={() => setPfpState(s => ({...s, pixelGap: DEFAULT_SLIDER_VALUE}))} disabled={isLoading} />
                    
                    <div className={`flex items-center justify-between pt-4 ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                        <label htmlFor="circular-toggle" className="text-sm">Circular Pixels</label>
                        <button id="circular-toggle" role="switch" aria-checked={isCircular} onClick={() => setPfpState(s => ({...s, isCircular: !s.isCircular}))} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isCircular ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`} >
                            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isCircular ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    <div className={`border-t ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} pt-2 mt-4`}>
                        <button onClick={() => setShowAdvanced(!showAdvanced)} className={`w-full flex justify-between items-center ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} py-1 focus:outline-none`} aria-expanded={showAdvanced} aria-controls="advanced-options-panel">
                            <span className="text-sm font-medium">More Controls</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <div id="advanced-options-panel" className={`overflow-hidden transition-all duration-500 ease-in-out ${showAdvanced ? 'max-h-96 pt-4' : 'max-h-0'}`}>
                          <div className="space-y-4">
                              <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                                  <label htmlFor="aa-toggle" className="text-sm">Anti-aliasing</label>
                                  <button id="aa-toggle" role="switch" aria-checked={isAntiAliased} onClick={() => setPfpState(s => ({...s, isAntiAliased: !s.isAntiAliased}))} disabled={isLoading || isMatrixSquare} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} disabled:opacity-50 ${isAntiAliased ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                                      <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isAntiAliased ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                              </div>
                              <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                                  <label htmlFor="matrix-shape-toggle" className="text-sm">Square Matrix</label>
                                  <button id="matrix-shape-toggle" role="switch" aria-checked={isMatrixSquare} onClick={() => setPfpState(s => ({ ...s, isMatrixSquare: !s.isMatrixSquare }))} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} disabled:opacity-50 ${isMatrixSquare ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                                      <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isMatrixSquare ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                              </div>
                          </div>
                        </div>
                    </div>
                    <div className="pt-6">
                        <button onClick={resetPfp} disabled={isLoading} className={`w-full border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Restore all settings to their default values"> Restore Defaults </button>
                    </div>
                    <div className="block md:hidden pt-8">
                        <footer className="text-center tracking-wide">{footerLinks}</footer>
                    </div>
                  </div>
                </div>

                {/* Wallpaper Controls */}
                <div style={{ display: activeTab === 'wallpaper' && wallpaperImageSrc ? 'block' : 'none' }}>
                    <div className="w-full space-y-4">
                      <div className="pb-4">
                          <WallpaperTypeSelector
                              selected={wallpaperType}
                              onSelect={setWallpaperType}
                              theme={theme}
                          />
                      </div>
                      <UndoRedoControls onUndo={undoWallpaper} onRedo={redoWallpaper} canUndo={canUndoWallpaper} canRedo={canRedoWallpaper} theme={theme} />
                      <EnhancedSlider theme={theme} label="Resolution" value={wallpaperResolution} onChange={v => setLiveWallpaperState(s => ({...s, resolution: v}))} onChangeCommitted={v => setWallpaperState(s => ({...s, resolution: v}))} onReset={() => setWallpaperState(s => ({...s, resolution: DEFAULT_SLIDER_VALUE}))} disabled={wallpaperIsLoading} />
                      <EnhancedSlider theme={theme} label="Pixel Gap" value={wallpaperPixelGap} onChange={v => setLiveWallpaperState(s => ({...s, pixelGap: v}))} onChangeCommitted={v => setWallpaperState(s => ({...s, pixelGap: v}))} onReset={() => setWallpaperState(s => ({...s, pixelGap: DEFAULT_SLIDER_VALUE}))} disabled={wallpaperIsLoading} />
                      
                      <div className="space-y-4 pt-4">
                          <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                              <label htmlFor="wallpaper-circular-toggle" className="text-sm">Circular Pixels</label>
                              <button id="wallpaper-circular-toggle" role="switch" aria-checked={wallpaperIsCircular} onClick={() => setWallpaperState(s => ({...s, isCircular: !s.isCircular}))} disabled={wallpaperIsLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} disabled:opacity-50 ${wallpaperIsCircular ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                                  <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${wallpaperIsCircular ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                          </div>
                      </div>

                      <div className={`border-t ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} pt-2 mt-4`}>
                          <button onClick={() => setShowWallpaperAdvanced(!showWallpaperAdvanced)} className={`w-full flex justify-between items-center ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} py-1 focus:outline-none`} aria-expanded={showWallpaperAdvanced} aria-controls="wallpaper-advanced-options-panel">
                              <span className="text-sm font-medium">More Controls</span>
                              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform duration-300 ${showWallpaperAdvanced ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                          </button>
                          <div id="wallpaper-advanced-options-panel" className={`overflow-hidden transition-all duration-500 ease-in-out ${showWallpaperAdvanced ? 'max-h-96 pt-4' : 'max-h-0'}`}>
                              <div className="space-y-4">
                                  <div className="pt-4">
                                    <ColorSelector
                                        label="Background Color"
                                        options={WALLPAPER_BG_OPTIONS}
                                        selected={liveWallpaperState.background}
                                        onSelect={(key) => setWallpaperState(s => ({ ...s, background: key as WallpaperBgKey }))}
                                        theme={theme}
                                    />
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="pt-6">
                        <button onClick={resetWallpaper} disabled={wallpaperIsLoading} className={`w-full border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Restore wallpaper settings to their default values"> Restore Defaults </button>
                      </div>
                      <div className="block md:hidden pt-8">
                          <footer className="text-center tracking-wide">{footerLinks}</footer>
                      </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* --- DESKTOP/TABLET-ONLY BOTTOM BAR (HIDDEN ON MOBILE) --- */}
        {imageSrc &&
          <div className={`flex-shrink-0 hidden md:flex flex-col md:flex-row border-t ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
            <div className={`md:w-1/3 w-full p-4 border-b md:border-b-0 md:border-r ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
                {activeTab === 'pfp' && pfpImageSrc && (
                  <Dropzone onFileSelect={handlePfpFileSelect} isLoading={isLoading} compact={true} theme={theme}/>
                )}
                {activeTab === 'wallpaper' && wallpaperImageSrc && (
                  <Dropzone onFileSelect={handleWallpaperFileSelect} isLoading={wallpaperIsLoading} compact={true} theme={theme}/>
                )}
            </div>
            <div className="md:w-2/3 w-full flex">
                {activeTab === 'pfp' && pfpImageSrc && (
                  <button onClick={handlePfpDownload} disabled={isLoading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download the current image"> Download </button>
                )}
                {activeTab === 'wallpaper' && wallpaperImageSrc && (
                  <button onClick={handleWallpaperDownload} disabled={wallpaperIsLoading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download the current wallpaper"> Download </button>
                )}
            </div>
          </div>
        }

        {/* --- DESKTOP/TABLET-ONLY FOOTER (HIDDEN ON MOBILE) --- */}
        <footer className={`hidden md:block flex-shrink-0 text-center p-4 border-t ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} tracking-wide`}>
          {footerLinks}
        </footer>

        {/* --- MOBILE-ONLY STICKY FOOTER --- */}
        <div className={`block md:hidden sticky bottom-0 z-20 w-full ${theme === 'dark' ? 'bg-nothing-dark' : 'bg-day-bg'}`}>
            {imageSrc && (
              <div className={`flex border-t ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
                <div className={`w-1/2 border-r ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
                  {activeTab === 'pfp' && (
                    <button onClick={() => pfpFileInputRef.current?.click()} disabled={isLoading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-dark text-nothing-light hover:bg-nothing-gray-dark' : 'bg-day-bg text-day-text hover:bg-day-gray-light'}`}>
                      Replace Image
                    </button>
                  )}
                  {activeTab === 'wallpaper' && (
                    <button onClick={() => wallpaperFileInputRef.current?.click()} disabled={wallpaperIsLoading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-dark text-nothing-light hover:bg-nothing-gray-dark' : 'bg-day-bg text-day-text hover:bg-day-gray-light'}`}>
                      Replace Image
                    </button>
                  )}
                </div>
                <div className="w-1/2">
                  {activeTab === 'pfp' && pfpImageSrc && (
                    <button onClick={handlePfpDownload} disabled={isLoading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download the current image"> Download </button>
                  )}
                  {activeTab === 'wallpaper' && wallpaperImageSrc && (
                    <button onClick={handleWallpaperDownload} disabled={wallpaperIsLoading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download the current wallpaper"> Download </button>
                  )}
                </div>
              </div>
            )}
        </div>
      </div>
    </>
  );
};

export default App;