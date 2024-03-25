'use strict';

const m3u8Parser = require('m3u8-parser');
const mpdParser = require('mpd-parser');

const segmentsDto = (data) => {
  const segments =
    data.map((segment) => ({
      url: segment.resolvedUri,
    })) || [];
  if (data.length && data[0].map?.resolvedUri)
    segments.unshift({ url: data[0].map.resolvedUri, init: true });
  return segments;
};

const formatBytes = (bytes, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']) => {
  if (bytes == 0) return `0 ${sizes[0]}`;
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  if (i == 0) return bytes + ' ' + sizes[i];
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};

const trackDto = (data, duration) => {
  const bandwidth = data.attributes.BANDWIDTH;
  const result = {
    id: data.attributes.NAME,
    codecs: data.attributes.CODECS,
    bandwidth: {
      bps: bandwidth,
      kbps: bandwidth / 1024,
      mbps: bandwidth / 8e6,
      gbps: bandwidth / 8e9,
      toString() {
        return formatBytes(bandwidth, ['bps', 'Kbps', 'Mbps', 'Gbps']);
      },
    },
    size: {
      b: bandwidth * duration,
      kb: (bandwidth / 1024) * duration,
      mb: (bandwidth / 8e6) * duration,
      gb: (bandwidth / 8e9) * duration,
      toString() {
        return formatBytes(bandwidth * duration);
      },
    },
    segments: segmentsDto(data.segments),
  };
  if (data.attributes.RESOLUTION) result.resolution = data.attributes.RESOLUTION;
  return result;
};

const audioDto = (data) => {
  const result = [];
  if (!data) return result;
  for (const [key, value] of Object.entries(data)) {
    result.push(...value.playlists);
  }
  return result;
};

const subsDto = (data) => {
  const result = [];
  if (!data) return result;
  for (const [key, value] of Object.entries(data)) {
    result.push(...value.playlists);
  }
  return result;
};

const parseMpd = (manifestString, manifestUri) => {
  const xml = mpdParser.stringToMpdXml(manifestString);
  const parsedManifestInfo = mpdParser.inheritAttributes(xml, { manifestUri });
  const playlists = mpdParser.toPlaylists(parsedManifestInfo.representationInfo);
  const manifest = mpdParser.toM3u8({
    dashPlaylists: playlists,
    locations: parsedManifestInfo.locations,
    contentSteering: parsedManifestInfo.contentSteeringInfo,
    eventStream: parsedManifestInfo.eventStream,
  });
  manifest.allPlaylists = playlists;

  const toTrackWithSize = (data) => trackDto(data, manifest.duration);
  const videoPlaylists = manifest.playlists;
  const audioPlaylists = audioDto(manifest.mediaGroups.AUDIO.audio);
  const subtitlePlaylists = subsDto(manifest.mediaGroups.SUBTITLES.subs);
  const mpd = {
    duration: manifest.duration,
    tracks: {
      videos: videoPlaylists.map(toTrackWithSize),
      audios: audioPlaylists.map(toTrackWithSize),
      subtitles: subtitlePlaylists.map(toTrackWithSize),
    },
  };

  return mpd;
};

const parseM3U8 = (manifestString) => {
  const parser = new m3u8Parser.Parser();
  parser.push(manifestString);
  parser.end();
  const manifest = parser.manifest;
  return manifest;
};

const parse = (text, url, eventHandler) => {
  if (text.includes('MPD')) return parseMpd(text, url, eventHandler);
  else if (text.includes('#EXTM3U')) return parseM3U8(text);
  else return null;
};

const getBestPlaylist = (playlists) => {
  const maxBandwidth = Math.max(...playlists.map((playlist) => playlist.attributes.BANDWIDTH));
  return playlists.find((playlist) => playlist.attributes.BANDWIDTH === maxBandwidth);
};

const getPlaylistPssh = (playlist) => {
  const pssh = playlist.contentProtection?.['com.widevine.alpha']?.pssh;
  return pssh ? Buffer.from(pssh).toString('base64') : null;
};

const getPssh = (manifest) => {
  const playlist = getBestPlaylist(manifest.playlists);
  return getPlaylistPssh(playlist);
};

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

const getVideoTrack = (manifest, height) => {
  const matchHeight = (playlist) => {
    if (!height) return false;
    const playlistWidth = playlist.attributes.RESOLUTION.width;
    const targetWidth = getWidth(height);
    if (!playlistWidth || !targetWidth) return false;
    return playlistWidth === targetWidth;
  };

  const playlist = manifest.playlists.find(matchHeight) || getBestPlaylist(manifest.playlists);
  const segments = segmentsDto(playlist);
  const qualityLabel = getQualityLabel(playlist.attributes.RESOLUTION);

  return {
    type: 'video',
    id: 0,
    segments: segments,
    codecs: playlist.attributes.CODECS,
    bitrate: Math.round(playlist.attributes.BANDWIDTH / 1024), // KiB/s
    size: Math.ceil((playlist.attributes.BANDWIDTH / 8e6) * manifest.duration), // MB
    pssh: getPlaylistPssh(playlist),
    licenseUrl: playlist.contentSteering?.serverURL || null,
    width: playlist.attributes.RESOLUTION.width,
    height: playlist.attributes.RESOLUTION.height,
    quality: qualityLabel,
    qualityLabel: qualityLabel,
  };
};

const getAudioTracks = (manifest, languages = []) => {
  const audioCollection = manifest.mediaGroups.AUDIO.audio;
  if (!audioCollection) return [];
  const audios = Object.values(audioCollection).filter((audio) => {
    if (languages.length) languages.some((lang) => audio.language.startsWith(lang));
    else return true;
  });

  return audios.map((audio, index) => {
    const playlist = getBestPlaylist(audio.playlists);
    const segments = segmentsDto(playlist);
    const label = Object.entries(audioCollection).find(([_, value]) => value === audio)?.[0];
    return {
      type: 'audio',
      id: index,
      label,
      segments,
      bitrate: Math.round(playlist.attributes.BANDWIDTH / 1024), // KiB/s
      size: Math.ceil((playlist.attributes.BANDWIDTH / 8e6) * manifest.duration), // MB
      pssh: getPlaylistPssh(playlist),
      licenseUrl: playlist.contentSteering?.serverURL || null,
      audioSampleRate: 0,
      language: audio.language,
    };
  });
};

const getSubtitleTracks = (manifest, languages = []) => {
  const subCollection = manifest.mediaGroups.SUBTITLES.subs;
  if (!subCollection) return [];
  const subs = Object.values(subCollection).filter((sub) => {
    if (languages.length) languages.some((lang) => sub.language.startsWith(lang));
    else return true;
  });
  return subs.map((sub, index) => {
    const playlist = getBestPlaylist(sub.playlists);
    const segments = segmentsDto(playlist);
    const label = Object.entries(subCollection).find(([_, value]) => value === sub)?.[0];
    const originalPlaylist = manifest.allPlaylists.find((p) => p.attributes.label === label);
    const language = originalPlaylist?.attributes.lang || sub.language;
    return {
      type: 'text',
      id: index,
      label,
      segments,
      language,
      bitrate: Math.round(playlist.attributes.BANDWIDTH / 1024), // KiB/s
      size: Math.ceil((playlist.attributes.BANDWIDTH / 8e6) * manifest.duration), // MB
    };
  });
};

module.exports = {
  parse,
  parseMpd,
  parseM3U8,
  getPssh,
  getVideoTrack,
  getAudioTracks,
  getSubtitleTracks,
  getQualityLabel,
};
