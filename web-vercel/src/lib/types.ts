export type Hotspot = { x: number; y: number; label: string; detail: string };

export type AudioLine = { t: number; text: string };

/**
 * Multi-voice script. Each voice has its own parallel timeline. Frontend
 * picks the variant matching the user's narratorVoice tweak; if the chosen
 * voice has no lines, AudioGuide falls back to '清·克制'.
 */
export type AudioGuideData = {
  duration: number;
  variants: Record<string, AudioLine[]>;
};

export type Question = { q: string; hint: string; options: string[] };

export type VocabularyItem = { word: string; note: string; isNew: boolean };

export type Work = {
  id?: string;
  /** null = global daily work (system-published); uuid = personal */
  ownerId?: string | null;
  no: string;
  total: number;
  title: string;
  artist: string;
  artistRomaji: string;
  year: string;
  medium: string;
  size: string;
  series: string;
  location: string;
  room: string;
  shortLabel: string;
  /** Per-work curator note shown next to the notebook. Null for older works. */
  curatorNote?: string | null;
  image: string;
  hotspots: Hotspot[];
  audioGuide: AudioGuideData;
  questions: Question[];
  vocabulary: VocabularyItem[];
};

export type ArchiveWork = {
  id?: string;
  no: string;
  /** YYYY-MM-DD — raw for filtering. Optional for legacy mock data. */
  exhibitedOn?: string;
  date: string;
  title: string;
  artist: string;
  img: string;
  span: number;
  pinned: boolean;
  keywords: string[];
  reflection: string;
  /** Optional for legacy mock data; null if backfill skipped this row. */
  region?: 'east' | 'west' | null;
};

export type Pattern = {
  title: string;
  freq: string;
  desc: string;
  from: string;
};

/** An artwork where the user used a given keyword. */
export type WordSource = {
  workId: string;
  no: string;
  title: string;
  img: string;
  date: string;
};

export type ConstellationWord = {
  w: string;
  count: number;
  from: string;
  isNew?: boolean;
  /** Curator definition for this term, if one exists in any work's vocabulary. */
  note?: string;
  /** The artworks where the user picked / wrote this word. */
  sources?: WordSource[];
};

export type Tweaks = {
  narratorVoice: string;
  /** 'edge' = backend-proxied Microsoft neural voices (higher quality).
   *  'system' = browser's SpeechSynthesis API (free, lower quality, offline). */
  ttsEngine: 'edge' | 'system';
  /** Specific system TTS voice name (matches SpeechSynthesisVoice.name).
   *  Empty string = auto-pick the best available Chinese voice.
   *  Only relevant when ttsEngine === 'system'. */
  voiceName: string;
  spotlight: number;
  showHotspotsByDefault: boolean;
  frame: 'mat' | 'thin' | 'none';
  textScale: number;
};
