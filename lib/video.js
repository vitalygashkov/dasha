const { parseBitrate, getQualityLabel, parseSize } = require('./util');

const VIDEO_CODECS = {
  avc: 'H.264',
  hevc: 'H.265',
  vc1: 'VC-1',
  vp8: 'VP8',
  vp9: 'VP9',
  av1: 'AV1',
};

const DYNAMIC_RANGE = {
  sdr: 'SDR', // Standart Dynamic Range
  hlg: 'HLG', // Hybrid log-gamma (HDR)
  hdr10: 'HDR10',
  hdr10p: 'HDR10+',
  dv: 'DV', // Dolby Vision
};

const PRIMARIES = {
  Unspecified: 0,
  BT_709: 1,
  BT_601_625: 5,
  BT_601_525: 6,
  BT_2020_and_2100: 9,
  SMPTE_ST_2113_and_EG_4321: 12, // P3D65
};

const TRANSFER = {
  Unspecified: 0,
  BT_709: 1,
  BT_601: 6,
  BT_2020: 14,
  BT_2100: 15,
  BT_2100_PQ: 16,
  BT_2100_HLG: 18,
};

const MATRIX = {
  RGB: 0,
  YCbCr_BT_709: 1,
  YCbCr_BT_601_625: 5,
  YCbCr_BT_601_525: 6,
  YCbCr_BT_2020_and_2100: 9, // YCbCr BT.2100 shares the same CP
  ICtCp_BT_2100: 14,
};

const parseVideoCodecFromMime = (mime) => {
  const target = mime.toLowerCase().trim().split('.')[0];
  const avc = ['avc1', 'avc2', 'avc3', 'dva1', 'dvav'];
  const hevc = ['hev1', 'hev2', 'hev3', 'hvc1', 'hvc2', 'hvc3', 'dvh1', 'dvhe', 'lhv1', 'lhe1'];
  const vc1 = ['vc-1'];
  const vp8 = ['vp08', 'vp8'];
  const vp9 = ['vp09', 'vp9'];
  const av1 = ['av01'];
  if (avc.includes(target)) return VIDEO_CODECS.avc;
  if (hevc.includes(target)) return VIDEO_CODECS.hevc;
  if (vc1.includes(target)) return VIDEO_CODECS.hevc;
  if (vp8.includes(target)) return VIDEO_CODECS.vp8;
  if (vp9.includes(target)) return VIDEO_CODECS.vp9;
  if (av1.includes(target)) return VIDEO_CODECS.av1;
  throw new Error(`The MIME ${mime} is not supported as video codec`);
};

const parseDynamicRangeFromCicp = (primaries, transfer, matrix) => {
  // While not part of any standard, it is typically used as a PAL variant of Transfer.BT_601=6.
  // i.e. where Transfer 6 would be for BT.601-NTSC and Transfer 5 would be for BT.601-PAL.
  // The codebase is currently agnostic to either, so a manual conversion to 6 is done.
  if (transfer == 5) transfer = TRANSFER.BT_601;

  if (
    primaries == PRIMARIES.Unspecified &&
    transfer == TRANSFER.Unspecified &&
    matrix == MATRIX.RGB
  )
    return DYNAMIC_RANGE.sdr;
  else if ([PRIMARIES.BT_601_625, PRIMARIES.BT_601_525].includes(primaries))
    return DYNAMIC_RANGE.sdr;
  else if (TRANSFER.BT_2100_PQ === transfer) return DYNAMIC_RANGE.hdr10;
  else if (TRANSFER.BT_2100_HLG === transfer) return DYNAMIC_RANGE.hlg;
  else return DYNAMIC_RANGE.sdr;
};

const createVideoTrack = ({
  id,
  label,
  type,
  codec,
  dynamicRange,
  contentProtection,
  bitrate,
  duration,
  width,
  height,
  fps,
  language,
  segments,
}) => {
  const parsedBitrate = parseBitrate(Number(bitrate));
  const parsedWidth = Number(width);
  const parsedHeight = Number(height);
  const size = duration ? parseSize(Number(bitrate), Number(duration)) : undefined;
  return {
    id,
    label,
    type,
    codec,
    bitrate: parsedBitrate,
    size,
    protection: contentProtection,
    segments,
    dynamicRange,
    language,
    width: parsedWidth,
    height: parsedHeight,
    fps: Number(fps),
    quality: getQualityLabel({ width: parsedWidth, height: parsedHeight }),
    toString() {
      return [
        'VIDEO',
        `[${codec}, ${dynamicRange}]`,
        language,
        `${width}x${height} @ ${parsedBitrate.kbps} kb/s, ${fps} FPS`,
      ].join(' | ');
    },
  };
};

const parseVideoCodec = (codecs) => {
  for (const codec of codecs.toLowerCase().split(',')) {
    const mime = codec.trim().split('.')[0];
    try {
      return parseVideoCodecFromMime(mime);
    } catch (e) {
      continue;
    }
  }
  throw new Error(`No MIME types matched any supported Video Codecs in ${codecs}`);
};

const parseDynamicRange = (codecs, supplementalProps = [], essentialProps = []) => {
  const dv = ['dva1', 'dvav', 'dvhe', 'dvh1'];
  if (dv.some((value) => codecs.startsWith(value))) return DYNAMIC_RANGE.dv;
  const primariesScheme = 'urn:mpeg:mpegB:cicp:ColourPrimaries';
  const transferScheme = 'urn:mpeg:mpegB:cicp:TransferCharacteristics';
  const matrixScheme = 'urn:mpeg:mpegB:cicp:MatrixCoefficients';
  const allProps = [...essentialProps, ...supplementalProps];
  const getValues = (scheme) =>
    allProps
      .filter((prop) => prop.attributes.schemeIdUri === scheme)
      .map((prop) => parseInt(prop.attributes.value));
  const primaries = getValues(primariesScheme).reduce((acc, current) => acc + current, 0);
  const transfer = getValues(transferScheme).reduce((acc, current) => acc + current, 0);
  const matrix = getValues(matrixScheme).reduce((acc, current) => acc + current, 0);
  return parseDynamicRangeFromCicp(primaries, transfer, matrix);
};

module.exports = { parseVideoCodec, parseDynamicRange, createVideoTrack, VIDEO_CODECS };
