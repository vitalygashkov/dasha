'use strict';

const { inheritAttributes, stringToMpdXml, toPlaylists, toM3u8 } = require('mpd-parser');

const parse = (text, url, eventHandler) => {
  const options = { manifestUri: url, eventHandler };
  const parsedManifestInfo = inheritAttributes(stringToMpdXml(text), options);
  const playlists = toPlaylists(parsedManifestInfo.representationInfo);
  const manifest = toM3u8({
    dashPlaylists: playlists,
    locations: parsedManifestInfo.locations,
    contentSteering: parsedManifestInfo.contentSteeringInfo,
    eventStream: parsedManifestInfo.eventStream,
  });
  manifest.allPlaylists = playlists;
  return manifest;
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

const getSegments = (playlist) => {
  const segments =
    playlist.segments.map((segment) => ({
      url: segment.resolvedUri,
    })) || [];
  if (playlist.segments.length && playlist.segments[0].map?.resolvedUri)
    segments.unshift({ url: playlist.segments[0].map.resolvedUri, init: true });
  return segments;
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
  const segments = getSegments(playlist);
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
    const segments = getSegments(playlist);
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
    const segments = getSegments(playlist);
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
  getPssh,
  getVideoTrack,
  getAudioTracks,
  getSubtitleTracks,
  getQualityLabel,
};
