
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useHistory } from './hooks';
import { getTimestamp } from './utils';
import { PhotoWidgetState, PhotoWidgetColorMatrix, Theme, PhotoWidgetOutputMode } from './types';
import { Dropzone, EnhancedSlider, UndoRedoControls, OutputModeSelector } from './components';

const PHOTO_WIDGET_CANVAS_SIZE = 1176;
const PADDING = 50;
const DEFAULT_SLIDER_VALUE = 50;

const PHOTO_WIDGET_INITIAL_STATE: PhotoWidgetState = {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: DEFAULT_SLIDER_VALUE,
    isCircular: true,
    isAntiAliased: false,
    isBordered: false,
    outputMode: 'transparent',
};

const drawPhotoWidgetMatrix = (ctx: CanvasRenderingContext2D, options: {
    width: number;
    height: number;
    outputMode: PhotoWidgetOutputMode;
    matrix: PhotoWidgetColorMatrix;
    pixelGap: number;
    isCircular: boolean;
    isAntiAliased: boolean;
}) => {
    const { width, height, outputMode, matrix, pixelGap, isCircular, isAntiAliased } = options;
    
    switch (outputMode) {
        case 'transparent':
            ctx.clearRect(0, 0, width, height);
            break;
        case 'dark':
            ctx.fillStyle = '#212121';
            ctx.fillRect(0, 0, width, height);
            break;
        case 'light':
            ctx.fillStyle = '#f1f0f1';
            ctx.fillRect(0, 0, width, height);
            break;
    }

    if (!matrix || matrix.length === 0 || matrix[0].length === 0) return;
    const gridHeight = matrix.length, gridWidth = matrix[0].length;
    const drawableArea = width - PADDING * 2;
    const matrixAspect = gridWidth / gridHeight;
    let renderAreaWidth = drawableArea, renderAreaHeight = drawableArea / matrixAspect;
    if (renderAreaHeight > drawableArea) {
        renderAreaHeight = drawableArea;
        renderAreaWidth = drawableArea * matrixAspect;
    }
    const offsetX = PADDING + (drawableArea - renderAreaWidth) / 2;
    const offsetY = PADDING + (drawableArea - renderAreaHeight) / 2;
    const cellWidth = renderAreaWidth / gridWidth, cellHeight = renderAreaHeight / gridHeight;
    const gapRatio = (( (70/50) * pixelGap) / 100) * 0.2765;
    const pixelWidth = cellWidth * (1 - gapRatio), pixelHeight = cellHeight * (1 - gapRatio);
    
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const pixel = matrix[y][x];
            if (pixel) {
                const coverage = pixel.a / 255;
                let finalPixelWidth = pixelWidth, finalPixelHeight = pixelHeight;
                if (isAntiAliased) {
                    const sizeMultiplier = Math.sqrt(coverage);
                    finalPixelWidth *= sizeMultiplier;
                    finalPixelHeight *= sizeMultiplier;
                }
                ctx.fillStyle = `rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`;
                const cellX = offsetX + x * cellWidth, cellY = offsetY + y * cellHeight;
                if (isCircular) {
                    const radius = Math.min(finalPixelWidth, finalPixelHeight) / 2;
                    if (radius > 0.1) {
                        ctx.beginPath();
                        ctx.arc(cellX + cellWidth / 2, cellY + cellHeight / 2, radius, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                } else {
                    if (finalPixelWidth > 0.1 && finalPixelHeight > 0.1) {
                        const rectX = cellX + (cellWidth - finalPixelWidth) / 2, rectY = cellY + (cellHeight - finalPixelHeight) / 2;
                        ctx.fillRect(rectX, rectY, finalPixelWidth, finalPixelHeight);
                    }
                }
            }
        }
    }
};

export const usePhotoWidgetPanel = ({ theme, footerLinks }: { theme: Theme, isMobile: boolean, footerLinks: React.ReactNode }) => {
  const { state: photoWidgetState, setState: setPhotoWidgetState, undo: undoPhotoWidget, redo: redoPhotoWidget, reset: resetPhotoWidget, canUndo: canUndoPhotoWidget, canRedo: canRedoPhotoWidget } = useHistory(PHOTO_WIDGET_INITIAL_STATE);
  const [livePhotoWidgetState, setLivePhotoWidgetState] = useState(photoWidgetState);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [colorMatrix, setColorMatrix] = useState<PhotoWidgetColorMatrix | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aaWasOnBeforeBorder, setAaWasOnBeforeBorder] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { resolution, pixelGap, isCircular, isAntiAliased, isBordered, outputMode } = livePhotoWidgetState;
  
  useEffect(() => { setLivePhotoWidgetState(photoWidgetState); }, [photoWidgetState]);

  useEffect(() => {
    if (!imageSrc) { setImage(null); return; }
    setIsLoading(true);
    const img = new Image();
    img.onload = () => { setImage(img); setIsLoading(false); };
    img.onerror = () => { setImageSrc(null); setImage(null); setIsLoading(false); };
    img.src = imageSrc;
  }, [imageSrc]);

  const handleFileSelect = (file: File) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
        setImageSrc(e.target?.result as string);
        resetPhotoWidget();
        setAaWasOnBeforeBorder(false);
        setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };
  
  useEffect(() => {
    if (!image) { setColorMatrix(null); return; }
    const resValue = 20 + Math.floor(((resolution * 0.515) / 100) * 130);
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;
    const gridWidth = resValue, gridHeight = Math.round(gridWidth * (image.height / image.width));
    tempCanvas.width = gridWidth; tempCanvas.height = gridHeight;
    tempCtx.imageSmoothingEnabled = true; tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(image, 0, 0, gridWidth, gridHeight);
    const imageData = tempCtx.getImageData(0, 0, gridWidth, gridHeight).data;
    const newMatrix: PhotoWidgetColorMatrix = Array.from({ length: gridHeight }, (_, y) => 
        Array.from({ length: gridWidth }, (_, x) => {
            const i = (y * gridWidth + x) * 4;
            return imageData[i+3] > 10 ? { r: imageData[i], g: imageData[i+1], b: imageData[i+2], a: imageData[i+3] } : null;
        })
    );
    if (isBordered) {
        const borderedMatrix: PhotoWidgetColorMatrix = newMatrix.map(row => [...row]);
        const h = borderedMatrix.length, w = borderedMatrix[0]?.length || 0;
        const borderColor = outputMode === 'dark' 
            ? { r: 241, g: 240, b: 241, a: 255 } // #f1f0f1 for dark mode
            : { r: 33, g: 33, b: 33, a: 255 }; // #212121 for transparent/light mode

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (newMatrix[y][x] === null) {
                    const neighbors = [[-1,0],[1,0],[0,-1],[0,1]];
                    if (neighbors.some(([dy,dx]) => newMatrix[y+dy]?.[x+dx])) {
                        borderedMatrix[y][x] = borderColor;
                    }
                }
            }
        }
        setColorMatrix(borderedMatrix);
    } else {
        setColorMatrix(newMatrix);
    }
  }, [image, resolution, isBordered, outputMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !colorMatrix) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPhotoWidgetMatrix(ctx, { width: PHOTO_WIDGET_CANVAS_SIZE, height: PHOTO_WIDGET_CANVAS_SIZE, outputMode, matrix: colorMatrix, pixelGap, isCircular, isAntiAliased });
  }, [colorMatrix, pixelGap, isCircular, isAntiAliased, outputMode]);

  const handleDownload = () => {
    if (!colorMatrix) return;
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_WIDGET_CANVAS_SIZE; canvas.height = PHOTO_WIDGET_CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPhotoWidgetMatrix(ctx, { ...photoWidgetState, width: PHOTO_WIDGET_CANVAS_SIZE, height: PHOTO_WIDGET_CANVAS_SIZE, matrix: colorMatrix });
    const link = document.createElement('a');
    link.download = `matrices-photowidget-${getTimestamp()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const controlsPanel = imageSrc ? (
    <div className="max-w-md mx-auto w-full flex flex-col space-y-4 px-6 sm:px-6 md:px-8 pt-6 md:pt-3 pb-8 sm:pb-6 md:pb-8">
        <UndoRedoControls onUndo={undoPhotoWidget} onRedo={redoPhotoWidget} canUndo={canUndoPhotoWidget} canRedo={canRedoPhotoWidget} theme={theme} />
        <EnhancedSlider theme={theme} label="Resolution" value={resolution} onChange={v => setLivePhotoWidgetState(s => ({...s, resolution: v}))} onChangeCommitted={v => setPhotoWidgetState(s => ({...s, resolution: v}))} onReset={() => setPhotoWidgetState(s => ({...s, resolution: DEFAULT_SLIDER_VALUE}))} disabled={isLoading} />
        <EnhancedSlider theme={theme} label="Pixel Gap" value={pixelGap} onChange={v => setLivePhotoWidgetState(s => ({...s, pixelGap: v}))} onChangeCommitted={v => setPhotoWidgetState(s => ({...s, pixelGap: v}))} onReset={() => setPhotoWidgetState(s => ({...s, pixelGap: DEFAULT_SLIDER_VALUE}))} disabled={isLoading} />
        
        <div className="pt-4 space-y-4">
            <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                <label htmlFor="pw-circular-toggle" className="text-sm">Circular Pixels</label>
                <button id="pw-circular-toggle" role="switch" aria-checked={isCircular} onClick={() => setPhotoWidgetState(s => ({...s, isCircular: !s.isCircular}))} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isCircular ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isCircular ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
             <OutputModeSelector 
                label="Output Mode"
                selected={outputMode}
                onSelect={(mode) => setPhotoWidgetState(s => ({ ...s, outputMode: mode }))}
                theme={theme}
            />
        </div>

        <div className={`border-t ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} mt-6 pt-4`}>
            <button onClick={() => setShowAdvanced(!showAdvanced)} className={`w-full flex justify-between items-center ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} py-1 focus:outline-none`} aria-expanded={showAdvanced} aria-controls="pw-advanced-options-panel">
                <span className="text-sm font-medium">More Controls</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 transform transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            <div id="pw-advanced-options-panel" className={`overflow-hidden transition-all duration-500 ease-in-out ${showAdvanced ? 'max-h-96 pt-4' : 'max-h-0'}`}>
              <div className="space-y-4">
                  <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                      <label htmlFor="pw-aa-toggle" className="text-sm">Anti-aliasing</label>
                      <button id="pw-aa-toggle" role="switch" aria-checked={isAntiAliased} onClick={() => {
                          setPhotoWidgetState(s => ({
                              ...s,
                              isAntiAliased: !s.isAntiAliased,
                              isBordered: !s.isAntiAliased ? false : s.isBordered,
                          }));
                      }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} disabled:opacity-50 ${isAntiAliased ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                          <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isAntiAliased ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                  </div>
                  <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                      <label htmlFor="pw-border-toggle" className="text-sm">Border</label>
                      <button id="pw-border-toggle" role="switch" aria-checked={isBordered} onClick={() => {
                          if (!isBordered) {
                              setAaWasOnBeforeBorder(isAntiAliased);
                              setPhotoWidgetState(s => ({ ...s, isBordered: true, isAntiAliased: false }));
                          } else {
                              setPhotoWidgetState(s => ({ ...s, isBordered: false, isAntiAliased: aaWasOnBeforeBorder }));
                          }
                      }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} disabled:opacity-50 ${isBordered ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                          <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isBordered ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                  </div>
              </div>
            </div>
        </div>
        
        <div className="pt-6">
            <button onClick={() => { resetPhotoWidget(); setAaWasOnBeforeBorder(false); }} disabled={isLoading} className={`w-full border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Restore photo widget settings to their default values"> Restore Defaults </button>
        </div>
        <div className="block md:hidden pt-8">
            <footer className="text-center tracking-wide">{footerLinks}</footer>
        </div>
    </div>
  ) : null;
  
  const previewPanel = !imageSrc ? (
    <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} theme={theme} accept="image/png" />
  ) : (
    <div className="w-full max-w-2xl mx-auto flex items-center justify-center">
        <canvas
            ref={canvasRef}
            width={PHOTO_WIDGET_CANVAS_SIZE}
            height={PHOTO_WIDGET_CANVAS_SIZE}
            className="max-w-full max-h-full h-auto w-auto rounded-lg"
            aria-label="Photo Widget Matrix Canvas"
        />
    </div>
  );

  const downloadButton = <button onClick={handleDownload} disabled={isLoading || !colorMatrix} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download the current widget"> Download </button>;
  
  const replaceButton = <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} compact={true} theme={theme} accept="image/png" />;

  return { previewPanel, controlsPanel, imageSrc, isLoading, handleFileSelect, handleDownload, downloadButton, replaceButton };
};