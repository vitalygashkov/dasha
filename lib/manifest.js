'use strict';

const { parseXml } = require('./xml');
const { processManifest } = require('./processor');
const { getQualityLabel } = require('./utils');
const { CONTENT_TYPE, KEY_SYSTEMS } = require('./constants');

class Manifest {
  constructor(manifest) {
    for (const key of Object.keys(manifest)) this[key] = manifest[key];
  }

  getVideoTrack(height) {
    const isVideoAdaptationSet = (adaptationSet) =>
      adaptationSet.contentType === CONTENT_TYPE.video ||
      adaptationSet.mimeType === 'video/mp4' ||
      adaptationSet.maxWidth ||
      adaptationSet.maxHeight;
    const adaptationSets = this.periods
      .map((p) => p.adaptationSets)
      .flat(1)
      .filter(isVideoAdaptationSet);
    const representations = adaptationSets.map((a) => a.representations).flat(2);
    const matches = representations.filter((r) => r.height === height);
    const representation = this.findBestRepresentation(matches.length ? matches : representations);
    const adaptationSet = adaptationSets.find((a) => a.representations.includes(representation));
    return {
      type: CONTENT_TYPE.video,
      pssh: this.getWidevinePssh(adaptationSet),
      licenseUrl: this.getWidevineLicenseUrl(adaptationSet),
      segments: this.getSegments(adaptationSet, representation),
      bitrate: Math.round(representation.bandwidth / 1000), // Kbps
      size: Math.ceil((representation.bandwidth / 8e6) * this.mediaPresentationDuration), // MB
      width: representation.width,
      height: representation.height,
      quality: getQualityLabel(representation.height),
    };
  }

  getAudioTracks(languages) {
    const isAudioAdaptationSet = (adaptationSet) =>
      adaptationSet.contentType === CONTENT_TYPE.audio ||
      adaptationSet.mimeType === 'audio/mp4' ||
      !adaptationSet.maxWidth ||
      !adaptationSet.maxHeight;
    const adaptationSets = this.periods
      .map((p) => p.adaptationSets)
      .flat(1)
      .filter(isAudioAdaptationSet);

    const representations = adaptationSets.map((a) => a.representations).flat(2);
    const matches = representations.filter((r) => languages?.some((lang) => r.lang.includes(lang)));
    // TODO: Select all audio tracks if they with different langs but same bandwidth
    const selectedRepresentations = matches?.length
      ? matches
      : [this.findBestRepresentation(representations)];

    const tracks = [];
    for (const representation of selectedRepresentations) {
      const adaptationSet = adaptationSets.find((a) => a.representations.includes(representation));
      const track = {
        type: CONTENT_TYPE.audio,
        pssh: this.getWidevinePssh(adaptationSet),
        licenseUrl: this.getWidevineLicenseUrl(adaptationSet),
        segments: this.getSegments(adaptationSet, representation),
        bitrate: Math.round(representation.bandwidth / 1000), // Kbps
        size: Math.ceil((representation.bandwidth / 8e6) * this.mediaPresentationDuration), // MB
        audioSampleRate: representation.audioSamplingRate / 1000,
      };
      tracks.push(track);
    }

    return tracks;
  }

  getSubtitleTracks(languages) {
    // TODO: Return subtitle tracks
  }

  getWidevinePssh(adaptationSet) {
    const isWidevineProtection = (protection) =>
      protection.schemeIdUri === KEY_SYSTEMS['com.widevine.alpha'];
    return adaptationSet.contentProtections.find(isWidevineProtection)?.cencPssh || null;
  }

  getWidevineLicenseUrl(adaptationSet) {
    const isWidevineProtection = (protection) =>
      protection.schemeIdUri === KEY_SYSTEMS['com.widevine.alpha'];
    return adaptationSet.contentProtections.find(isWidevineProtection)?.licenseUrl || null;
  }

  findBestRepresentation(representations) {
    const bandwidths = representations.map((r) => r.bandwidth);
    const maxBandwidth = Math.max(...bandwidths);
    return representations.find((r) => r.bandwidth === maxBandwidth);
  }

  getSegments(adaptationSet, representation) {
    const segments = [];

    const isBaseUrlRequired = !adaptationSet.segmentTemplate.media.includes(`https://`);
    const baseUrl = representation.baseUrls?.map((url) => url.value)?.[0];
    const initTemplate = adaptationSet.segmentTemplate.initialization;
    const initUrl = initTemplate
      ?.replace(/\$Bandwidth\$/i, representation.bandwidth)
      ?.replace(/\$RepresentationID\$/i, representation.id);
    const initFullUrl = isBaseUrlRequired ? baseUrl + initUrl : initUrl;
    if (initUrl) segments.push({ url: initFullUrl, init: true });

    const mediaTemplate = adaptationSet.segmentTemplate.media.replace(
      /\$Bandwidth\$/i,
      representation.bandwidth
    );
    let time = 0;
    let index = parseInt(adaptationSet.segmentTemplate.startNumber) || 0;

    if (!Array.isArray(adaptationSet.segmentTemplate['SegmentTimeline']['S']))
      adaptationSet.segmentTemplate['SegmentTimeline']['S'] = [
        adaptationSet.segmentTemplate['SegmentTimeline']['S'],
      ];

    for (const segment of adaptationSet.segmentTemplate['SegmentTimeline']['S']) {
      const repeats = parseInt(segment.r || '0') + 1;
      if (segment.t) time = parseInt(segment.t);
      const duration = parseInt(segment.d || adaptationSet.segmentTemplate.timescale || '0');
      for (let i = 0; i < repeats; i++) {
        const url = mediaTemplate
          ?.replace(/\$Number\$/i, index + '')
          ?.replace(/\$Time\$/i, time + '')
          ?.replace(/\$RepresentationID\$/i, representation.id);
        const fullUrl = isBaseUrlRequired ? baseUrl + url : url;
        segments.push({ url: fullUrl });
        index++;
        time += duration;
      }
    }

    return segments;
  }

  getPssh() {
    let pssh = null;
    for (const period of this.periods)
      for (const adaptationSet of period.adaptationSets)
        for (const contentProtection of adaptationSet.contentProtections)
          if (contentProtection.cencPssh) {
            pssh = contentProtection.cencPssh;
            break;
          }
    return pssh;
  }

  getLicenseUrl() {
    let licenseUrl = null;
    for (const period of this.periods)
      for (const adaptationSet of period.adaptationSets)
        for (const contentProtection of adaptationSet.contentProtections)
          if (contentProtection.licenseUrl) {
            licenseUrl = contentProtection.licenseUrl;
            break;
          }
    return licenseUrl;
  }
}

const parseManifest = (text) => {
  const parsedXml = parseXml(text);
  const manifest = processManifest(parsedXml);
  return manifest ? new Manifest(manifest) : null;
};

module.exports = { parseManifest };
