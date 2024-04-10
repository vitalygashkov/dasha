export function parse(text: string, url: string): Promise<Manifest>;

export interface Manifest {
  duration?: number;
  tracks: {
    all: (VideoTrack | AudioTrack | SubtitleTrack)[];
    videos: VideoTrack[];
    audios: AudioTrack[];
    subtitles: SubtitleTrack[];
    withResolution(resolution: { width?: string; height?: string }): VideoTrack[];
    withVideoQuality(quality: number | string): VideoTrack[];
    withAudioLanguages(languages: string[]): AudioTrack[];
    withSubtitleLanguages(languages: string[]): SubtitleTrack[];
  };
}

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'text';
  segments: Segment[];
  label?: string;
  size?: Size;
  protection?: TrackProtection;
  toString: () => string;
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
  range?: string;
  init?: boolean;
  duration?: number;
  number?: number;
  presentationTime?: number;
}

export interface TrackProtection {
  common?: { id: string; value: 'cenc' | 'cbcs'; keyId?: string };
  playready?: { id: string; pssh?: string; value?: string };
  widevine?: { id: string; pssh: string };
  fairplay?: { keyFormat: string; uri: string; method: string };
}

export type VideoCodec = 'H.264' | 'H.265' | 'VC-1' | 'VP8' | 'VP9' | 'AV1';
export type DynamicRange = 'SDR' | 'HLG' | 'HDR10' | 'HDR10+' | 'DV';

export interface VideoTrack extends Track {
  codec: VideoCodec;
  bitrate: Bitrate;
  width: number;
  height: number;
  quality: '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' | '2160p' | '4320p' | string;
  dynamicRange: DynamicRange;
  fps?: string;
  language?: string;
}

export type AudioCodec = 'AAC' | 'DD' | 'DD+' | 'OPUS' | 'VORB' | 'DTS' | 'ALAC' | 'FLAC';

export interface AudioTrack extends Track {
  codec: AudioCodec;
  bitrate: Bitrate;
  language: string;
  jointObjectCoding?: number;
  isDescriptive?: boolean;
}

export type SubtitleCodec = 'SRT' | 'SSA' | 'ASS' | 'TTML' | 'VTT' | 'STPP' | 'fTTML' | 'fVTT';

export interface SubtitleTrack extends Track {
  codec: SubtitleCodec;
  language: string;
  isClosedCaption?: boolean;
  isSdh?: boolean;
  isForced?: boolean;
}

export type AnyTrack = VideoTrack | AudioTrack | SubtitleTrack;
