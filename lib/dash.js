'use strict';

const mpdParser = require('mpd-parser');
const { parseBitrate, parseSize, getQualityLabel } = require('./util');
const {
  createResolutionFilter,
  createVideoQualityFilter,
  createAudioLanguageFilter,
  createSubtitleLanguageFilter,
} = require('./track');

const segmentsDto = (data = []) => {
  const mapSegment = (item) => ({
    url: item.resolvedUri,
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

const trackDto = (data, duration) => {
  const bandwidth = data.attributes.BANDWIDTH;
  const track = {
    id: data.attributes.NAME,
    bitrate: parseBitrate(bandwidth),
    size: parseSize(bandwidth, duration),
    segments: segmentsDto(data.segments),
  };
  if (data.attributes.RESOLUTION) {
    track.resolution = data.attributes.RESOLUTION;
    track.quality = getQualityLabel(track.resolution);
  }
  if (data.attributes['FRAME-RATE']) track.frameRate = data.attributes['FRAME-RATE'];
  if (data.attributes.CODECS) track.codecs = data.attributes.CODECS;
  if (data.language) track.language = data.language;
  if (data.label) track.label = data.label;
  if (data.contentProtection) {
    track.protection = {};
    if (data.contentProtection?.mp4protection)
      track.protection.common = {
        id: data.contentProtection.mp4protection.attributes.schemeIdUri,
        value: data.contentProtection.mp4protection.attributes.value,
        keyId: data.contentProtection.mp4protection.attributes['cenc:default_KID'],
      };
    if (data.contentProtection['com.microsoft.playready'])
      track.protection.playready = {
        id: data.contentProtection['com.microsoft.playready'].attributes.schemeIdUri,
        value: data.contentProtection['com.microsoft.playready'].attributes.value,
        pssh: Buffer.from(data.contentProtection['com.microsoft.playready'].pssh).toString(
          'base64'
        ),
      };
    if (data.contentProtection['com.widevine.alpha'])
      track.protection.widevine = {
        id: data.contentProtection['com.widevine.alpha'].attributes.schemeIdUri,
        pssh: Buffer.from(data.contentProtection['com.widevine.alpha'].pssh).toString('base64'),
      };
  }
  return track;
};

const getAudioPlaylists = (mpd) => {
  const group = mpd.mediaGroups.AUDIO.audio;
  const result = [];
  if (!group) return result;
  for (const [label, value] of Object.entries(group)) {
    result.push(...value.playlists.map((item) => ({ ...item, language: value.language, label })));
  }
  return result;
};

const getSubtitlePlaylists = (mpd) => {
  const group = mpd.mediaGroups.SUBTITLES.subs;
  const result = [];
  if (!group) return result;
  for (const [label, value] of Object.entries(group)) {
    // Fix language because mpd-parser sets label into language field of subtitle playlist
    const originalPlaylist = mpd.allPlaylists.find((p) => p.attributes.label === label);
    const language = originalPlaylist?.attributes.lang || value.language;
    result.push(...value.playlists.map((item) => ({ ...item, language })));
  }
  return result;
};

const from = (list) => {
  if (!list.length) return [];
  const result = [];
  for (let i = 0; i < list.length; i++) result.push(list[i]);
  return result;
};

const findChildren = (element, name) =>
  from(element.childNodes).filter(({ tagName }) => tagName === name);

// This patch is needed because mpd-parser doesn't parse content protection from representation
const patchContentProtection = (xml) => {
  const periods = findChildren(xml, 'Period');
  for (const period of periods) {
    const adaptationSets = findChildren(period, 'AdaptationSet');
    for (const adaptationSet of adaptationSets) {
      const representations = findChildren(adaptationSet, 'Representation');
      const adaptationProtection = findChildren(adaptationSet, 'ContentProtection');
      for (const representation of representations) {
        const representationProtection = findChildren(representation, 'ContentProtection');
        if (!adaptationProtection.length && representationProtection.length) {
          representationProtection.forEach((protection) => adaptationSet.appendChild(protection));
        }
      }
    }
  }
};

const parseMpd = (manifestString, manifestUri) => {
  const xml = mpdParser.stringToMpdXml(manifestString);
  patchContentProtection(xml);
  const parsedManifestInfo = mpdParser.inheritAttributes(xml, { manifestUri });
  const playlists = mpdParser.toPlaylists(parsedManifestInfo.representationInfo);
  const mpd = mpdParser.toM3u8({
    dashPlaylists: playlists,
    locations: parsedManifestInfo.locations,
    contentSteering: parsedManifestInfo.contentSteeringInfo,
    eventStream: parsedManifestInfo.eventStream,
  });
  mpd.allPlaylists = playlists;
  return mpd;
};

const parseManifest = (manifestString, manifestUri) => {
  const mpd = parseMpd(manifestString, manifestUri);
  const toTrack = (data) => trackDto(data, mpd.duration);
  const videos = mpd.playlists.map(toTrack);
  const audios = getAudioPlaylists(mpd).map(toTrack);
  const subtitles = getSubtitlePlaylists(mpd).map(toTrack);
  const all = videos.concat(audios).concat(subtitles);

  const manifest = {
    duration: mpd.duration,
    tracks: {
      all,
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
