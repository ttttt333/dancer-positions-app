/**
 * Supabase audio_assetsテーブルの型定義
 */
export interface AudioAsset {
  id: number;
  /** ファイル名（例: music.mp3） */
  filename: string;
  /** MIMEタイプ（例: audio/mpeg） */
  mime_type: string;
  /** ファイルサイズ（bytes） */
  file_size: number;
  /** 音源の尺（秒） */
  duration_sec: number | null;
  /** Supabase Storage内のパス */
  storage_path: string;
  /** 波形データ（JSON文字列） */
  wave_peaks: string | null;
  /** 作成日時 */
  created_at: string;
  /** 更新日時 */
  updated_at: string;
  /** ユーザーID（RLS用） */
  user_id: string | null;
}

/**
 * 音源アップロード用の型
 */
export interface AudioAssetUpload {
  file: File;
  filename: string;
  mime_type: string;
  file_size: number;
  duration_sec: number | null;
  wave_peaks: number[] | null;
}

/**
 * 音源APIレスポンス用の型
 */
export interface AudioAssetResponse {
  id: number;
  filename: string;
  mime_type: string;
  file_size: number;
  duration_sec: number | null;
  storage_path: string;
  wave_peaks: number[] | null;
  created_at: string;
  updated_at: string;
}
