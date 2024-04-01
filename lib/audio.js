'use strict';

const { parseMimes } = require('./track');
const { parseBitrate } = require('./util');

const AUDIO_CODECS = {
  AAC: 'AAC', // https://wikipedia.org/wiki/Advanced_Audio_Coding
  AC3: 'DD', // https://wikipedia.org/wiki/Dolby_Digital
  EC3: 'DD+', // https://wikipedia.org/wiki/Dolby_Digital_Plus
  OPUS: 'OPUS', // https://wikipedia.org/wiki/Opus_(audio_format)
  OGG: 'VORB', // https://wikipedia.org/wiki/Vorbis
  DTS: 'DTS', // https://en.wikipedia.org/wiki/DTS_(company)#DTS_Digital_Surround
  ALAC: 'ALAC', // https://en.wikipedia.org/wiki/Apple_Lossless_Audio_Codec
  FLAC: 'FLAC', // https://en.wikipedia.org/wiki/FLAC
};

const parseAudioCodecFromMime = (mime) => {
  const target = mime.toLowerCase().trim().split('.')[0];
  switch (target) {
    case 'mp4a':
      return AUDIO_CODECS.AAC;
    case 'ac-3':
      return AUDIO_CODECS.AC3;
    case 'ec-3':
      return AUDIO_CODECS.EC3;
    case 'opus':
      return AUDIO_CODECS.OPUS;
    case 'dtsc':
      return AUDIO_CODECS.DTS;
    case 'alac':
      return AUDIO_CODECS.ALAC;
    case 'flac':
      return AUDIO_CODECS.FLAC;
    default:
      throw new Error(`The MIME ${mime} is not supported as audio codec`);
  }
};

const parseAudioCodec = (codecs) => {
  const mimes = parseMimes(codecs);
  for (const mime of mimes) {
    try {
      return parseAudioCodecFromMime(mime);
    } catch (e) {
      continue;
    }
  }
  throw new Error(`No MIME types matched any supported Audio Codecs in ${codecs}`);
};

// https://professionalsupport.dolby.com/s/article/What-is-Dolby-Digital-Plus-JOC-Joint-Object-Coding?language=en_US
const getDolbyDigitalPlusComplexityIndex = (supplementalProps = []) => {
  const targetScheme = 'tag:dolby.com,2018:dash:EC3_ExtensionComplexityIndex:2018';
  for (const prop of supplementalProps)
    if (prop.attributes.schemeIdUri === targetScheme) return parseInt(prop.attributes.value);
};

const checkIsDescriptive = (accessibilities = []) => {
  for (const accessibility of accessibilities) {
    const { schemeIdUri, value } = accessibility.attributes;
    const firstMatch = schemeIdUri == 'urn:mpeg:dash:role:2011' && value === 'descriptive';
    const secondMatch = schemeIdUri == 'urn:tva:metadata:cs:AudioPurposeCS:2007' && value === '1';
    const isDescriptive = firstMatch || secondMatch;
    if (isDescriptive) return true;
  }
  return false;
};

const createAudioTrack = ({
  codec,
  channels,
  bitrate,
  jointObjectCoding = 0,
  isDescriptive = false,
  language,
  segments,
}) => {
  const parsedBitrate = parseBitrate(Number(bitrate));
  return {
    codec,
    bitrate: parsedBitrate,
    segments,
    channels,
    jointObjectCoding,
    isDescriptive,
    toString() {
      return [
        'AUDIO',
        `[${codec}]`,
        `${channels || '?'}` + (jointObjectCoding ? ` (JOC ${jointObjectCoding})` : ''),
        `${parsedBitrate.kbps} kb/s`,
        language,
      ].join(' | ');
    },
  };
};

module.exports = {
  AUDIO_CODECS,
  parseAudioCodec,
  createAudioTrack,
  getDolbyDigitalPlusComplexityIndex,
  checkIsDescriptive,
};
