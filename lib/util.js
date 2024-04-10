'use strict';

const formatBytes = (bytes, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']) => {
  if (bytes == 0) return `0 ${sizes[0]}`;
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  if (i == 0) return bytes + ' ' + sizes[i];
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};

const parseSize = (bandwidth, duration) => ({
  b: bandwidth * duration,
  kb: (bandwidth / 1000) * duration,
  mb: (bandwidth / 8e6) * duration,
  gb: (bandwidth / 8e9) * duration,
  toString() {
    return formatBytes(bandwidth * duration);
  },
});

const parseBitrate = (bandwidth) => ({
  bps: bandwidth,
  kbps: bandwidth / 1000,
  mbps: bandwidth / 8e6,
  gbps: bandwidth / 8e9,
  toString() {
    return formatBytes(bandwidth, ['bps', 'Kbps', 'Mbps', 'Gbps']);
  },
});

const qualities = [
  { width: 7680, height: 4320 },
  { width: 3840, height: 2160 },
  { width: 2560, height: 1440 },
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
  { width: 854, height: 480 },
  { width: 640, height: 360 },
  { width: 426, height: 240 },
  { width: 256, height: 144 },
];
const getWidth = (height) => qualities.find((q) => q.height === height)?.width;
const getHeight = (width) => qualities.find((q) => q.width === width)?.height;
const getQualityLabel = (resolution) => `${getHeight(resolution.width) || resolution.height}p`;

const getBestTrack = (tracks) => {
  const maxBitrate = Math.max(...tracks.map((track) => track.bitrate.bps));
  return tracks.find((track) => track.bitrate.bps === maxBitrate);
};

const parseDuration = (str) => {
  const SECONDS_IN_YEAR = 365 * 24 * 60 * 60;
  const SECONDS_IN_MONTH = 30 * 24 * 60 * 60;
  const SECONDS_IN_DAY = 24 * 60 * 60;
  const SECONDS_IN_HOUR = 60 * 60;
  const SECONDS_IN_MIN = 60;

  // P10Y10M10DT10H10M10.1S
  const durationRegex =
    /P(?:(\d*)Y)?(?:(\d*)M)?(?:(\d*)D)?(?:T(?:(\d*)H)?(?:(\d*)M)?(?:([\d.]*)S)?)?/;
  const match = durationRegex.exec(str);

  if (!match) {
    return 0;
  }

  const [year, month, day, hour, minute, second] = match.slice(1);

  return (
    parseFloat(year || 0) * SECONDS_IN_YEAR +
    parseFloat(month || 0) * SECONDS_IN_MONTH +
    parseFloat(day || 0) * SECONDS_IN_DAY +
    parseFloat(hour || 0) * SECONDS_IN_HOUR +
    parseFloat(minute || 0) * SECONDS_IN_MIN +
    parseFloat(second || 0)
  );
};

const isLanguageTagValid = (value) => {
  try {
    Intl.getCanonicalLocales(value);
    return true;
  } catch (err) {
    return false;
  }
};

module.exports = {
  parseSize,
  parseBitrate,
  getWidth,
  getHeight,
  getQualityLabel,
  getBestTrack,
  parseDuration,
  isLanguageTagValid,
};
