
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useHistory, useImageHandler } from './hooks';
import { getTimestamp } from './utils';
import { ValueAliasingState, WallpaperBgKey, WALLPAPER_BG_OPTIONS, Theme, ValueAliasingSettingsContainer } from './types';
import { Dropzone, EnhancedSlider, UndoRedoControls, SegmentedControl, ToastNotification, ToggleSwitch } from './components';
import { trackEvent } from './analytics';

const DEFAULT_SLIDER_VALUE = 50;
const VALUE_ALIASING_PHONE_WIDTH = 1260;
const VALUE_ALIASING_PHONE_HEIGHT = 2800;
const VALUE_ALIASING_DESKTOP_WIDTH = 3840;
const VALUE_ALIASING_DESKTOP_HEIGHT = 2160;
const VALUE_ALIASING_PIXEL_GAP_MULTIPLIER = 0.0423936;
const VALUE_ALIASING_RESOLUTION_MULTIPLIER = 71.8848;

const VALUE_ALIASING_INITIAL_STATE: ValueAliasingState = {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: DEFAULT_SLIDER_VALUE,
    background: 'black' as WallpaperBgKey,
    cropOffsetX: 0.5,
    cropOffsetY: 0.5,
    isMonochrome: true,
    exposure: DEFAULT_SLIDER_VALUE,
    contrast: DEFAULT_SLIDER_VALUE,
    isPureValue: false,
    isTransparent: false,
    lowerLimit: 0,
};

const DUAL_VALUE_ALIASING_INITIAL_STATE: ValueAliasingSettingsContainer = {
    phone: { ...VALUE_ALIASING_INITIAL_STATE },
    desktop: { ...VALUE_ALIASING_INITIAL_STATE },
};

const EASTER_EGG_COLORS = {
    yellow: '#FCCA21',
    blue: '#0D4E81',
    red: '#BD1721',
    grey: '#E0E0E0',
};

const EASTER_EGG_PERMUTATIONS: [('yellow' | 'blue' | 'red'), ('yellow' | 'blue' | 'red'), ('yellow' | 'blue' | 'red')][] = [
    ['yellow', 'blue', 'red'],
    ['blue', 'yellow', 'red'],
    ['red', 'yellow', 'blue'],
    ['yellow', 'red', 'blue'],
    ['blue', 'red', 'yellow'],
    ['red', 'blue', 'yellow'],
];

const drawEasterEggPattern = (ctx: CanvasRenderingContext2D, W: number, H: number, permutationIndex: number) => {
    const permutation = EASTER_EGG_PERMUTATIONS[permutationIndex];
    if (!permutation) return;

    // A = Top-left, B = Top-right, C = Bottom-left
    const colorA = EASTER_EGG_COLORS[permutation[0]];
    const colorB = EASTER_EGG_COLORS[permutation[1]];
    const colorC = EASTER_EGG_COLORS[permutation[2]];

    const g = 0.809; // Golden ratio for main rectangle
    const mid = 0.5; // Midpoint for other rectangles

    // 1. Fill the entire canvas with the base grey color.
    // This color also serves as the color for rectangle 'D' and the gaps.
    ctx.fillStyle = EASTER_EGG_COLORS.grey;
    ctx.fillRect(0, 0, W, H);

    // 2. Draw the three colored rectangles A, B, C on top of the grey background.
    
    // Rectangle A (top-left major)
    ctx.fillStyle = colorA;
    ctx.fillRect(0, 0, g * W, g * H);

    // Rectangle B (top-right)
    ctx.fillStyle = colorB;
    ctx.fillRect(g * W, 0, (1 - g) * W, mid * H);

    // Rectangle C (bottom-left)
    ctx.fillStyle = colorC;
    ctx.fillRect(0, g * H, mid * W, (1 - g) * H);
};

export const useValueAliasingPanel = ({
  theme,
  isMobile,
  footerLinks,
  triggerShareToast,
  easterEggPrimed,
  setEasterEggPrimed,
}: {
  theme: Theme;
  isMobile: boolean;
  footerLinks: React.ReactNode;
  triggerShareToast: (showSpecificToast?: () => void) => void;
  easterEggPrimed: boolean;
  setEasterEggPrimed: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const { 
    state: valueAliasingSettings, 
    setState: setValueAliasingSettings, 
    undo: undoValueAliasing, 
    redo: redoValueAliasing, 
    reset: resetValueAliasingHistory,
    resetHistory: resetValueAliasingHistoryStack,
    canUndo: canUndoValueAliasing, 
    canRedo: canRedoValueAliasing 
  } = useHistory(DUAL_VALUE_ALIASING_INITIAL_STATE);
  
  const [liveValueAliasingSettings, setLiveValueAliasingSettings] = useState(valueAliasingSettings);
  const [valueAliasingType, setValueAliasingType] = useState<'phone' | 'desktop'>(isMobile ? 'phone' : 'desktop');
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const [showFsToast, setShowFsToast] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullScreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullScreenContainerRef = useRef<HTMLDivElement>(null);
  const fullScreenFileInputRef = useRef<HTMLInputElement>(null);
  const [isFullScreenControlsOpen, setIsFullScreenControlsOpen] = useState(false);
  
  const [isEasterEggActive, setIsEasterEggActive] = useState(false);
  const [activePermutationIndex, setActivePermutationIndex] = useState<number | null>(null);

  const resetEasterEgg = useCallback(() => {
    setIsEasterEggActive(false);
    setActivePermutationIndex(null);
  }, []);

  const onFileSelectCallback = useCallback(() => {
    resetValueAliasingHistory();
    resetEasterEgg();
  }, [resetValueAliasingHistory, resetEasterEgg]);
  
  const {
    imageSrc,
    image,
    isLoading,
    isDownloading,
    handleFileSelect,
    handleDownload: baseHandleDownload,
    clearImage
  } = useImageHandler({
    featureName: 'value_aliasing',
    onFileSelectCallback: onFileSelectCallback,
    triggerShareToast: triggerShareToast
  });

  useEffect(() => { setLiveValueAliasingSettings(valueAliasingSettings); }, [valueAliasingSettings]);

  const liveValueAliasingState = liveValueAliasingSettings[valueAliasingType];
  const { resolution, pixelGap, background, cropOffsetX, cropOffsetY, isMonochrome, exposure, contrast, isPureValue, isTransparent, lowerLimit } = liveValueAliasingState;
  
  const activateEasterEgg = useCallback(() => {
    setIsEasterEggActive(true);
    const currentSettings = valueAliasingSettings;
    const newSettings = {
        ...currentSettings,
        phone: {
            ...currentSettings.phone,
            background: 'white' as WallpaperBgKey,
            isPureValue: true,
            isTransparent: false,
        },
        desktop: {
            ...currentSettings.desktop,
            background: 'white' as WallpaperBgKey,
            isPureValue: true,
            isTransparent: false,
        },
    };
    resetValueAliasingHistoryStack(newSettings);
    trackEvent('easter_egg_activated', { feature: 'value_aliasing' });
  }, [valueAliasingSettings, resetValueAliasingHistoryStack]);
  
  const getRandomPermutationIndex = (excludeIndex: number | null = null): number => {
    const totalPermutations = EASTER_EGG_PERMUTATIONS.length;
    if (excludeIndex === null) {
        return Math.floor(Math.random() * totalPermutations);
    }

    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * totalPermutations);
    } while (newIndex === excludeIndex);
    
    return newIndex;
  };

  useEffect(() => {
    if (isEasterEggActive) {
        setActivePermutationIndex(getRandomPermutationIndex());
    } else {
        setActivePermutationIndex(null);
    }
  }, [isEasterEggActive]);

  const handleRefreshGrid = () => {
      trackEvent('value_aliasing_easter_egg_refresh');
      setActivePermutationIndex(currentIndex => getRandomPermutationIndex(currentIndex));
  };


  useEffect(() => {
    const handleFullScreenChange = () => {
        if (!document.fullscreenElement) {
            setIsFullScreenPreview(false);
            setIsFullScreenControlsOpen(false); // Close controls on exit
        }
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const enterFullScreen = () => {
      trackEvent('value_aliasing_fullscreen_enter');
      
      flushSync(() => {
        setIsFullScreenPreview(true);
      });

      if (fullScreenContainerRef.current) {
          fullScreenContainerRef.current.requestFullscreen()
              .catch(err => {
                  console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                  // If the request fails, revert the state
                  setIsFullScreenPreview(false);
              });
      }
  };
  
  const exitFullScreen = useCallback(() => {
      trackEvent('value_aliasing_fullscreen_exit');
      if (document.fullscreenElement) {
          document.exitFullscreen();
      } else {
          setIsFullScreenPreview(false);
      }
  }, []);

  const handleResetCurrentValueAliasing = useCallback(() => {
    trackEvent('value_aliasing_reset_defaults', { value_aliasing_type: valueAliasingType });
    setValueAliasingSettings(currentSettings => {
      const currentModeSettings = currentSettings[valueAliasingType];
      const { cropOffsetX, cropOffsetY, background } = currentModeSettings;

      const persistentState: Partial<ValueAliasingState> = {
        cropOffsetX,
        cropOffsetY,
        background,
      };

      if (isEasterEggActive) {
        persistentState.isPureValue = currentModeSettings.isPureValue;
        persistentState.isTransparent = currentModeSettings.isTransparent;
      }

      return {
        ...currentSettings,
        [valueAliasingType]: {
          ...DUAL_VALUE_ALIASING_INITIAL_STATE[valueAliasingType],
          ...persistentState
        }
      };
    });
  }, [valueAliasingType, setValueAliasingSettings, isEasterEggActive]);

  const [currentValueAliasingWidth, currentValueAliasingHeight] = useMemo(() => valueAliasingType === 'desktop' ? [VALUE_ALIASING_DESKTOP_WIDTH, VALUE_ALIASING_DESKTOP_HEIGHT] : [VALUE_ALIASING_PHONE_WIDTH, VALUE_ALIASING_PHONE_HEIGHT], [valueAliasingType]);

  const valueAliasingGridWidth = useMemo(() => Math.floor(10 + ((valueAliasingType === 'desktop' ? resolution * 4 : resolution * 1.2) / 100) * VALUE_ALIASING_RESOLUTION_MULTIPLIER), [resolution, valueAliasingType]);
  const valueAliasingGridHeight = useMemo(() => Math.round(valueAliasingGridWidth * (currentValueAliasingHeight / currentValueAliasingWidth)), [valueAliasingGridWidth, currentValueAliasingWidth, currentValueAliasingHeight]);
  const calculatedValueAliasingPixelGap = useMemo(() => pixelGap * VALUE_ALIASING_PIXEL_GAP_MULTIPLIER, [pixelGap]);
  const valueAliasingCropIsNeeded = useMemo(() => image ? Math.abs((image.width / image.height) - (currentValueAliasingWidth / currentValueAliasingHeight)) > 0.01 : false, [image, currentValueAliasingWidth, currentValueAliasingHeight]);

  useEffect(() => {
    const canvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (isEasterEggActive && activePermutationIndex !== null) {
        drawEasterEggPattern(ctx, currentValueAliasingWidth, currentValueAliasingHeight, activePermutationIndex);
    } else {
        if (isTransparent) {
            ctx.clearRect(0, 0, currentValueAliasingWidth, currentValueAliasingHeight);
        } else {
            ctx.fillStyle = WALLPAPER_BG_OPTIONS[background]?.color || '#000000';
            ctx.fillRect(0, 0, currentValueAliasingWidth, currentValueAliasingHeight);
        }
    }

    if (!image) return;
    
    const imgAspect = image.width / image.height, canvasAspect = currentValueAliasingWidth / currentValueAliasingHeight;
    let sx = 0, sy = 0, sWidth = image.width, sHeight = image.height;
    if (imgAspect > canvasAspect) { sWidth = image.height * canvasAspect; sx = (image.width - sWidth) * cropOffsetX; }
    else if (imgAspect < canvasAspect) { sHeight = image.width / canvasAspect; sy = (image.height - sHeight) * cropOffsetY; }
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = valueAliasingGridWidth; tempCanvas.height = valueAliasingGridHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, valueAliasingGridWidth, valueAliasingGridHeight);
    
    const data = tempCtx.getImageData(0, 0, valueAliasingGridWidth, valueAliasingGridHeight).data;
    const totalGapW = (valueAliasingGridWidth - 1) * calculatedValueAliasingPixelGap;
    const totalGapH = (valueAliasingGridHeight - 1) * calculatedValueAliasingPixelGap;
    const pxRenderW = (currentValueAliasingWidth - totalGapW) / valueAliasingGridWidth;
    const pxRenderH = (currentValueAliasingHeight - totalGapH) / valueAliasingGridHeight;

    const calculatedExposure = (exposure - 50) * 2;
    const calculatedContrast = contrast <= 50 ? contrast / 50 : 1 + ((contrast - 50) / 50) * 2;
    const threshold = lowerLimit / 100.0;
    
    for (let y = 0; y < valueAliasingGridHeight; y++) {
        for (let x = 0; x < valueAliasingGridWidth; x++) {
            const i = (y * valueAliasingGridWidth + x) * 4;
            const r = data[i], g = data[i+1], b = data[i+2];

            if (isMonochrome) {
                const originalGray = 0.299 * r + 0.587 * g + 0.114 * b;
                let adjusted = ((originalGray / 255.0 - 0.5) * calculatedContrast + 0.5) * 255.0 + calculatedExposure;
                const finalGray = Math.round(Math.max(0, Math.min(255, adjusted)));
                
                const sizeMultiplier = background === 'black' 
                    ? finalGray / 255.0
                    : (255.0 - finalGray) / 255.0;

                if (sizeMultiplier > threshold) {
                    if (isPureValue) {
                        ctx.fillStyle = background === 'black' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)';
                    } else {
                        ctx.fillStyle = `rgb(${finalGray}, ${finalGray}, ${finalGray})`;
                    }

                    const baseRadius = Math.min(pxRenderW, pxRenderH) / 2;
                    const finalRadius = baseRadius * sizeMultiplier;
                    
                    if (finalRadius > 0.1) {
                        const drawX = x * (pxRenderW + calculatedValueAliasingPixelGap);
                        const drawY = y * (pxRenderH + calculatedValueAliasingPixelGap);
                        const centerX = drawX + pxRenderW / 2;
                        const centerY = drawY + pxRenderH / 2;
                        
                        ctx.beginPath();
                        ctx.arc(centerX, centerY, finalRadius, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                }
            }
        }
    }
  }, [image, valueAliasingGridWidth, valueAliasingGridHeight, calculatedValueAliasingPixelGap, background, currentValueAliasingWidth, currentValueAliasingHeight, cropOffsetX, cropOffsetY, isFullScreenPreview, isMonochrome, exposure, contrast, isPureValue, isTransparent, lowerLimit, isEasterEggActive, activePermutationIndex, valueAliasingType]);
  
  const handleFullScreenReplace = (file: File) => {
    trackEvent('value_aliasing_fullscreen_replace_image', { value_aliasing_type: valueAliasingType });
    handleFileSelect(file, 'click');
  };

  const handleFullScreenReplaceClick = () => {
    trackEvent('value_aliasing_fullscreen_replace_image_click', { value_aliasing_type: valueAliasingType });
    fullScreenFileInputRef.current?.click();
  };
  
  const handleFullScreenFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          handleFullScreenReplace(e.target.files[0]);
      }
      if (e.target) {
          e.target.value = '';
      }
  };
  
  const handleDownload = () => {
    const getCanvasBlob = (): Promise<Blob | null> => {
        return new Promise(resolve => {
            const canvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;
            if (canvas) {
                canvas.toBlob(blob => resolve(blob), 'image/png');
            } else {
                resolve(null);
            }
        });
    };

    const analyticsParams: Record<string, string | number | boolean | undefined> = {
      feature: 'value_aliasing',
      value_aliasing_type: valueAliasingType,
      setting_resolution: liveValueAliasingState.resolution,
      setting_pixel_gap: liveValueAliasingState.pixelGap,
      setting_background: liveValueAliasingState.background,
      setting_crop_offset_x: liveValueAliasingState.cropOffsetX,
      setting_crop_offset_y: liveValueAliasingState.cropOffsetY,
      setting_is_monochrome: liveValueAliasingState.isMonochrome,
      setting_exposure: liveValueAliasingState.exposure,
      setting_contrast: liveValueAliasingState.contrast,
      setting_is_pure_value: liveValueAliasingState.isPureValue,
      setting_is_transparent: liveValueAliasingState.isTransparent,
      setting_lower_limit: liveValueAliasingState.lowerLimit,
    };

    const onSuccess = () => {
        if (isFullScreenPreview) {
            triggerShareToast(() => setShowFsToast(true));
        } else {
            triggerShareToast();
        }
    };

    baseHandleDownload(getCanvasBlob, 'matrices-valuealiasing', analyticsParams, onSuccess);
  };

  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, initialOffsetX: 0.5, initialOffsetY: 0.5, hasMoved: false });
  
  const handleValueAliasingDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if (!valueAliasingCropIsNeeded) return;
      
      e.preventDefault();

      dragState.current.isDragging = true;
      dragState.current.hasMoved = false;
      
      const point = 'touches' in e ? e.touches[0] : e;
      dragState.current.startX = point.clientX;
      dragState.current.startY = point.clientY;
      dragState.current.initialOffsetX = liveValueAliasingSettings[valueAliasingType].cropOffsetX;
      dragState.current.initialOffsetY = liveValueAliasingSettings[valueAliasingType].cropOffsetY;
      
      document.body.style.cursor = 'grabbing';
  }, [valueAliasingCropIsNeeded, liveValueAliasingSettings, valueAliasingType]);

  const handleValueAliasingDragMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!dragState.current.isDragging || !image) return;
      
      dragState.current.hasMoved = true;

      const point = 'touches' in e ? e.touches[0] : e;
      
      let deltaX = point.clientX - dragState.current.startX;
      let deltaY = point.clientY - dragState.current.startY;
      
      const activeCanvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;

      if (activeCanvas) {
          const rect = activeCanvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
              const scaleX = currentValueAliasingWidth / rect.width;
              const scaleY = currentValueAliasingHeight / rect.height;
              deltaX *= scaleX;
              deltaY *= scaleY;
          }
      }
      
      const imgAspect = image.width / image.height;
      const canvasAspect = currentValueAliasingWidth / currentValueAliasingHeight;
      
      let panRangeX = 0, panRangeY = 0;
      if (imgAspect > canvasAspect) { panRangeX = (currentValueAliasingHeight * imgAspect) - currentValueAliasingWidth; }
      else if (imgAspect < canvasAspect) { panRangeY = (currentValueAliasingWidth / imgAspect) - currentValueAliasingHeight; }
      
      let newOffsetX = panRangeX > 0 ? dragState.current.initialOffsetX - (deltaX / panRangeX) : dragState.current.initialOffsetX;
      let newOffsetY = panRangeY > 0 ? dragState.current.initialOffsetY - (deltaY / panRangeY) : dragState.current.initialOffsetY;
      
      setLiveValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], cropOffsetX: Math.max(0, Math.min(1, newOffsetX)), cropOffsetY: Math.max(0, Math.min(1, newOffsetY)) } }));
  }, [image, currentValueAliasingWidth, currentValueAliasingHeight, valueAliasingType, isFullScreenPreview]);

  const handleValueAliasingDragEnd = useCallback(() => {
      if (dragState.current.isDragging) {
          dragState.current.isDragging = false;
          
          if (dragState.current.hasMoved) {
            trackEvent('value_aliasing_crop', { value_aliasing_type: valueAliasingType });
          }

          const { cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY } = liveValueAliasingSettings[valueAliasingType];
          setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY } }));
          
          document.body.style.cursor = 'default';
      }
  }, [liveValueAliasingSettings, valueAliasingType, setValueAliasingSettings]);

  useEffect(() => {
      const onMove = (e: MouseEvent | TouchEvent) => handleValueAliasingDragMove(e);
      const onEnd = () => handleValueAliasingDragEnd();

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);

      return () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onEnd);
          document.removeEventListener('touchmove', onMove);
          document.removeEventListener('touchend', onEnd);
          document.removeEventListener('touchcancel', onEnd);
      }
  }, [handleValueAliasingDragMove, handleValueAliasingDragEnd]);

  const handleValueAliasingTypeSelect = (type: string) => {
    trackEvent('value_aliasing_type_select', { type });
    setValueAliasingType(type as 'phone' | 'desktop');
  };
  
  const handleStyleChange = (style: 'dark' | 'light') => {
    const newBg = style === 'dark' ? 'black' : 'white';
    trackEvent('value_aliasing_style_change', { style, value_aliasing_type: valueAliasingType });
    setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], background: newBg } }));
  };
  
  const valueAliasingTypeOptions = [
      { key: 'phone', label: 'Phone' },
      { key: 'desktop', label: 'Desktop' }
  ];

  const styleOptions = [
      { key: 'dark', label: 'Dark' },
      { key: 'light', label: 'Light' }
  ];

  const controlsPanel = imageSrc ? (
     <div className="max-w-md mx-auto w-full flex flex-col space-y-4 px-6 sm:px-6 md:px-8 pt-6 md:pt-3 pb-8 sm:pb-6 md:pb-8">
      {!isEasterEggActive ? (
        <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
          <SegmentedControl options={valueAliasingTypeOptions} selected={valueAliasingType} onSelect={handleValueAliasingTypeSelect} theme={theme} />
          <SegmentedControl
              options={styleOptions}
              selected={liveValueAliasingState.background === 'black' ? 'dark' : 'light'}
              onSelect={(key) => handleStyleChange(key as 'dark' | 'light')}
              theme={theme}
          />
        </div>
      ) : (
        <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
          <SegmentedControl options={valueAliasingTypeOptions} selected={valueAliasingType} onSelect={handleValueAliasingTypeSelect} theme={theme} />
        </div>
      )}

      <div className="flex justify-center items-center space-x-4">
        <UndoRedoControls onUndo={() => { undoValueAliasing(); trackEvent('value_aliasing_undo'); }} onRedo={() => { redoValueAliasing(); trackEvent('value_aliasing_redo'); }} canUndo={canUndoValueAliasing} canRedo={canRedoValueAliasing} theme={theme} />
        {isEasterEggActive && (
            <button
                onClick={handleRefreshGrid}
                className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors duration-200 rounded-md ${theme === 'dark' ? 'bg-gray-700 text-nothing-light hover:bg-gray-600' : 'bg-gray-200 text-day-text hover:bg-gray-300'}`}
                aria-label="Randomize Background Grid"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                 <span>Refresh</span>
            </button>
        )}
      </div>
      
      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <EnhancedSlider 
            theme={theme}
            isMobile={isMobile}
            label="Exposure"
            value={exposure} 
            onChange={v => setLiveValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], exposure: v } }))} 
            onChangeCommitted={v => {
              setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], exposure: v } }));
              trackEvent('value_aliasing_slider_change', { slider_name: 'exposure', value: v, value_aliasing_type: valueAliasingType });
            }}
            onReset={() => {
              setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], exposure: DEFAULT_SLIDER_VALUE } }));
            }}
            disabled={isLoading} 
        />
        <EnhancedSlider 
            theme={theme}
            isMobile={isMobile}
            label="Contrast"
            value={contrast} 
            onChange={v => setLiveValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], contrast: v } }))} 
            onChangeCommitted={v => {
              setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], contrast: v } }));
              trackEvent('value_aliasing_slider_change', { slider_name: 'contrast', value: v, value_aliasing_type: valueAliasingType });
            }}
            onReset={() => {
              setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], contrast: DEFAULT_SLIDER_VALUE } }));
            }}
            disabled={isLoading} 
        />
        <EnhancedSlider 
            theme={theme}
            isMobile={isMobile}
            label="Resolution" 
            value={resolution} 
            onChange={v => setLiveValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], resolution: v } }))} 
            onChangeCommitted={v => {
              setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], resolution: v } }));
              trackEvent('value_aliasing_slider_change', { slider_name: 'resolution', value: v, value_aliasing_type: valueAliasingType });
            }}
            onReset={() => {
              setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], resolution: DEFAULT_SLIDER_VALUE } }));
            }}
            disabled={isLoading} 
        />
        <EnhancedSlider 
            theme={theme}
            isMobile={isMobile}
            label="Pixel Gap" 
            value={pixelGap} 
            onChange={v => setLiveValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], pixelGap: v } }))}
            onChangeCommitted={v => {
              setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], pixelGap: v } }));
              trackEvent('value_aliasing_slider_change', { slider_name: 'pixel_gap', value: v, value_aliasing_type: valueAliasingType });
            }} 
            onReset={() => {
              setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], pixelGap: DEFAULT_SLIDER_VALUE } }));
            }}
            disabled={isLoading} 
        />
        <EnhancedSlider 
            theme={theme}
            isMobile={isMobile}
            label="Lower Limit" 
            value={lowerLimit} 
            onChange={v => setLiveValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], lowerLimit: v } }))}
            onChangeCommitted={v => {
              setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], lowerLimit: v } }));
              trackEvent('value_aliasing_slider_change', { slider_name: 'lower_limit', value: v, value_aliasing_type: valueAliasingType });
            }} 
            onReset={() => {
              setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], lowerLimit: 0 } }));
            }}
            disabled={isLoading} 
        />
      </div>

      {!isEasterEggActive && (
      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
            <label htmlFor="pure-values-toggle" className="text-sm">Pure Values</label>
            <button id="pure-values-toggle" role="switch" aria-checked={isPureValue} onClick={() => { 
                const newValue = !liveValueAliasingState.isPureValue;
                setValueAliasingSettings(s => ({...s, [valueAliasingType]: { ...s[valueAliasingType], isPureValue: newValue }})); 
                trackEvent('value_aliasing_toggle_change', { setting: 'pure_values', enabled: newValue, value_aliasing_type: valueAliasingType });
            }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isPureValue ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isPureValue ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
            <label htmlFor="transparent-output-toggle" className="text-sm">Transparent Output</label>
            <button id="transparent-output-toggle" role="switch" aria-checked={isTransparent} onClick={() => { 
                const newValue = !liveValueAliasingState.isTransparent;
                setValueAliasingSettings(s => ({...s, [valueAliasingType]: { ...s[valueAliasingType], isTransparent: newValue }})); 
                trackEvent('value_aliasing_toggle_change', { setting: 'transparent_output', enabled: newValue, value_aliasing_type: valueAliasingType });
            }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isTransparent ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isTransparent ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
      </div>
      )}
      
      <div className="pt-2 flex space-x-2">
        <button onClick={clearImage} disabled={isLoading} className={`w-1/2 border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Clear the current image">Clear Image</button>
        <button onClick={handleResetCurrentValueAliasing} disabled={isLoading} className={`w-1/2 border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Reset value aliasing controls to their default values">Reset Controls</button>
      </div>
      <div className="block md:hidden pt-8"><footer className="text-center tracking-wide">{footerLinks}</footer></div>
    </div>
  ) : null;
  
  const previewPanel = !imageSrc ? (
    <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} theme={theme} context="valueAliasing"/>
  ) : (
    <>
        <input
            type="file"
            ref={fullScreenFileInputRef}
            onChange={handleFullScreenFileInputChange}
            className="hidden"
            accept="image/*"
        />
        <div className="relative flex items-center justify-center w-full h-full">
            <canvas 
                ref={canvasRef} 
                width={currentValueAliasingWidth} 
                height={currentValueAliasingHeight} 
                className={`border-2 rounded-lg ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} ${valueAliasingType === 'phone' ? (isMobile ? 'w-4/5 h-auto' : 'max-h-full w-auto') : 'max-w-full max-h-full'}`} 
                aria-label="Value Aliasing Canvas" 
                onMouseDown={handleValueAliasingDragStart}
                onTouchStart={handleValueAliasingDragStart}
                style={{
                    cursor: valueAliasingCropIsNeeded ? 'grab' : 'default',
                    touchAction: valueAliasingCropIsNeeded ? 'none' : 'auto',
                    backgroundColor: (isTransparent && !isEasterEggActive && theme === 'dark') ? '#14151f' : (isTransparent && !isEasterEggActive && theme === 'light') ? '#efefef' : 'transparent',
                }}
            />
            <button
                onClick={enterFullScreen}
                className={`absolute bottom-3 right-3 z-10 p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`}
                aria-label="Enter full-screen preview"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
            </button>
        </div>
        {isFullScreenPreview && createPortal(
            <div
                ref={fullScreenContainerRef}
                className="fixed inset-0 bg-black z-50 flex items-center justify-center"
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) {
                        dragState.current.hasMoved = false;
                    }
                }}
                onClick={(e) => {
                    if (e.target === e.currentTarget && !dragState.current.hasMoved) {
                        if (isFullScreenControlsOpen) {
                            setIsFullScreenControlsOpen(false);
                        } else {
                            exitFullScreen();
                        }
                    }
                }}
            >
                <canvas
                    ref={fullScreenCanvasRef}
                    width={currentValueAliasingWidth}
                    height={currentValueAliasingHeight}
                    className="max-w-full max-h-full"
                    aria-label="Full-screen Value Aliasing Canvas Preview"
                    onMouseDown={handleValueAliasingDragStart}
                    onTouchStart={handleValueAliasingDragStart}
                    style={{
                        cursor: valueAliasingCropIsNeeded ? 'grab' : 'default',
                        touchAction: valueAliasingCropIsNeeded ? 'none' : 'auto'
                    }}
                />
                
                {easterEggPrimed && (
                    <button
                        onClick={() => {
                            activateEasterEgg();
                            setEasterEggPrimed(false);
                        }}
                        className={`fixed top-4 right-4 z-[52] flex items-center p-2 px-3 transition-colors duration-300 rounded-md text-sm font-semibold easter-egg-glow`}
                        aria-label="Click to Unlock"
                    >
                        Click to Unlock
                    </button>
                )}

                {!isMobile && (
                  <div className="fixed bottom-4 left-4 z-[51] w-80 flex flex-col items-start space-y-2">
                    <div className="w-full">
                      {isFullScreenControlsOpen ? (
                        <div className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80' : 'bg-day-bg/90 border border-gray-300/50'} backdrop-blur-sm rounded-lg p-4 max-h-[calc(100vh-10rem)] flex flex-col space-y-4 shadow-2xl`}>
                          <div className="flex justify-between items-center flex-shrink-0">
                            <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-day-text'}`}>Controls</h3>
                            <button onClick={() => { setIsFullScreenControlsOpen(false); trackEvent('value_aliasing_fullscreen_controls_toggle', { open: false }); }} className={`p-2 ${theme === 'dark' ? 'text-white hover:bg-white/20' : 'text-day-text hover:bg-black/10'} rounded-full transition-colors`} aria-label="Collapse controls">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                            </button>
                          </div>

                          <div className="overflow-y-auto space-y-4 pr-2 -mr-2">
                          {!isEasterEggActive ? (
                            <div className={`p-3 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
                                <SegmentedControl options={valueAliasingTypeOptions} selected={valueAliasingType} onSelect={handleValueAliasingTypeSelect} theme={theme} />
                                <SegmentedControl
                                    options={styleOptions}
                                    selected={liveValueAliasingState.background === 'black' ? 'dark' : 'light'}
                                    onSelect={(key) => handleStyleChange(key as 'dark' | 'light')}
                                    theme={theme}
                                />
                            </div>
                          ) : (
                            <div className={`p-3 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
                                <SegmentedControl options={valueAliasingTypeOptions} selected={valueAliasingType} onSelect={handleValueAliasingTypeSelect} theme={theme} />
                            </div>
                          )}
                            <div className="flex justify-center items-center space-x-4">
                                <UndoRedoControls onUndo={() => { undoValueAliasing(); trackEvent('value_aliasing_undo'); }} onRedo={() => { redoValueAliasing(); trackEvent('value_aliasing_redo'); }} canUndo={canUndoValueAliasing} canRedo={canRedoValueAliasing} theme={theme} />
                                {isEasterEggActive && (
                                    <button
                                        onClick={handleRefreshGrid}
                                        className={`p-2 transition-colors duration-200 rounded-md ${theme === 'dark' ? 'bg-gray-700 text-nothing-light hover:bg-gray-600' : 'bg-gray-200 text-day-text hover:bg-gray-300'}`}
                                        aria-label="Randomize Background Grid"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                                            <polyline points="23 4 23 10 17 10"></polyline>
                                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'} space-y-4`}>
                                <EnhancedSlider 
                                    theme={theme}
                                    isMobile={isMobile}
                                    label="Exposure"
                                    value={exposure} 
                                    onChange={v => setLiveValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], exposure: v } }))} 
                                    onChangeCommitted={v => {
                                      setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], exposure: v } }));
                                      trackEvent('value_aliasing_slider_change', { slider_name: 'exposure', value: v, value_aliasing_type: valueAliasingType });
                                    }}
                                    onReset={() => {
                                      setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], exposure: DEFAULT_SLIDER_VALUE } }));
                                    }}
                                    disabled={isLoading} 
                                />
                                <EnhancedSlider 
                                    theme={theme}
                                    isMobile={isMobile}
                                    label="Contrast"
                                    value={contrast} 
                                    onChange={v => setLiveValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], contrast: v } }))} 
                                    onChangeCommitted={v => {
                                      setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], contrast: v } }));
                                      trackEvent('value_aliasing_slider_change', { slider_name: 'contrast', value: v, value_aliasing_type: valueAliasingType });
                                    }}
                                    onReset={() => {
                                      setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], contrast: DEFAULT_SLIDER_VALUE } }));
                                    }}
                                    disabled={isLoading} 
                                />
                                <EnhancedSlider 
                                    theme={theme}
                                    isMobile={isMobile}
                                    label="Resolution" 
                                    value={resolution} 
                                    onChange={v => setLiveValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], resolution: v } }))} 
                                    onChangeCommitted={v => {
                                      setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], resolution: v } }));
                                      trackEvent('value_aliasing_slider_change', { slider_name: 'resolution', value: v, value_aliasing_type: valueAliasingType });
                                    }}
                                    onReset={() => {
                                      setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], resolution: DEFAULT_SLIDER_VALUE } }));
                                    }}
                                    disabled={isLoading} 
                                />
                                <EnhancedSlider 
                                    theme={theme}
                                    isMobile={isMobile}
                                    label="Pixel Gap" 
                                    value={pixelGap} 
                                    onChange={v => setLiveValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], pixelGap: v } }))}
                                    onChangeCommitted={v => {
                                      setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], pixelGap: v } }));
                                      trackEvent('value_aliasing_slider_change', { slider_name: 'pixel_gap', value: v, value_aliasing_type: valueAliasingType });
                                    }}
                                    onReset={() => {
                                      setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], pixelGap: DEFAULT_SLIDER_VALUE } }));
                                    }}
                                    disabled={isLoading} 
                                />
                                 <EnhancedSlider 
                                    theme={theme}
                                    isMobile={isMobile}
                                    label="Lower Limit" 
                                    value={lowerLimit} 
                                    onChange={v => setLiveValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], lowerLimit: v } }))}
                                    onChangeCommitted={v => {
                                      setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], lowerLimit: v } }));
                                      trackEvent('value_aliasing_slider_change', { slider_name: 'lower_limit', value: v, value_aliasing_type: valueAliasingType });
                                    }} 
                                    onReset={() => {
                                      setValueAliasingSettings(s => ({ ...s, [valueAliasingType]: { ...s[valueAliasingType], lowerLimit: 0 } }));
                                    }}
                                    disabled={isLoading} 
                                />
                            </div>
                            {!isEasterEggActive && (
                            <div className={`p-3 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
                                <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                                    <label htmlFor="pure-values-toggle-fs" className="text-sm">Pure Values</label>
                                    <button id="pure-values-toggle-fs" role="switch" aria-checked={isPureValue} onClick={() => { 
                                        const newValue = !liveValueAliasingState.isPureValue;
                                        setValueAliasingSettings(s => ({...s, [valueAliasingType]: { ...s[valueAliasingType], isPureValue: newValue }})); 
                                        trackEvent('value_aliasing_toggle_change', { setting: 'pure_values', enabled: newValue, value_aliasing_type: valueAliasingType }); 
                                    }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isPureValue ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isPureValue ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                                    <label htmlFor="transparent-output-toggle-fs" className="text-sm">Transparent Output</label>
                                    <button id="transparent-output-toggle-fs" role="switch" aria-checked={isTransparent} onClick={() => { 
                                        const newValue = !liveValueAliasingState.isTransparent;
                                        setValueAliasingSettings(s => ({...s, [valueAliasingType]: { ...s[valueAliasingType], isTransparent: newValue }})); 
                                        trackEvent('value_aliasing_toggle_change', { setting: 'transparent_output', enabled: newValue, value_aliasing_type: valueAliasingType }); 
                                    }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isTransparent ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isTransparent ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                            )}
                            <div>
                              <button onClick={handleResetCurrentValueAliasing} disabled={isLoading} className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' : 'border border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Reset value aliasing controls to their default values"> Reset Controls </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setIsFullScreenControlsOpen(true); trackEvent('value_aliasing_fullscreen_controls_toggle', { open: true }); }} className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80 text-white hover:bg-nothing-dark' : 'bg-day-bg/90 text-day-text hover:bg-day-gray-light border border-gray-300/50'} backdrop-blur-sm font-semibold py-3 px-4 rounded-lg flex items-center justify-between shadow-lg transition-colors`} aria-label="Expand controls">
                          <span>Controls</span>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/></svg>
                        </button>
                      )}
                    </div>
                    
                    <div className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80' : 'bg-day-bg/90 border border-gray-300/50'} backdrop-blur-sm rounded-lg p-2 flex flex-col items-stretch space-y-2 shadow-lg`}>
                        <button
                            onClick={handleFullScreenReplaceClick}
                            disabled={isLoading}
                            className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' : 'border border-gray-300 text-day-gray-dark hover:bg-gray-200'}`}
                            aria-label="Replace the current image"
                        >
                            Replace Image
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={isLoading || isDownloading}
                            className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`}
                            aria-label="Download the current image"
                        >
                            Download
                        </button>
                    </div>
                  </div>
                )}

                <button
                    onClick={exitFullScreen}
                    className={`fixed bottom-8 right-8 z-50 p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`}
                    aria-label="Exit full-screen preview"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                    </svg>
                </button>
                <ToastNotification
                  show={showFsToast}
                  onClose={() => setShowFsToast(false)}
                  theme={theme}
                  isMobile={false}
                  imageRendered={!!imageSrc}
                  className="z-[60]"
                />
            </div>,
            document.body
        )}
    </>
  );

  const downloadButton = <button onClick={handleDownload} disabled={isLoading || isDownloading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download the current image"> Download </button>;

  const replaceButton = <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} compact={true} theme={theme}/>;

  return { previewPanel, controlsPanel, imageSrc, isLoading, handleFileSelect, handleDownload, downloadButton, replaceButton, valueAliasingType: valueAliasingType, activateEasterEgg, isEasterEggActive };
};
