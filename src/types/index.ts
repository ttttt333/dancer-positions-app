// 統一データモデル - シンプル維持
export interface Project {
  id: string;
  name: string;
  dancers: Dancer[];
  formations: Formation[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Dancer {
  id: string;
  name: string;
  color: string;
  number?: number;
}

export interface Formation {
  id: string;
  name: string;
  positions: Position[];
  timestamp: number; // 音源上の秒数
  duration?: number; // キューの持続時間
}

export interface Position {
  dancerId: string;
  x: number;
  y: number;
}

export interface ShareToken {
  id: string;
  projectId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

// UI状態
export interface UIState {
  selectedFormationId: string | null;
  selectedDancerIds: string[];
  isPlaying: boolean;
  currentTime: number;
  zoom: number;
}
