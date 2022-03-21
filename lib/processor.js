const { parseDuration } = require('./utils');

const processElement = (element, type) => {
  if (!element) return;
  switch (type) {
    case 'array':
      return Array.isArray(element) ? element : [element];
    case 'number':
      return parseInt(element);
    case 'duration':
      return parseDuration(element);
    default:
      return element;
  }
};

const processRepresentation = (representation) => {
  return {
    id: representation['id'],
    baseUrls: processElement(representation['BaseURL'], 'array'),
    codecs: representation['codecs'],
    bandwidth: processElement(representation['bandwidth'], 'number'),
    frameRate: representation['frameRate'],
    mimeType: representation['mimeType'],
    audioSamplingRate: processElement(representation['audioSamplingRate'], 'number'),
    width: processElement(representation['width'], 'number'),
    height: processElement(representation['height'], 'number'),
    sar: representation['sar'],
    startWithSAP: representation['startWithSAP'],
    segmentTemplate: representation['SegmentTemplate'],
  };
};

const processContentProtection = (contentProtection) => {
  return {
    schemeIdUri: contentProtection['schemeIdUri'],
    value: contentProtection['value'],
    cencDefaultKid: contentProtection['cenc:default_KID'],
    cencPssh: contentProtection['cenc:pssh']?.['value'],
    msprPro: contentProtection['mspr:pro']?.['value'],
    licenseUrl: contentProtection['ms:laurl']?.['licenseUrl'],
  };
};

const processAdaptationSet = (adaptationSet) => {
  const contentProtectionsList = processElement(adaptationSet?.['ContentProtection'], 'array');
  const contentProtections = contentProtectionsList?.map((c) => processContentProtection(c));
  const representationsList = processElement(adaptationSet['Representation'], 'array');
  const representations = representationsList.map((r) => processRepresentation(r));
  return {
    id: adaptationSet['id'],
    group: processElement(adaptationSet['group'], 'number'),
    baseUrls: processElement(adaptationSet['BaseURL'], 'array'),
    segmentAlignment: adaptationSet['segmentAlignment'],
    lang: adaptationSet['lang'],
    maxWidth: processElement(adaptationSet['maxWidth'], 'number'),
    maxHeight: processElement(adaptationSet['maxHeight'], 'number'),
    maxFrameRate: adaptationSet['maxFrameRate'],
    contentType: adaptationSet['contentType'],
    segmentTemplate: adaptationSet['SegmentTemplate'],
    contentProtections,
    representations,
  };
};

const processPeriod = (period) => {
  const adaptationSetsList = processElement(period['AdaptationSet'], 'array');
  const adaptationSets = adaptationSetsList.map((a) => processAdaptationSet(a));
  return {
    id: processElement(period['id'], 'number'),
    start: processElement(period['start'], 'duration'),
    duration: processElement(period['duration'], 'duration'),
    adaptationSets,
  };
};

const processManifest = (parsedXml) => {
  const mpd = parsedXml.MPD;
  const periodsList = processElement(mpd['Period'], 'array');
  if (!periodsList.length) return null;
  return {
    periods: periodsList.map((p) => processPeriod(p)),
    baseUrls: processElement(mpd['BaseURL'], 'array'),
    locations: processElement(mpd['Location'], 'array'),
    profiles: mpd['profiles'],
    mediaPresentationDuration: processElement(mpd['mediaPresentationDuration'], 'duration'),
  };
};

module.exports = { processManifest };
