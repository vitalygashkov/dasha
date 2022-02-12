'use strict';

const { parseXml } = require('./xml');
const { processManifest } = require('./processor');
const { CONTENT_TYPE } = require('./constants');

class Manifest {
  periods;

  constructor(manifest) {
    for (const key of Object.keys(manifest)) this[key] = manifest[key];
  }

  getTracks({ contentType, width, height, bandwidth, duration }) {
    const tracks = [];

    const adaptationSets = this.periods.map((p) => p.adaptationSets).flat(1);
    const representations = adaptationSets
      .map((a) => a.representations)
      .flat(2)
      .filter((r) => (contentType === CONTENT_TYPE.video ? !!r.height : !r.height));

    // TODO: Improve behavior when multiple audio with different languages
    let selectedRepresentations =
      contentType === CONTENT_TYPE.video
        ? representations.filter((r) => r.height === height)
        : representations;
    if (!selectedRepresentations.length)
      selectedRepresentations = [this.findBestRepresentation(representations)];
    selectedRepresentations = [this.findBestRepresentation(selectedRepresentations)];

    for (const representation of selectedRepresentations) {
      const adaptationSet = adaptationSets.find((a) => a.representations.includes(representation));

      const track = {
        type: contentType,
        pssh: adaptationSet.contentProtections.find((c) => !!c.cencPssh)?.cencPssh || null,
        licenseUrl:
          adaptationSet.contentProtections.find((c) => !!c.licenseUrl)?.licenseUrl || null,
        segments: this.getSegments(adaptationSet, representation),
        bitrate: Math.round(representation.bandwidth / 1000),
        size: duration ? Math.ceil((representation.bandwidth / 8e6) * duration) : null,
        width: representation.width || null,
        height: representation.height || null,
        quality: representation.height ? this.getQualityLabel(representation.height) : null,
        audioSampleRate: representation.audioSamplingRate
          ? representation.audioSamplingRate / 1000
          : null,
      };
      tracks.push(track);
    }

    return tracks;
  }

  findBestRepresentation(representations) {
    const bandwidths = representations.map((r) => r.bandwidth);
    const maxBandwidth = Math.max(...bandwidths);
    return representations.find((r) => r.bandwidth === maxBandwidth);
  }

  getQualityLabel(videoHeight) {
    let quality = 'SD';
    if (videoHeight >= 720) quality = 'HD';
    if (videoHeight >= 1080) quality = 'Full HD';
    if (videoHeight >= 2016) quality = '4K';
    return quality;
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

const parseManifest = (data) => {
  const xml = parseXml(data);
  const manifest = processManifest(xml);
  return manifest ? new Manifest(manifest) : null;
};

module.exports = { parseManifest };
