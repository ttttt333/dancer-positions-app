import { createSyntheticPhase1Analysis } from "../music/syntheticPhase1";
import type { MusicAnalysisResultPhase1 } from "../types";
import type {
  ChangePoint,
  ChangePointType,
  EventCluster,
  MusicPhrase,
  MusicSection,
  MusicStructureAnalysisResult,
} from "../types/MusicTypes";

export function makePhase1(
  duration = 80,
  bpm = 120
): MusicAnalysisResultPhase1 {
  return createSyntheticPhase1Analysis({
    bpm,
    segments: [
      {
        duration,
        energy: 40,
        bass: 0.2,
        onset: 0.3,
        high: 0.15,
      },
    ],
  });
}

export function makeChangePoint(
  type: ChangePointType,
  time: number,
  overrides: Partial<ChangePoint> = {}
): ChangePoint {
  const energyBefore = overrides.energyBefore ?? 40;
  const energyAfter = overrides.energyAfter ?? 50;
  return {
    id: overrides.id ?? `cp-${type}-${Math.round(time * 1000)}`,
    time: overrides.time ?? time,
    rawTime: overrides.rawTime ?? time,
    beatTime: overrides.beatTime ?? time,
    barTime: overrides.barTime ?? Math.floor(time / 2) * 2,
    barIndex: overrides.barIndex ?? Math.floor(time / 2),
    beatIndex: overrides.beatIndex ?? Math.round(time / 0.5),
    type,
    strength: overrides.strength ?? 50,
    confidence: overrides.confidence ?? 0.85,
    sourceEventIds:
      overrides.sourceEventIds ?? [`src-${type}-${Math.round(time * 1000)}`],
    energyBefore,
    energyAfter,
    deltaEnergy: overrides.deltaEnergy ?? energyAfter - energyBefore,
    priority: overrides.priority ?? 40,
  };
}

export function makeCluster(
  time: number,
  types: ChangePointType[],
  overrides: Partial<EventCluster> & {
    energyBefore?: number;
    energyAfter?: number;
    strength?: number;
    pointConfidence?: number;
  } = {}
): EventCluster {
  const {
    energyBefore: energyBeforeOverride,
    energyAfter: energyAfterOverride,
    strength: strengthOverride,
    pointConfidence,
    ...clusterOverrides
  } = overrides;
  const strength = strengthOverride ?? clusterOverrides.totalStrength ?? 50;
  const energyBefore = energyBeforeOverride ?? 40;
  const energyAfter = energyAfterOverride ?? 50;
  const confidence =
    pointConfidence ?? clusterOverrides.confidence ?? 0.85;
  const changePoints = types.map((type, i) =>
    makeChangePoint(type, time + i * 0.01, {
      strength,
      confidence,
      energyBefore,
      energyAfter,
      deltaEnergy: energyAfter - energyBefore,
    })
  );
  const dominantType = types[0] ?? "SPECTRAL_CHANGE";
  return {
    id: clusterOverrides.id ?? `ec-${Math.round(time * 1000)}-${dominantType}`,
    time: clusterOverrides.time ?? time,
    changePoints: clusterOverrides.changePoints ?? changePoints,
    dominantType: clusterOverrides.dominantType ?? dominantType,
    totalStrength: clusterOverrides.totalStrength ?? strength,
    confidence: clusterOverrides.confidence ?? confidence,
    isMajor: clusterOverrides.isMajor ?? false,
  };
}

export function makeStructure(
  clusters: EventCluster[],
  extras: {
    sections?: MusicSection[];
    phrases?: MusicPhrase[];
  } = {}
): MusicStructureAnalysisResult {
  const changePoints = clusters.flatMap((c) => c.changePoints);
  return {
    sections: extras.sections ?? [],
    phrases: extras.phrases ?? [],
    hits: [],
    changePoints,
    eventClusters: clusters,
    confidence: 0.8,
    analysisVersion: "3.0.0-phase2",
  };
}

export function section(
  type: MusicSection["type"],
  startTime: number,
  endTime: number,
  confidence = 0.85
): MusicSection {
  return {
    id: `sec-${type}-${Math.round(startTime * 1000)}`,
    type,
    startTime,
    endTime,
    startBar: Math.floor(startTime / 2),
    endBar: Math.floor(endTime / 2),
    barCount: Math.max(1, Math.round((endTime - startTime) / 2)),
    energyMean: 50,
    energyPeak: 70,
    energyDelta: 10,
    rhythmicDensity: 0.5,
    spectralProfile: {
      bass: 0.3,
      lowMid: 0.2,
      mid: 0.2,
      highMid: 0.15,
      high: 0.15,
    },
    confidence,
  };
}

/** INTRO low → CHORUS-like rise → stable high */
export function patternCueA(): {
  phase1: MusicAnalysisResultPhase1;
  structure: MusicStructureAnalysisResult;
} {
  const clusters = [
    makeCluster(4, ["HIT"], {
      strength: 12,
      energyBefore: 22,
      energyAfter: 23,
      confidence: 0.7,
    }),
    makeCluster(16, ["SECTION_CHANGE", "ENERGY_RISE", "BASS_ENTRY"], {
      strength: 92,
      energyBefore: 22,
      energyAfter: 84,
      isMajor: true,
      confidence: 0.94,
    }),
    makeCluster(24, ["HIT"], {
      strength: 28,
      energyBefore: 83,
      energyAfter: 84,
      confidence: 0.8,
    }),
  ];
  return {
    phase1: makePhase1(32),
    structure: makeStructure(clusters, {
      sections: [section("INTRO", 0, 16), section("CHORUS", 16, 32)],
    }),
  };
}

/** low → rise → peak → drop */
export function patternCueB(): {
  phase1: MusicAnalysisResultPhase1;
  structure: MusicStructureAnalysisResult;
} {
  const clusters = [
    makeCluster(8, ["ENERGY_RISE"], {
      strength: 78,
      energyBefore: 28,
      energyAfter: 72,
      confidence: 0.9,
    }),
    makeCluster(16, ["HIT"], {
      strength: 30,
      energyBefore: 82,
      energyAfter: 84,
      confidence: 0.8,
    }),
    makeCluster(24, ["ENERGY_DROP"], {
      strength: 80,
      energyBefore: 84,
      energyAfter: 22,
      isMajor: true,
      confidence: 0.9,
    }),
  ];
  return {
    phase1: makePhase1(32),
    structure: makeStructure(clusters),
  };
}

/** stable high + many small hits */
export function patternCueC(): {
  phase1: MusicAnalysisResultPhase1;
  structure: MusicStructureAnalysisResult;
} {
  const clusters: EventCluster[] = [];
  for (let t = 2; t <= 20; t += 2) {
    clusters.push(
      makeCluster(t, ["HIT"], {
        strength: 22,
        energyBefore: 82,
        energyAfter: 84,
        confidence: 0.75,
      })
    );
  }
  return {
    phase1: makePhase1(24),
    structure: makeStructure(clusters),
  };
}

/** major hit clusters (tight groups) */
export function patternCueD(): {
  phase1: MusicAnalysisResultPhase1;
  structure: MusicStructureAnalysisResult;
} {
  const clusters = [
    makeCluster(8.0, ["HIT"], {
      strength: 90,
      energyBefore: 40,
      energyAfter: 80,
      isMajor: true,
      confidence: 0.95,
    }),
    makeCluster(8.08, ["ENERGY_RISE"], {
      strength: 85,
      energyBefore: 40,
      energyAfter: 82,
      confidence: 0.9,
    }),
    makeCluster(8.15, ["BASS_ENTRY"], {
      strength: 80,
      energyBefore: 42,
      energyAfter: 78,
      confidence: 0.88,
    }),
    makeCluster(20.0, ["HIT", "ENERGY_RISE"], {
      strength: 88,
      energyBefore: 50,
      energyAfter: 86,
      isMajor: true,
      confidence: 0.93,
    }),
    makeCluster(20.1, ["SECTION_CHANGE"], {
      strength: 82,
      energyBefore: 50,
      energyAfter: 84,
      confidence: 0.9,
    }),
  ];
  return {
    phase1: makePhase1(28),
    structure: makeStructure(clusters),
  };
}

/** frequent weak events */
export function patternCueE(): {
  phase1: MusicAnalysisResultPhase1;
  structure: MusicStructureAnalysisResult;
} {
  const clusters: EventCluster[] = [];
  for (let i = 0; i < 24; i += 1) {
    clusters.push(
      makeCluster(1 + i * 0.5, ["SPECTRAL_CHANGE"], {
        strength: 10,
        energyBefore: 40,
        energyAfter: 42,
        confidence: 0.5,
      })
    );
  }
  return {
    phase1: makePhase1(16),
    structure: makeStructure(clusters),
  };
}

/** Long song used for the 48/56/64/72 cue timeline. */
export function patternCueTimeline(): {
  phase1: MusicAnalysisResultPhase1;
  structure: MusicStructureAnalysisResult;
} {
  const clusters = [
    makeCluster(8, ["HIT"], {
      strength: 14,
      energyBefore: 20,
      energyAfter: 22,
      confidence: 0.7,
    }),
    makeCluster(48, ["SECTION_CHANGE", "ENERGY_RISE", "BASS_ENTRY", "HIT"], {
      strength: 94,
      energyBefore: 28,
      energyAfter: 88,
      isMajor: true,
      confidence: 0.96,
    }),
    makeCluster(56, ["HIT"], {
      strength: 42,
      energyBefore: 55,
      energyAfter: 68,
      confidence: 0.82,
    }),
    makeCluster(64, ["HIT"], {
      strength: 24,
      energyBefore: 83,
      energyAfter: 84,
      confidence: 0.8,
    }),
    makeCluster(72, ["ENERGY_DROP"], {
      strength: 82,
      energyBefore: 84,
      energyAfter: 30,
      isMajor: true,
      confidence: 0.9,
    }),
  ];
  return {
    phase1: makePhase1(80),
    structure: makeStructure(clusters, {
      sections: [
        section("INTRO", 0, 16, 0.8),
        section("VERSE", 16, 48, 0.8),
        section("CHORUS", 48, 72, 0.9),
        section("BREAK", 72, 80, 0.85),
      ],
    }),
  };
}
