export function parse(body: string, url: string): Manifest;

export interface Manifest {
  duration: number;
  tracks: {
    all: (VideoTrack | AudioTrack | SubtitleTrack)[];
    videos: VideoTrack[];
    audios: AudioTrack[];
    subtitles: SubtitleTrack[];
    withResolution(resolution: Partial<Resolution>): VideoTrack[];
    withVideoQuality(quality: number | string): VideoTrack[];
    withAudioLanguages(languages: string[]): AudioTrack[];
    withSubtitleLanguages(languages: string[]): SubtitleTrack[];
  };
}

export interface Track {
  id: string;
  bitrate: Bitrate;
  size: Size;
  segments: Segment[];
  protection?: TrackProtection;
}

export interface Bitrate {
  bps: number;
  kbps: number;
  mbps: number;
  gbps: number;
  toString: () => string;
}

export interface Size {
  bps: number;
  kbps: number;
  mbps: number;
  gbps: number;
  toString: () => string;
}

export interface Segment {
  url: string;
  init?: boolean;
  duration: number;
  number: number;
  presentationTime: number;
}

export interface TrackProtection {
  common?: { id: string; value: 'cenc' | 'cbcs'; keyId?: string };
  playready?: { id: string; pssh: string; value?: string };
  widevine?: { id: string; pssh: string };
}

export interface VideoTrack extends Track {
  codecs: string;
  resolution: Resolution;
  quality: '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' | '2160p' | '4320p';
}

export interface Resolution {
  width: number;
  height: number;
}

export interface AudioTrack extends Track {
  codecs: string;
  language: string;
  label?: string;
}

export interface SubtitleTrack extends Track {
  language: string;
  label?: string;
}
