interface ProcessedManifest {
  periods: Period[];
  baseUrls: string[];
  locations: string[];
  profiles: string;
  mediaPresentationDuration: number;
}

interface Period {
  id: number;
  start: number;
  duration: number;
  adaptationSets: AdaptationSet[];
}

interface AdaptationSet {
  id: string;
  group: number;
  baseUrls: string[];
  segmentAlignment: string;
  lang: string;
  maxWidth: number;
  maxHeight: number;
  maxFrameRate: string;
  contentType: string;
  segmentTemplate: Record<string, any>;
  contentProtections: ContentProtection[];
  representations: Representation[];
}

interface Representation {
  id: string;
  baseUrls: string[]; // TODO: Check type
  codecs: string;
  bandwidth: number;
  frameRate: string;
  mimeType: string;
  audioSamplingRate: number;
  width: number;
  height: number;
  sar: string;
  startWithSAP: string;
}

interface ContentProtection {
  schemeIdUri: string;
  value: string;
  cencDefaultKid: string;
  cencPssh: string;
  msprPro: string;
  licenseUrl: string;
}

declare const processManifest: (parsedXml: Record<string, any>) => ProcessedManifest;

export {
  processManifest,
  ProcessedManifest,
  Period,
  AdaptationSet,
  Representation,
  ContentProtection,
};
