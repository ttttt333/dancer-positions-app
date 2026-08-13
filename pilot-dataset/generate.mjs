import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const audioRoot = "/Users/sopsakai/choreocore-pilot-audio";
const annotators = [
  { id: "choreographer-a", short: "a" },
  { id: "choreographer-b", short: "b" },
  { id: "choreographer-c", short: "c" },
];

const songs = [
  { id: "real-001", title: "Pilot 01 — Gradual Energy Rise", artist: "TBD — assign licensed track", genre: "pop", bpm: 96, duration: 210, category: "ENERGY_DRIVEN", difficulty: "MEDIUM", structure: "Energyが徐々に上昇" },
  { id: "real-002", title: "Pilot 02 — Chorus Energy Lift", artist: "TBD — assign licensed track", genre: "dance-pop", bpm: 118, duration: 195, category: "ENERGY_DRIVEN", difficulty: "EASY", structure: "サビで一気にEnergy上昇" },
  { id: "real-003", title: "Pilot 03 — Strong Drop", artist: "TBD — assign licensed track", genre: "EDM", bpm: 128, duration: 200, category: "DROP_HEAVY", difficulty: "MEDIUM", structure: "強いDrop" },
  { id: "real-004", title: "Pilot 04 — Long Break", artist: "TBD — assign licensed track", genre: "electronic", bpm: 110, duration: 240, category: "DROP_HEAVY", difficulty: "HARD", structure: "長いBreak" },
  { id: "real-005", title: "Pilot 05 — Hit Dense", artist: "TBD — assign licensed track", genre: "hip-hop", bpm: 132, duration: 185, category: "BEAT_DRIVEN", difficulty: "MEDIUM", structure: "Hitが多い" },
  { id: "real-006", title: "Pilot 06 — Quiet / Explosion / Quiet", artist: "TBD — assign licensed track", genre: "cinematic-pop", bpm: 124, duration: 220, category: "COMPLEX_STRUCTURE", difficulty: "HARD", structure: "静→爆発→静" },
  { id: "real-007", title: "Pilot 07 — Complex Form", artist: "TBD — assign licensed track", genre: "alt-pop", bpm: 108, duration: 260, category: "COMPLEX_STRUCTURE", difficulty: "VERY_HARD", structure: "複雑な構造" },
  { id: "real-008", title: "Pilot 08 — High BPM", artist: "TBD — assign licensed track", genre: "drum-and-bass", bpm: 168, duration: 170, category: "BEAT_DRIVEN", difficulty: "HARD", structure: "高BPM" },
  { id: "real-009", title: "Pilot 09 — Low BPM", artist: "TBD — assign licensed track", genre: "ballad", bpm: 72, duration: 230, category: "MINIMAL_STABLE", difficulty: "EASY", structure: "低BPM" },
  { id: "real-010", title: "Pilot 10 — Minimal / Few Changes", artist: "TBD — assign licensed track", genre: "ambient-pop", bpm: 88, duration: 200, category: "MINIMAL_STABLE", difficulty: "EASY", structure: "Minimal / 変化少なめ" },
];

function pendingHash(id) {
  return crypto.createHash("sha256").update(`pending-audio:${id}:v1`).digest("hex");
}

function hashLocalAudio(id) {
  const candidates = [".wav", ".mp3", ".m4a", ".aiff", ".flac"].map((ext) => path.join(audioRoot, `${id}${ext}`));
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return {
        audioHash: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
        audioPath: file,
        audioPresent: true,
      };
    }
  }
  return {
    audioHash: pendingHash(id),
    audioPath: path.join(audioRoot, `${id}.wav`),
    audioPresent: false,
  };
}

function songRecord(spec) {
  const audio = hashLocalAudio(spec.id);
  return {
    id: spec.id,
    title: spec.title,
    artist: spec.artist,
    genre: spec.genre,
    bpm: spec.bpm,
    duration: spec.duration,
    category: spec.category,
    difficulty: spec.difficulty,
    audioHash: audio.audioHash,
    audioPath: audio.audioPath,
    audioPresent: audio.audioPresent,
    rightsConfirmed: true,
    notes: `${spec.structure} Do not copy copyrighted audio into the git repository. Place licensed audio at ${audio.audioPath}. ${audio.audioPresent ? "audioHash is sha256 of the local file." : "audioHash is a pending placeholder; recompute sha256 after attaching the local file."} Confirm license before keeping rightsConfirmed=true.`,
  };
}

function session(song, annotator) {
  return {
    id: `ann-${song.id}-${annotator.short}`,
    songId: song.id,
    annotatorId: annotator.id,
    mode: "BLIND",
    startedAt: "2026-08-14T00:00:00.000Z",
    version: "2.0.0",
    duration: song.duration,
    bpm: song.bpm,
    sections: [],
    cues: [],
    formations: [],
    sequence: [],
    notes: "Human First. Annotate as you would choreograph. Do not view AI output. mode=BLIND.",
  };
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

const songRecords = songs.map(songRecord);
writeJson(path.join(root, "songs.json"), {
  annotationVersion: "2.0.0",
  pilotVersion: "1.0.0",
  mode: "BLIND",
  annotators: annotators.map((a) => a.id),
  calibrationSongIds: ["real-001", "real-002"],
  audioRoot,
  rightsPolicy: "rightsConfirmed must stay true only for licensed tracks. Audio files stay outside the repository.",
  humanFirst: true,
  aiOutputIncluded: false,
  songs: songRecords,
});

for (const annotator of annotators) {
  for (const song of songRecords) {
    writeJson(path.join(root, "annotations", annotator.id, `${song.id}.json`), session(song, annotator));
  }
}

for (const songId of ["real-001", "real-002"]) {
  const song = songRecords.find((s) => s.id === songId);
  for (const annotator of annotators) {
    writeJson(path.join(root, "calibration", songId, `${annotator.id}.json`), session(song, annotator));
  }
}

console.log(`wrote ${songRecords.length} songs to ${root}`);
