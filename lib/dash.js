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

const withUtils = (node) => {
  if (!node) return node;
  if (Array.isArray(node)) {
    node.get = (name) => withUtils(node.find((item) => item.tagName === name));
  } else {
    node.findAttr = (name) => node.attributes[name];
    node.findChild = (name) => withUtils(node.children.find((item) => item.tagName === name));
    node.find = (name) => node.findAttr(name) || node.findChild(name);
    node.findNumber = (name) => Number(node.find(name));
    node.filter = (name) => node.children.filter((item) => item.tagName === name).map(withUtils);
    node.getBaseUrls = () => node.filter('BaseURL').map((item) => item.children[0]);
    node.getBaseUrl = () => node.getBaseUrls().at(0);
  }
  return node;
};

const toTracks = (mpdBody, mpdUrl, fallbackLanguage) => {
  const mpd = withUtils(xml.parse(mpdBody));
  const root = mpd.get('MPD');
  const period = root.find('Period');
  const tracks = [];

  for (const adaptationSet of period.filter('AdaptationSet')) {
    for (const representation of adaptationSet.filter('Representation')) {
      const get = (name) => representation.find(name) || adaptationSet.find(name);
      const getBoth = (name) =>
        [...representation.filter(name), ...adaptationSet.filter(name)].filter(Boolean);

      const mimeType = get('mimeType');
      const contentType = get('contentType') || mimeType?.split('/')[0];
      if (!contentType && !mimeType)
        throw new Error('Unable to determine the format of a Representation, cannot continue...');

      const language = getLanguage(adaptationSet, representation, fallbackLanguage);
      if (!language)
        console.log('Language information could not be derived from a Representation.');
      // TODO: Throw error if language not found

      let manifestBaseUrl = root.getBaseUrl();
      if (!manifestBaseUrl) manifestBaseUrl = mpdUrl;
      else if (!manifestBaseUrl.startsWith('https://'))
        manifestBaseUrl = new URL(manifestBaseUrl, mpdUrl).toString();
      const periodBaseUrl = new URL(period.getBaseUrl(), manifestBaseUrl).toString();
      const representationBaseUrl = new URL(
        representation.getBaseUrl(),
        manifestBaseUrl
      ).toString();

      const segmentTemplate = get('SegmentTemplate');
      const segmentList = get('SegmentList');
      const segmentBase = get('SegmentBase');

      const segments = [];
      const periodDuration = period.find('duration') || root.find('mediaPresentationDuration');

      if (segmentTemplate) {
        const startNumber = Number(segmentTemplate.find('startNumber') || 1);
        const segmentTimeline = segmentTemplate.find('SegmentTimeline');
        const urls = [];
        for (const type of ['initialization', 'media']) {
          let value = segmentTemplate.find(type);
          if (!value) continue;
          if (!value.startsWith('https://')) {
            if (!representationBaseUrl)
              throw new Error(
                `Resolved Segment URL is not absolute, and no Base URL is available.`
              );
            value = new URL(value, representationBaseUrl).toString();
          }
          if (!new URL(value).search) {
            const manifestUrlQuery = new URL(mpdUrl).search;
            if (manifestUrlQuery) value += `?${manifestUrlQuery}`;
          }
          urls.push(value);
        }
        if (segmentTimeline) {
          const segTimeList = [];
          let currentTime = 0;
          for (const s of segmentTimeline.filter('S')) {
            const t = Number(s.find('t'));
            const r = Number(s.find('r') || 0);
            const d = Number(s.find('d'));
            if (t) currentTime = t;
            for (let i = 0; i < r; i++) {
              segTimeList.push(currentTime);
              currentTime += d;
            }
          }
          const segNumList = [...Array(segTimeList.length).keys()].map((n) => n + startNumber);
        } else {
          if (!periodDuration)
            throw new Error('Duration of the Period was unable to be determined.');
        }
      }

      const shouldUseCodecsFromMime = contentType === 'text' && !mimeType.includes('mp4');
      const codecs = shouldUseCodecsFromMime ? mimeType.split('/')[1] : get('codecs');
      const fps = get('frameRate') ?? segmentBase?.attributes.timescale;
      const width = get('width') ?? 0;
      const height = get('height') ?? 0;
      const bitrate = get('bandwidth');
      const channelsConfig = get('AudioChannelConfiguration');
      const supplementalProps = getBoth('SupplementalProperty');
      const essentialProps = getBoth('EssentialProperty');
      const accessibilities = adaptationSet.filter('Accessibility');
      const roles = adaptationSet.filter('Role');

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
          });
          tracks.push(track);
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
          });
          tracks.push(track);
          break;
        }
        case 'text': {
          const codec = parseSubtitleCodec(codecs || 'vtt');
          const isClosedCaption = checkIsClosedCaption(roles);
          const isSdh = checkIsSdh(accessibilities);
          const isForced = checkIsForced(roles);
          const track = createSubtitleTrack({ codec, isClosedCaption, isSdh, isForced, language });
          tracks.push(track);
          break;
        }
        case 'image':
          break;
        default:
          throw new Error(`Unknown content type: ${contentType}`);
      }
    }
  }
  return tracks;
};

module.exports = { toTracks };
