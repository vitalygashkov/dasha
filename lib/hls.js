'use strict';

const m3u8Parser = require('m3u8-parser');
const { parseBitrate, getQualityLabel } = require('./util');
const {
  createResolutionFilter,
  createVideoQualityFilter,
  createAudioLanguageFilter,
  createSubtitleLanguageFilter,
} = require('./track');

const parseM3u8 = (manifestString) => {
  const parser = new m3u8Parser.Parser();
  parser.push(manifestString);
  parser.end();
  return parser.manifest;
};

const fetchPlaylist = async (url) =>
  fetch(url)
    .then((response) => response.text())
    .then(parseM3u8);

const parseUrl = (playlistUri, manifestUri) => {
  if (playlistUri.includes('https://')) return playlistUri;
  const uri = new URL(manifestUri);
  return uri.origin + playlistUri;
};

const urlsSame = (url1, url2) => {
  return new URL(url1).pathname === new URL(url2).pathname;
};

const parseMediaGroup = (groups, manifestUri) => {
  const results = [];
  if (!groups) return results;
  for (const [groupId, group] of Object.entries(groups)) {
    for (const [label, entity] of Object.entries(group)) {
      const url = parseUrl(entity.uri, manifestUri);
      const existing = results.find((result) => urlsSame(result.url, url));
      if (!existing)
        results.push({
          groupId,
          label,
          language: entity.language,
          url,
        });
    }
  }
  return results;
};

const getAudioPlaylists = (m3u8, manifestUri) => {
  return parseMediaGroup(m3u8.mediaGroups.AUDIO, manifestUri);
};

const getSubtitlePlaylists = (m3u8, manifestUri) => {
  return parseMediaGroup(m3u8.mediaGroups.SUBTITLES, manifestUri);
};

const getVideoPlaylists = (m3u8, manifestUri) => {
  return m3u8.playlists.map((data) => {
    const bandwidth = data.attributes.BANDWIDTH;
    const url = data.resolvedUri || parseUrl(data.uri, manifestUri);
    const track = { bitrate: parseBitrate(bandwidth), url };
    if (data.attributes.RESOLUTION) {
      track.resolution = data.attributes.RESOLUTION;
      track.quality = getQualityLabel(track.resolution);
    }
    if (data.attributes.CODECS) track.codecs = data.attributes.CODECS;
    if (data.attributes['FRAME-RATE']) track.frameRate = data.attributes['FRAME-RATE'];
    return track;
  });
};

const segmentsDto = (data = []) => {
  const mapSegment = (item) => ({
    url: item.resolvedUri || item.uri,
    duration: item.duration,
    number: item.number,
    presentationTime: item.presentationTime,
  });
  const segments = data.map(mapSegment);
  if (data.length && data[0].map?.resolvedUri)
    segments.unshift({
      url: data[0].map.resolvedUri,
      init: true,
      duration: 0,
      number: 0,
      presentationTime: 0,
    });
  return segments;
};

const fetchTrackSegments = (tracks) => {
  return Promise.all(
    tracks.map(async (track) => {
      const playlist = await fetchPlaylist(track.url);
      track.segments = segmentsDto(playlist.segments);
      if (playlist.contentProtection) {
        track.protection = {};
        const fairplayLegacy = playlist.contentProtection['com.apple.fps.1_0'];
        if (fairplayLegacy)
          track.protection.fairplay = {
            keyFormat: fairplayLegacy.attributes.KEYFORMAT,
            uri: fairplayLegacy.attributes.URI,
            method: fairplayLegacy.attributes.METHOD,
          };
      }
    })
  );
};

const parseManifest = async (manifestString, manifestUri) => {
  const m3u8 = parseM3u8(manifestString);
  const videos = getVideoPlaylists(m3u8, manifestUri);
  const audios = getAudioPlaylists(m3u8, manifestUri);
  const subtitles = getSubtitlePlaylists(m3u8, manifestUri);

  await Promise.all([
    fetchTrackSegments(videos),
    fetchTrackSegments(audios),
    fetchTrackSegments(subtitles),
  ]);

  const manifest = {
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

  return manifest;
};

module.exports = { parseManifest };
