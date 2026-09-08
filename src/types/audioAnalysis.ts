/**
 * AI 音声解析（セクション色分け波形）用の共通型。
 * StructureResultV2 / Phase1 BeatEvent からのブリッジ先としても使う。
 */

/** セクション種別（英語キー）。表示ラベルは sectionMeta で日本語化する */
export type SectionType =
  | "intro"
  | "verse"
  | "pre_chorus"
  | "chorus"
  | "bridge"
  | "outro"
  | "unknown";

export interface MusicSection {
  id: string;
  type: SectionType;
  /** 表示用（例: "Aメロ", "サビ"） */
  label: string;
  /** 秒（ミリ秒精度） */
  startTime: number;
  endTime: number;
  /** 波形表示用カラー（CSS） */
  color: string;
  /** セクション単位 BPM（マルチ BPM / EDIT 音源向け） */
  bpm?: number;
}

export interface BeatInfo {
  /** 秒 */
  timestamp: number;
  /** 1拍目（ダウンビート）かどうか */
  isDownbeat: boolean;
  /** 1–4（小節内）または 1–8（ダンスカウント） */
  beatNumber: number;
}

/** 曲全体の解析結果（UI・スナップの単一ソース） */
export interface AudioAnalysisResult {
  duration: number;
  beats: BeatInfo[];
  sections: MusicSection[];
  /** 解析ソース表示用（例: fly-structure-v2） */
  sourceLabel?: string;
  /** グローバル推定 BPM（セクション bpm が無いときのフォールバック） */
  bpm?: number;
}
