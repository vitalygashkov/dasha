export function parse(body: string, url: string): Manifest | null;

export interface Manifest {
  duration: number;
  tracks: {
    videos: VideoTrack[];
    audios: AudioTrack[];
    subtitles: SubtitleTrack[];
  };
}

export interface Track {
  id: string;
  codecs: string;
  bandwidth: {
    bps: number;
    kbps: number;
    mbps: number;
    gbps: number;
    toString: () => string;
  };
  size: {
    b: number;
    kb: number;
    mb: number;
    gb: number;
    toString: () => string;
  };
  segments: Segment[];
  protection?: TrackProtection;
}

export interface Segment {
  url: string;
  init?: boolean;
}

export interface TrackProtection {
  common?: { id: string; value: string; keyId?: string };
  playready?: { id: string; pssh: string; value?: string };
  widevine?: { id: string; pssh: string };
}

export interface VideoTrack extends Track {
  resolution: { width: number; height: number };
}

export interface AudioTrack extends Track {
  language: string;
}

export interface SubtitleTrack extends Track {
  language: string;
}
