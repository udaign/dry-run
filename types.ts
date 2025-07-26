
export type RawPixel = number | { r: number; g: number; b: number };
export type Theme = 'light' | 'dark';
export type Tab = 'pfp' | 'wallpaper' | 'photoWidget';

// PFP
export type PfpState = {
    resolution: number;
    exposure: number;
    contrast: number;
    pixelGap: number;
    isCircular: boolean;
    isTransparent: boolean;
    isAntiAliased: boolean;
    isMatrixSquare: boolean;
};

// Wallpaper
export const WALLPAPER_BG_OPTIONS = {
    'black': { color: '#000000', name: 'Black' },
    'white': { color: '#FFFFFF', name: 'White' },
};
export type WallpaperBgKey = keyof typeof WALLPAPER_BG_OPTIONS;

export type WallpaperState = {
    resolution: number;
    pixelGap: number;
    isCircular: boolean;
    background: WallpaperBgKey;
    cropOffsetX: number;
    cropOffsetY: number;
};

// Photo Widget
export type PhotoWidgetOutputMode = 'transparent' | 'dark' | 'light';
export type PhotoWidgetAspectRatio = '2x2' | '4x2';

export type PhotoWidgetState = {
    resolution: number;
    exposure: number;
    contrast: number;
    saturation: number;
    pixelGap: number;
    isCircular: boolean;
    isAntiAliased: boolean;
    aspectRatio: PhotoWidgetAspectRatio;
};

export type PhotoWidgetColorMatrix = ({ r: number; g: number; b: number; a: number; } | null)[][];