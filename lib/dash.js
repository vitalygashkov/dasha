'use strict';

const xml = require('./xml');
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
const { parseDuration } = require('./util');
const {
  createResolutionFilter,
  createVideoQualityFilter,
  createAudioLanguageFilter,
  createSubtitleLanguageFilter,
} = require('./track');

const isLanguageTagValid = (value) => {
  try {
    Intl.getCanonicalLocales(value);
    return true;
  } catch (err) {
    return false;
  }
};

const getLanguage = (adaptationSet, representation, fallbackLanguage) => {
  const options = [];
  if (representation) {
    const { lang, id } = representation.attributes;
    options.push(lang);
    if (id) {
      const m = id.match(/\w+_(\w+)=\d+/);
      if (m) options.push(m.group(1));
    }
  }
  options.push(adaptationSet.attributes.lang);
  if (fallbackLanguage) options.push(fallbackLanguage);
  for (const option of options) {
    const value = (option || '').trim();
    if (!isLanguageTagValid(value) || value.startsWith('und')) continue;
    return value;
  }
};

const withUtils = (element) => {
  if (!element) return element;
  if (Array.isArray(element)) {
    element.get = (name) => withUtils(element.find((item) => item.tagName === name));
  } else {
    element.getAttr = (name) => element.attributes[name];
    element.getChild = (name) => withUtils(element.children.find((item) => item.tagName === name));
    element.set = (name, value) => (element.attributes[name] = value);
    element.get = (name) => element.getAttr(name) || element.getChild(name);
    element.getNumber = (name) => Number(element.find(name));
    element.getAll = (name) =>
      element.children.filter((item) => item.tagName === name).map(withUtils);
    element.getBaseUrls = () => element.getAll('BaseURL').map((item) => item.children[0]);
    element.getBaseUrl = () => element.getBaseUrls()[0];
  }
  return element;
};

const buildSegmentUrl = (template, fields) => {
  let result = template;
  for (const [key, value] of Object.entries(fields)) result = template.replace(`$${key}$`, value);
  return result;
};

const parseManifest = async (text, url, fallbackLanguage) => {
  const mpd = withUtils(xml.parse(text)).get('MPD');
  const period = mpd.get('Period');
  const videos = [];
  const audios = [];
  const subtitles = [];
  for (const adaptationSet of period.getAll('AdaptationSet')) {
    for (const representation of adaptationSet.getAll('Representation')) {
      const get = (name) => representation.get(name) || adaptationSet.get(name);
      const getAll = (name) =>
        [...representation.getAll(name), ...adaptationSet.getAll(name)].filter(Boolean);

      const mimeType = get('mimeType');
      const contentType = get('contentType') || mimeType?.split('/')[0];
      if (!contentType && !mimeType)
        throw new Error('Unable to determine the format of a Representation, cannot continue...');

      const language = getLanguage(adaptationSet, representation, fallbackLanguage);
      if (!language)
        console.log('Language information could not be derived from a Representation.');
      // TODO: Throw error if language not found

      let manifestBaseUrl = mpd.getBaseUrl();
      if (!manifestBaseUrl) manifestBaseUrl = url;
      else if (!manifestBaseUrl.startsWith('https://'))
        manifestBaseUrl = new URL(manifestBaseUrl, url).toString();
      const periodBaseUrl = new URL(period.getBaseUrl(), manifestBaseUrl).toString();
      const representationBaseUrl = new URL(representation.getBaseUrl(), periodBaseUrl).toString();

      const segmentTemplate = get('SegmentTemplate');
      const segmentList = get('SegmentList');
      const segmentBase = get('SegmentBase');

      const segments = [];
      const periodDuration = period.get('duration') || mpd.get('mediaPresentationDuration');

      if (segmentTemplate) {
        const startNumber = Number(segmentTemplate.get('startNumber') || 1);
        const segmentTimeline = segmentTemplate.get('SegmentTimeline');
        for (const type of ['initialization', 'media']) {
          let value = segmentTemplate.get(type);
          if (!value) continue;
          if (!value.startsWith('https://')) {
            if (!representationBaseUrl)
              throw new Error(
                `Resolved Segment URL is not absolute, and no Base URL is available.`
              );
            value = new URL(value, representationBaseUrl).toString();
          }
          if (!new URL(value).search) {
            const manifestUrlQuery = new URL(url).search;
            if (manifestUrlQuery) value += `?${manifestUrlQuery}`;
          }
          segmentTemplate.set(type, value);
        }
        if (segmentTimeline) {
          const times = [];
          let currentTime = 0;
          for (const s of segmentTimeline.getAll('S')) {
            const t = Number(s.get('t'));
            const r = Number(s.get('r') || 0);
            const d = Number(s.get('d'));
            if (t) currentTime = t;
            for (let i = 0; i < r; i++) {
              times.push(currentTime);
              currentTime += d;
            }
          }
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
        } else {
          if (!periodDuration)
            throw new Error('Duration of the Period was unable to be determined.');
          const duration = parseDuration(periodDuration);
          const segmentDuration = parseFloat(segmentTemplate.get('duration'));
          const segmentTimescale = parseFloat(segmentTemplate.get('timescale') || 1);
          const segmentsCount = Math.ceil(duration / (segmentDuration / segmentTimescale));

          for (let i = startNumber; i < startNumber + segmentsCount; i++) {
            const url = buildSegmentUrl(segmentTemplate.get('media'), {
              Bandwidth: representation.get('bandwidth'),
              RepresentationID: representation.get('id'),
              Number: i,
              Time: i,
            });
            segments.push({ url });
          }
        }
      } else if (segmentList) {
        const segmentUrls = segmentList.get('SegmentURL');
        for (const segmentUrl of segmentUrls) {
          let mediaUrl = segmentUrl.get('media');
          if (!mediaUrl) mediaUrl = representationBaseUrl;
          else if (!mediaUrl.startsWith('https://'))
            mediaUrl = new URL(mediaUrl, representationBaseUrl).toString();
          segments.push({ url: mediaUrl, range: segmentUrl.get('mediaRange') });
        }
      } else if (segmentBase) {
        const initialization = segmentBase.get('Initialization');
        let mediaRange = '';
        if (initialization) {
          const range = initialization.get('range');
          const headers = range ? { Range: `bytes=${range}` } : undefined;
          const response = await fetch(representationBaseUrl, headers);
          const initData = await response.arrayBuffer();
          const totalSize = response.headers.get('Content-Range').split('/')[-1];
          if (totalSize) mediaRange = `${initData.byteLength}-${totalSize}`;
        }
        segments.push({ url: representationBaseUrl, range: mediaRange });
      } else if (representationBaseUrl) {
        segments.push({ url: representationBaseUrl });
      } else {
        throw new Error('Could not find a way to get segments from this MPD manifest.');
      }

      const shouldUseCodecsFromMime = contentType === 'text' && !mimeType.includes('mp4');
      const codecs = shouldUseCodecsFromMime ? mimeType.split('/')[1] : get('codecs');
      const fps = get('frameRate') ?? segmentBase?.attributes.timescale;
      const width = get('width') ?? 0;
      const height = get('height') ?? 0;
      const bitrate = get('bandwidth');
      const channelsConfig = get('AudioChannelConfiguration');
      const supplementalProps = getAll('SupplementalProperty');
      const essentialProps = getAll('EssentialProperty');
      const accessibilities = adaptationSet.getAll('Accessibility');
      const roles = adaptationSet.getAll('Role');

      switch (contentType) {
        case 'video': {
          const codec = parseVideoCodec(codecs);
          const dynamicRange = parseDynamicRange(codecs, supplementalProps, essentialProps);
          const track = createVideoTrack({
            codec,
            dynamicRange,
            bitrate,
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
          const codec = parseAudioCodec(codecs);
          const channels = channelsConfig?.attributes?.value;
          const jointObjectCoding = getDolbyDigitalPlusComplexityIndex(supplementalProps);
          const isDescriptive = checkIsDescriptive(accessibilities);
          const track = createAudioTrack({
            codec,
            channels,
            bitrate,
            jointObjectCoding,
            isDescriptive,
            language,
            segments,
          });
          audios.push(track);
          break;
        }
        case 'text': {
          const codec = parseSubtitleCodec(codecs || 'vtt');
          const isClosedCaption = checkIsClosedCaption(roles);
          const isSdh = checkIsSdh(accessibilities);
          const isForced = checkIsForced(roles);
          const track = createSubtitleTrack({
            codec,
            isClosedCaption,
            isSdh,
            isForced,
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
