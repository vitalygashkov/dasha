declare module 'mpd-parser' {
  export function parse(manifestString: string, options?: ParseOptions): Manifest;
  export function stringToMpdXml(manifestString: string): HTMLElement;
  export function inheritAttributes(mpd: Node, options?: ParseOptions): InheritAttributesResult;
  export function toPlaylists(representations: unknown[]): unknown[];

  export interface ParseOptions {
    manifestUri: string;
    NOW?: number;
    clientOffset?: number;
    eventHandler?: EventHandler;
  }

  export type EventHandler = (event: { type: string; message: string }) => void;

  export interface InheritAttributesResult {
    locations: unknown;
    contentSteeringInfo: unknown | null;
    representationInfo: RepresentationInfo[];
    eventStream: unknown;
  }

  export interface RepresentationInfo {
    segmentInfo: SegmentInformation;
    attributes: Record<string, string>;
  }

  interface SegmentInformation {
    template: Record<string, unknown>;
    segmentTimeline: Record<string, unknown>[];
    list: Record<string, unknown>;
    base: Record<string, unknown>;
  }

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
      byterange?: {
        length: number;
        offset: number;
      };
    };

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

    instreamId?: string;
    characteristics?: string;
    forced?: boolean;
  }

  export interface Attributes {
    NAME: string;
    BANDWIDTH: number;
    CODECS: string;
    'PROGRAM-ID': number;
    RESOLUTION?: { width: number; height: number };
    'FRAME-RATE'?: number;
    AUDIO?: string;
    SUBTITLES?: string;
    [key: string]: any;
  }
}
