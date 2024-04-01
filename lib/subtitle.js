'use strict';

const { parseMimes } = require('./track');

const SUBTITLE_CODECS = {
  SubRip: 'SRT', // https://wikipedia.org/wiki/SubRip
  SubStationAlpha: 'SSA', // https://wikipedia.org/wiki/SubStation_Alpha
  SubStationAlphav4: 'ASS', // https://wikipedia.org/wiki/SubStation_Alpha#Advanced_SubStation_Alpha=
  TimedTextMarkupLang: 'TTML', // https://wikipedia.org/wiki/Timed_Text_Markup_Language
  WebVTT: 'VTT', // https://wikipedia.org/wiki/WebVTT
  // MPEG-DASH box-encapsulated subtitle formats
  fTTML: 'STPP', // https://www.w3.org/TR/2018/REC-ttml-imsc1.0.1-20180424
  fVTT: 'WVTT', // https://www.w3.org/TR/webvtt1
};

const parseSubtitleCodecFromMime = (mime) => {
  const target = mime.toLowerCase().trim().split('.')[0];
  switch (target) {
    case 'srt':
      return SUBTITLE_CODECS.SubRip;
    case 'ssa':
      return SUBTITLE_CODECS.SubStationAlpha;
    case 'ass':
      return SUBTITLE_CODECS.SubStationAlphav4;
    case 'ttml':
      return SUBTITLE_CODECS.TimedTextMarkupLang;
    case 'vtt':
      return SUBTITLE_CODECS.WebVTT;
    case 'stpp':
      return SUBTITLE_CODECS.fTTML;
    case 'wvtt':
      return SUBTITLE_CODECS.fVTT;
    default:
      throw new Error(`The MIME ${mime} is not supported as subtitle codec`);
  }
};

const parseSubtitleCodec = (codecs) => {
  const mimes = parseMimes(codecs);
  for (const mime of mimes) {
    try {
      return parseSubtitleCodecFromMime(mime);
    } catch (e) {
      continue;
    }
  }
  throw new Error(`No MIME types matched any supported Subtitle Codecs in ${codecs}`);
};

const checkIsClosedCaption = (roles = []) => {
  for (const role of roles) {
    const isClosedCaption =
      role.attributes.schemeIdUri === 'urn:mpeg:dash:role:2011' &&
      role.attributes.value === 'caption';
    if (isClosedCaption) return true;
  }
  return false;
};

const checkIsSdh = (accessibilities = []) => {
  for (const accessibility of accessibilities) {
    const { schemeIdUri, value } = accessibility.attributes;
    const isSdh = schemeIdUri === 'urn:tva:metadata:cs:AudioPurposeCS:2007' && value === '2';
    if (isSdh) return true;
  }
  return false;
};

const checkIsForced = (roles = []) => {
  for (const role of roles) {
    const isForced =
      role.attributes.schemeIdUri === 'urn:mpeg:dash:role:2011' &&
      (role.attributes.value === 'forced-subtitle' || role.attributes.value === 'forced_subtitle');
    if (isForced) return true;
  }
  return false;
};

const createSubtitleTrack = ({ codec, isClosedCaption, isSdh, isForced, language, segments }) => {
  return {
    codec,
    isClosedCaption,
    isSdh,
    isForced,
    segments,
    toString() {
      return ['SUBTITLE', `[${codec}]`, language].join(' | ');
    },
  };
};

module.exports = {
  parseSubtitleCodec,
  checkIsClosedCaption,
  checkIsSdh,
  checkIsForced,
  createSubtitleTrack,
};
