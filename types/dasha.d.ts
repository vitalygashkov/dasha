export * from './manifest';
export * from './constants';

export type ParseEventHandler = (event: { type: string; message: string }) => void;

export interface Manifest {
  uri: string;
  resolvedUri: string;
  duration: number;
  targetDuration: number;
  discontinuityStarts: number[];
  timelineStarts: { start: number; timeline: number }[];
  timeline: number;
  mediaSequence: number;
  discontinuitySequence: number;
  allowCache: boolean;
  endList: boolean;
  segments: Segment[];
  playlists: Playlist[];
  mediaGroups: MediaGroups;

  allPlaylists: Playlist[];

  // TODO: Check types below
  contentSteering?: {
    defaultServiceLocation: string;
    proxyServerURL: string;
    queryBeforeStart: boolean;
    serverURL: string;
  };
  playlistType?: string;
  dateTimeString?: string;
  dateTimeObject?: Date;
  totalDuration?: number;
}

export interface Segment {
  number: number;
  uri: string;
  resolvedUri: string;
  timeline: number;
  duration: number;
  presentationTime: number;
  map: {
    uri: string;
    resolvedUri: string;
    // TODO: Check types below
    byterange?: {
      length: number;
      offset: number;
    };
  };

  // TODO: Check types below
  byterange?: {
    length: number;
    offset: number;
  };
  discontinuity?: number;
  key?: {
    method: string;
    uri: string;
    iv: string;
  };
  'cue-out'?: string;
  'cue-out-cont'?: string;
  'cue-in'?: string;
}

export interface Playlist extends Omit<Manifest, 'playlists' | 'mediaGroups'> {
  attributes: Attributes;
  contentProtection?: {
    mp4protection?: {
      attributes: { schemeIdUri: string; value: string; 'cenc:default_KID': string };
    };
    'com.microsoft.playready'?: {
      attributes: { schemeIdUri: string; value: string };
      pssh: Uint8Array;
    };
    'com.widevine.alpha'?: {
      attributes: { schemeIdUri: string };
      pssh: Uint8Array;
    };
  };
}

export interface MediaGroups {
  AUDIO: {
    audio?: { [groupId: string]: MediaGroup };
  };
  SUBTITLES: {
    subs?: { [groupId: string]: MediaGroup };
  };
  VIDEO: {};
  'CLOSED-CAPTIONS': {};
}

export interface MediaGroup {
  language: string;
  default: boolean;
  autoselect: boolean;
  playlists: Playlist[];
  uri: string;

  // TODO: Check types below
  instreamId?: string;
  characteristics?: string;
  forced?: boolean;
}

export interface Attributes {
  NAME: string;
  AUDIO: string;
  SUBTITLES: string;
  RESOLUTION: { width: number; height: number };
  CODECS: string;
  BANDWIDTH: number;
  'PROGRAM-ID': number;
  'FRAME-RATE': number;
  [key: string]: any;
}
