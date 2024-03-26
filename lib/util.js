'use strict';

const formatBytes = (bytes, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']) => {
  if (bytes == 0) return `0 ${sizes[0]}`;
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  if (i == 0) return bytes + ' ' + sizes[i];
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};

const parseSize = (bandwidth, duration) => ({
  b: bandwidth * duration,
  kb: (bandwidth / 1024) * duration,
  mb: (bandwidth / 8e6) * duration,
  gb: (bandwidth / 8e9) * duration,
  toString() {
    return formatBytes(bandwidth * duration);
  },
});

const parseBitrate = (bandwidth) => ({
  bps: bandwidth,
  kbps: bandwidth / 1024,
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
  const maxBitrate = Math.max(...tracks.map((track) => track.bitrate.b));
  return tracks.find((track) => track.bitrate.b === maxBitrate);
};

module.exports = { parseSize, parseBitrate, getWidth, getHeight, getQualityLabel, getBestTrack };
