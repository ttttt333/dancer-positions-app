// アプリケーション定数
export const APP_CONFIG = {
  NAME: 'ChoreoGrid',
  VERSION: '1.0.0',
  DESCRIPTION: '振付師向けフォーメーション作成ツール',
} as const;

// UI定数
export const UI_CONFIG = {
  STAGE: {
    DEFAULT_WIDTH: 800,
    DEFAULT_HEIGHT: 600,
    GRID_SIZE: 50,
  },
  COLORS: {
    PRIMARY: '#3b82f6',
    SECONDARY: '#6b7280',
    DANGER: '#ef4444',
    SUCCESS: '#10b981',
  },
  ANIMATION: {
    DURATION: 200,
  },
} as const;

// フォーメーションプリセット
export const FORMATION_PRESETS = {
  CIRCLE: 'circle',
  LINE: 'line',
  GRID: 'grid',
  V_SHAPE: 'v-shape',
  DIAMOND: 'diamond',
} as const;

// APIエンドポイント
export const API_ENDPOINTS = {
  PROJECT: '/api/project',
  SHARE: '/api/share',
  USER: '/api/user',
  AUDIO: '/api/audio',
} as const;
