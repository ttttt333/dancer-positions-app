import type { ChangePointType } from "../types/MusicTypes";
import type {
  CueEnergyContext,
  FormationCueAction,
  FormationCueIntent,
} from "../types/CueTypes";

export function decideActionAndIntent(
  types: Set<ChangePointType>,
  energy: CueEnergyContext,
  major: boolean,
  priority: number,
  microThreshold: number
): { action: FormationCueAction; intent: FormationCueIntent; reasonCodes: string[] } {
  const reasonCodes: string[] = [...types];
  if (major) reasonCodes.push("MAJOR_CLUSTER");

  if (energy.level === "HIGH" && energy.direction === "STABLE" && !major) {
    reasonCodes.push("ENERGY_PLATEAU");
    return {
      action: "HOLD",
      intent: {
        primary: "HOLD",
        secondary: ["MICRO_SHIFT"],
        prohibited: ["MAJOR_CHANGE"],
      },
      reasonCodes,
    };
  }

  if (energy.level === "LOW" && energy.direction === "STABLE" && !types.has("HIT")) {
    reasonCodes.push("LOW_STABLE");
    return {
      action: "HOLD",
      intent: { primary: "HOLD", secondary: [], prohibited: ["EXPAND", "MAJOR_CHANGE"] },
      reasonCodes,
    };
  }

  if (types.has("DRUM_BREAK")) {
    return pack("CLUSTER", ["CONTRACT", "CENTER"], ["EXPAND", "V"], reasonCodes);
  }

  if (types.has("SPECTRAL_CHANGE") && types.has("ENERGY_DROP")) {
    return pack("MERGE", ["CONTRACT", "CLUSTER"], ["EXPAND", "SPLIT"], reasonCodes);
  }

  if (types.has("SPECTRAL_CHANGE") && types.has("ENERGY_RISE") && !major) {
    return pack("SPLIT", ["EXPAND", "DIAGONAL"], ["CLUSTER", "MERGE"], reasonCodes);
  }

  if (energy.level === "HIGH" && energy.direction === "FALLING") {
    reasonCodes.push("HIGH_FALLING");
    return pack("CONTRACT", ["CLUSTER", "CENTER"], ["EXPAND"], reasonCodes);
  }

  if (energy.level === "LOW" && energy.direction === "RISING" && !major) {
    reasonCodes.push("LOW_RISING", "PREPARATION");
    return pack("MICRO_SHIFT", ["EXPAND", "CENTER"], ["CLUSTER"], reasonCodes);
  }

  if (types.has("ENERGY_DROP")) {
    return pack("CONTRACT", ["CLUSTER", "CENTER"], ["EXPAND", "V"], reasonCodes);
  }

  if (types.has("SILENCE") && !major) {
    return pack("HOLD", ["CLUSTER", "CENTER"], ["EXPAND", "MAJOR_CHANGE"], reasonCodes);
  }

  if (major && (types.has("SECTION_CHANGE") || (types.has("HIT") && types.has("ENERGY_RISE")))) {
    return pack("MAJOR_CHANGE", ["EXPAND", "V", "CENTER"], ["CLUSTER"], reasonCodes);
  }

  if (types.has("ENERGY_RISE") || (types.has("BASS_ENTRY") && energy.direction === "RISING")) {
    return pack("EXPAND", ["V", "DIAGONAL", "CENTER"], ["CLUSTER"], reasonCodes);
  }

  if (types.has("BASS_ENTRY")) {
    return pack("CENTER", ["EXPAND", "V"], ["CLUSTER"], reasonCodes);
  }

  if (types.has("DRUM_ENTRY")) {
    return pack("LINE", ["EXPAND", "V"], ["CLUSTER"], reasonCodes);
  }

  if (types.has("SECTION_CHANGE")) {
    const action: FormationCueAction = priority >= 66 ? "MAJOR_CHANGE" : "V";
    return pack(action, ["LINE", "EXPAND", "DIAGONAL"], ["HOLD"], reasonCodes);
  }

  if (types.has("HIT")) {
    const action: FormationCueAction =
      priority >= 80 ? "MAJOR_CHANGE" : priority >= microThreshold ? "MICRO_SHIFT" : "HOLD";
    return pack(action, ["CENTER", "MICRO_SHIFT"], ["MAJOR_CHANGE"], reasonCodes);
  }

  if (types.has("PHRASE_CHANGE") && priority >= microThreshold) {
    return pack("MICRO_SHIFT", ["LINE"], ["MAJOR_CHANGE"], reasonCodes);
  }

  if (priority < 21) {
    return pack("HOLD", [], ["MAJOR_CHANGE"], reasonCodes);
  }

  return pack("MICRO_SHIFT", ["CENTER"], ["MAJOR_CHANGE"], reasonCodes);
}

function pack(
  primary: FormationCueAction,
  secondary: FormationCueAction[],
  prohibited: FormationCueAction[],
  reasonCodes: string[]
): { action: FormationCueAction; intent: FormationCueIntent; reasonCodes: string[] } {
  return {
    action: primary,
    intent: {
      primary,
      secondary: secondary.filter((a) => a !== primary),
      prohibited: prohibited.filter((a) => a !== primary),
    },
    reasonCodes,
  };
}
