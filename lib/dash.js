'use strict';

const xml = require('./xml');
const { parseDuration, isLanguageTagValid } = require('./util');
const { parseVideoCodec, parseDynamicRange, createVideoTrack } = require('./video');
const {
  parseAudioCodec,
  createAudioTrack,
  getDolbyDigitalPlusComplexityIndex,
  checkIsDescriptive,
} = require('./audio');
const {
  parseSubtitleCodec,
  checkIsClosedCaption,
  checkIsSdh,
  checkIsForced,
  createSubtitleTrack,
} = require('./subtitle');
const {
  createResolutionFilter,
  createVideoQualityFilter,
  createAudioLanguageFilter,
  createSubtitleLanguageFilter,
} = require('./track');

const appendUtils = (element) => {
  if (!element) return element;
  if (Array.isArray(element)) {
    element.get = (name) => appendUtils(element.find((item) => item.tagName === name));
  } else {
    element.getAttr = (name) => element.attributes[name];
    element.getChild = (name) => {
      const tag = element.children.find((item) => item.tagName === name);
      const isString = !name && typeof element.children?.[0] === 'string';
      return isString ? element.children[0] : appendUtils(tag);
    };
    element.set = (name, value) => (element.attributes[name] = value);
    element.get = (name) => element.getAttr(name) || element.getChild(name);
    element.getNumber = (name) => Number(element.find(name));
    element.getAll = (name) =>
      element.children.filter((item) => item.tagName === name).map(appendUtils);
    element.getBaseUrls = () => element.getAll('BaseURL').map((item) => item.children[0]);
    element.getBaseUrl = () => element.getBaseUrls()[0];
  }
  return element;
};

const combineGetters = (representation, adaptationSet) => {
  const prevGet = representation.get;
  const prevGetAll = representation.getAll;
  const get = (name) => prevGet(name) || adaptationSet.get(name);
  const getAll = (name) => [...prevGetAll(name), ...adaptationSet.getAll(name)].filter(Boolean);
  representation.get = get;
  representation.getAll = getAll;
  return { get, getAll };
};

const parseBaseUrl = (manifestUrl, mpd, period, representation) => {
  let manifestBaseUrl = mpd.getBaseUrl();
  if (!manifestBaseUrl) manifestBaseUrl = manifestUrl;
  else if (!manifestBaseUrl.startsWith('https://'))
    manifestBaseUrl = new URL(manifestBaseUrl, manifestUrl).toString();
  const periodBaseUrl = new URL(period.getBaseUrl() || '', manifestBaseUrl).toString();
  const representationBaseUrl = new URL(
    representation.getBaseUrl() || '',
    periodBaseUrl
  ).toString();
  return representationBaseUrl;
};

const parseContentTypes = (representation) => {
  const mimeType = representation.get('mimeType');
  const contentType = representation.get('contentType') || mimeType?.split('/')[0];
  if (!contentType && !mimeType)
    throw new Error('Unable to determine the format of a Representation, cannot continue...');
  return { contentType, mimeType };
};

const parseCodecs = (representation, contentType, mimeType) => {
  const shouldUseCodecsFromMime = contentType === 'text' && !mimeType.includes('mp4');
  const codecs = shouldUseCodecsFromMime ? mimeType.split('/')[1] : representation.get('codecs');
  return codecs;
};

const parseLanguage = (representation, adaptationSet, fallbackLanguage) => {
  let language = '';
  const options = [];
  const lang = representation.get('lang');
  const id = representation.get('id');
  if (representation) {
    options.push(lang);
    if (id) {
      const m = id.match(/\w+_(\w+)=\d+/);
      if (m) options.push(m.group(1));
    }
  }
  options.push(adaptationSet.get('lang'));
  if (fallbackLanguage) options.push(fallbackLanguage);
  for (const option of options) {
    const value = (option || '').trim();
    if (!isLanguageTagValid(value) || value.startsWith('und')) continue;
    language = value;
    continue;
  }
  if (!language) {
    // Language information could not be derived from a Representation.
    // TODO: Throw error if language not found
  }
  return language;
};

const buildSegmentUrl = (template, fields) => {
  let result = template;
  for (const [key, value] of Object.entries(fields))
    result = result.replace('$' + key + '$', value);
  return result;
};

const resolveSegmentTemplateUrls = (segmentTemplate, baseUrl, manifestUrl) => {
  for (const type of ['initialization', 'media']) {
    let value = segmentTemplate.get(type);
    if (!value) continue;
    if (!value.startsWith('https://')) {
      if (!baseUrl)
        throw new Error(`Resolved Segment URL is not absolute, and no Base URL is available.`);
      value = new URL(value, baseUrl).toString();
    }
    if (!new URL(value).search) {
      const manifestUrlQuery = new URL(manifestUrl).search;
      if (manifestUrlQuery) value += `?${manifestUrlQuery}`;
    }
    segmentTemplate.set(type, value);
  }
};

const parseSegmentsFromTimeline = (
  segmentTimeline,
  segmentTemplate,
  representation,
  startNumber
) => {
  const times = [];
  let currentTime = 0;
  for (const s of segmentTimeline.getAll('S')) {
    const t = Number(s.get('t'));
    const r = Number(s.get('r') || 0);
    const d = Number(s.get('d'));
    if (t) currentTime = t;
    for (let i = 0; i < r + 1; i++) {
      times.push(currentTime);
      currentTime += d;
    }
  }
  const segments = [];
  const numbers = [...Array(times.length).keys()].map((n) => n + startNumber);
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    const n = numbers[i];
    const url = buildSegmentUrl(segmentTemplate.get('media'), {
      Bandwidth: representation.get('bandwidth'),
      RepresentationID: representation.get('id'),
      Number: n,
      Time: t,
    });
    segments.push({ url });
  }
  return segments;
};

const parseSegmentsFromTemplate = (
  segmentTemplate,
  baseUrl,
  manifestUrl,
  duration,
  representation
) => {
  const startNumber = Number(segmentTemplate.get('startNumber') || 1);
  const segmentTimeline = segmentTemplate.get('SegmentTimeline');
  resolveSegmentTemplateUrls(segmentTemplate, baseUrl, manifestUrl);
  if (!duration) throw new Error('Duration of the Period was unable to be determined.');
  const segmentDuration = parseFloat(segmentTemplate.get('duration'));
  const segmentTimescale = parseFloat(segmentTemplate.get('timescale') || 1);
  const segmentsCount = Math.ceil(duration / (segmentDuration / segmentTimescale));
  const bandwidth = representation.get('bandwidth');
  const id = representation.get('id');
  const segments = [];
  if (segmentTimeline) {
    segments.push(
      ...parseSegmentsFromTimeline(segmentTimeline, segmentTemplate, representation, startNumber)
    );
  } else {
    for (let i = startNumber; i < startNumber + segmentsCount; i++) {
      const url = buildSegmentUrl(segmentTemplate.get('media'), {
        Bandwidth: bandwidth,
        RepresentationID: id,
        Number: i,
        Time: i,
      });
      segments.push({ url });
    }
  }
  const initialization = segmentTemplate.get('initialization');
  if (initialization) {
    const url = buildSegmentUrl(initialization, {
      Bandwidth: bandwidth,
      RepresentationID: id,
    });
    segments.unshift({ url, init: true });
  }
  return segments;
};

const parseSegmentsFromList = (segmentList, baseUrl) => {
  const segmentUrls = segmentList.get('SegmentURL');
  const segments = [];
  for (const segmentUrl of segmentUrls) {
    let mediaUrl = segmentUrl.get('media');
    if (!mediaUrl) mediaUrl = baseUrl;
    else if (!mediaUrl.startsWith('https://')) mediaUrl = new URL(mediaUrl, baseUrl).toString();
    segments.push({ url: mediaUrl, range: segmentUrl.get('mediaRange') });
  }
  return segments;
};

const parseSegmentFromBase = async (segmentBase, baseUrl) => {
  const initialization = segmentBase.get('Initialization');
  let mediaRange = '';
  if (initialization) {
    const range = initialization.get('range');
    const headers = range ? { Range: `bytes=${range}` } : undefined;
    const response = await fetch(baseUrl, headers);
    const initData = await response.arrayBuffer();
    const totalSize = response.headers.get('Content-Range').split('/')[-1];
    if (totalSize) mediaRange = `${initData.byteLength}-${totalSize}`;
  }
  return { url: baseUrl, range: mediaRange };
};

const protectionSchemas = {
  'urn:mpeg:dash:mp4protection:2011': 'common',
  'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95': 'playready',
  'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed': 'widevine',
};

const parseContentProtection = (contentProtections) => {
  const protection = {};
  for (const contentProtection of contentProtections) {
    const id = contentProtection.get('schemeIdUri')?.toLowerCase();
    const value = contentProtection.get('value');
    const pssh = contentProtection.get('cenc:pssh')?.get();
    const defaultKeyId = contentProtection.get('cenc:default_KID');
    const data = { id, value, pssh, defaultKeyId };
    protection[protectionSchemas[id]] = data;
  }
  return protection;
};

const parseManifest = async (text, url, fallbackLanguage) => {
  const mpd = appendUtils(xml.parse(text)).get('MPD');
  const period = mpd.get('Period');
  const durationString = period.get('duration') || mpd.get('mediaPresentationDuration');
  const duration = parseDuration(durationString);

  const videos = [];
  const audios = [];
  const subtitles = [];

  for (const adaptationSet of period.getAll('AdaptationSet')) {
    for (const representation of adaptationSet.getAll('Representation')) {
      const { get, getAll } = combineGetters(representation, adaptationSet);
      const { contentType, mimeType } = parseContentTypes(representation);
      const codecs = parseCodecs(representation, contentType, mimeType);
      const language = parseLanguage(representation, adaptationSet, fallbackLanguage);

      const baseUrl = parseBaseUrl(url, mpd, period, representation);
      const segmentTemplate = get('SegmentTemplate');
      const segmentList = get('SegmentList');
      const segmentBase = get('SegmentBase');
      const segments = [];

      if (segmentTemplate) {
        const segmentsFromTemplate = parseSegmentsFromTemplate(
          segmentTemplate,
          baseUrl,
          url,
          duration,
          representation
        );
        segments.push(...segmentsFromTemplate);
      } else if (segmentList) {
        const segmentsFromList = parseSegmentsFromList(segmentList, baseUrl);
        segments.push(...segmentsFromList);
      } else if (segmentBase) {
        const segmentFromBase = await parseSegmentFromBase(segmentBase, baseUrl);
        segments.push(segmentFromBase);
      } else if (baseUrl) {
        segments.push({ url: baseUrl });
      } else {
        throw new Error('Could not find a way to get segments from this MPD manifest.');
      }

      const label = get('label');
      const fps = get('frameRate') ?? segmentBase?.attributes.timescale;
      const width = get('width') ?? 0;
      const height = get('height') ?? 0;
      const bitrate = get('bandwidth');
      const supplementalProps = getAll('SupplementalProperty');
      const essentialProps = getAll('EssentialProperty');
      const accessibilities = adaptationSet.getAll('Accessibility');
      const roles = adaptationSet.getAll('Role');
      const contentProtections = getAll('ContentProtection');

      const id = [
        new URL(baseUrl).hostname,
        contentType,
        codecs,
        bitrate,
        language,
        mpd.get('id'),
        period.get('id'),
        get('id'),
        get('audioTrackId'),
      ]
        .filter(Boolean)
        .join('-')
        .replaceAll('/', '-');

      switch (contentType) {
        case 'video': {
          const track = createVideoTrack({
            id,
            label,
            type: contentType,
            codec: parseVideoCodec(codecs),
            dynamicRange: parseDynamicRange(codecs, supplementalProps, essentialProps),
            contentProtection: parseContentProtection(contentProtections),
            bitrate,
            duration,
            width,
            height,
            fps,
            language,
            segments,
          });
          videos.push(track);
          break;
        }
        case 'audio': {
          const track = createAudioTrack({
            id,
            label,
            type: contentType,
            codec: parseAudioCodec(codecs),
            channels: get('AudioChannelConfiguration')?.get('value'),
            jointObjectCoding: getDolbyDigitalPlusComplexityIndex(supplementalProps),
            isDescriptive: checkIsDescriptive(accessibilities),
            bitrate,
            duration,
            language,
            segments,
          });
          audios.push(track);
          break;
        }
        case 'text': {
          const track = createSubtitleTrack({
            id,
            label,
            type: contentType,
            codec: parseSubtitleCodec(codecs || 'vtt'),
            isClosedCaption: checkIsClosedCaption(roles),
            isSdh: checkIsSdh(accessibilities),
            isForced: checkIsForced(roles),
            bitrate,
            duration,
            language,
            segments,
          });
          subtitles.push(track);
          break;
        }
        case 'image':
          break;
        default:
          throw new Error(`Unknown content type: ${contentType}`);
      }
    }
  }
  return {
    duration,
    tracks: {
      all: videos.concat(audios).concat(subtitles),
      videos,
      audios,
      subtitles,
      withResolution: createResolutionFilter(videos),
      withVideoQuality: createVideoQualityFilter(videos),
      withAudioLanguages: createAudioLanguageFilter(audios),
      withSubtitleLanguages: createSubtitleLanguageFilter(subtitles),
    },
  };
};

module.exports = { parseManifest };
