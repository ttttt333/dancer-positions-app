export type HitType =
  | "KICK"
  | "SNARE"
  | "DROP"
  | "IMPACT"
  | "MUSICAL_HIT"
  | "UNKNOWN";

export type HitEvent = {
  id: string;
  time: number;
  strength: number;
  type: HitType;
  confidence: number;
};
