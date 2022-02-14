import { AdaptationSet, ProcessedManifest, Representation } from './processor';
import { QualityLabel } from './utils';

declare class Manifest extends ProcessedManifest {
  constructor(manifest: ProcessedManifest);
  getVideoTrack(height: number): VideoTrack;
  getAudioTracks(languages: string[]): AudioTrack[];
  getSubtitleTracks(languages: string[]): SubtitleTrack[];
  getWidevinePssh(adaptationSet: AdaptationSet): string | null;
  getWidevineLicenseUrl(adaptationSet: AdaptationSet): string | null;
  findBestRepresentation(representations: Representation[]): Representation;
  getSegments(adaptationSet: AdaptationSet, representation: Representation): Segment[];
  getPssh(): string | null;
  getLicenseUrl(): string | null;
}

interface MediaTrack {
  type: 'video' | 'audio' | 'text';
  segments: Segment[];
  bitrate: number; // Kbps
  size: number; // MB
  pssh: string | null;
  licenseUrl: string | null;
}

interface VideoTrack extends MediaTrack {
  type: 'video';
  width: number;
  height: number;
  quality: QualityLabel;
}

interface AudioTrack extends MediaTrack {
  type: 'audio';
  audioSampleRate: number;
}

interface SubtitleTrack {}

interface Segment {
  url: string;
  init?: boolean;
}

declare const parseManifest: (text: string) => Manifest | null;

export { parseManifest, Manifest, VideoTrack, AudioTrack };
