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

const toTracks = (mpdBody, mpdUrl, fallbackLanguage) => {
  const result = xml.parse(mpdBody);

  const getNode = (source, tagName) => source.find((item) => item.tagName === tagName);
  const getNodes = (source, tagName) => source.filter((item) => item.tagName === tagName);
  const find = (source, name) => source.children.find((item) => item.tagName === name);
  const filter = (source, name) => source.children.filter((item) => item.tagName === name);

  const root = getNode(result, 'MPD');
  const period = find(root, 'Period');
  const adaptationSetList = filter(period, 'AdaptationSet');
  const tracks = [];
  for (const adaptationSet of adaptationSetList) {
    const representationList = filter(adaptationSet, 'Representation');
    for (const representation of representationList) {
      const get = (attr) => representation.attributes[attr] || adaptationSet.attributes[attr];
      const filterBoth = (name) =>
        [...filter(representation, name), ...filter(adaptationSet, name)].filter(Boolean);

      const mimeType = get('mimeType');
      const contentType = get('contentType') || mimeType?.split('/')[0];

      if (!contentType && !mimeType)
        throw new Error('Unable to determine the format of a Representation, cannot continue...');

      const language = getLanguage(adaptationSet, representation, fallbackLanguage);
      if (!language)
        console.log('Language information could not be derived from a Representation.');
      // TODO: Throw error if language not found

      const shouldUseCodecsFromMime = contentType === 'text' && !mimeType.includes('mp4');
      const codecs = shouldUseCodecsFromMime ? mimeType.split('/')[1] : get('codecs');
      const segmentBase = find(representation, 'SegmentBase');

      switch (contentType) {
        case 'video': {
          const bitrate = get('bandwidth');
          const fps = get('frameRate') ?? segmentBase?.attributes.timescale;
          const width = get('width') ?? 0;
          const height = get('height') ?? 0;
          const codec = parseVideoCodec(codecs);
          const supplementalProps = filterBoth('SupplementalProperty');
          const essentialProps = filterBoth('EssentialProperty');
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
          const bitrate = get('bandwidth');
          const codec = parseAudioCodec(codecs);
          const channels = filterBoth('AudioChannelConfiguration')[0]?.attributes?.value;
          const supplementalProps = filterBoth('SupplementalProperty');
          const jointObjectCoding = getDolbyDigitalPlusComplexityIndex(supplementalProps);
          const accessibilities = filter(adaptationSet, 'Accessibility');
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
          const roles = filter(adaptationSet, 'Role');
          const isClosedCaption = checkIsClosedCaption(roles);
          const accessibilities = filter(adaptationSet, 'Accessibility');
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
