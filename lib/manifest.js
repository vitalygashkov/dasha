'use strict';

const { parseXml } = require('./xml');
const { processManifest } = require('./processor');
const { getQualityLabel, getHeightByWidth, getClosest } = require('./utils');
const { CONTENT_TYPE, KEY_SYSTEMS } = require('./constants');

const isUrl = (value) => {
  try {
    return !!new URL(value);
  } catch (e) {
    return false;
  }
};

class Manifest {
  constructor(manifest) {
    for (const key of Object.keys(manifest)) this[key] = manifest[key];
  }

  addBaseUrl(value) {
    if (Array.isArray(this.baseUrls)) this.baseUrls.push({ value });
    else this.baseUrls = [{ value }];
  }

  getVideoTrack(height) {
    const isVideoAdaptationSet = (adaptationSet) =>
      adaptationSet.contentType === CONTENT_TYPE.video ||
      adaptationSet.mimeType?.includes('video') ||
      adaptationSet.maxWidth ||
      adaptationSet.maxHeight;
    const adaptationSets = this.periods
      .map((p) => p.adaptationSets)
      .flat(1)
      .filter(isVideoAdaptationSet);
    const representations = adaptationSets.map((a) => a.representations).flat(2);

    let suitableRepresentations = [];
    if (height) {
      const resolutions = representations.map((r) => ({
        height: getHeightByWidth(r.width),
        width: r.width,
      }));
      const heights = resolutions.map((r) => r.height);
      const matchedHeight = height ? getClosest(height, heights) : Math.max(...heights);
      const matchedResolution = resolutions.find((r) => r.height === matchedHeight);
      const matchesInHeight = representations.filter((r) => matchedResolution.width === r.width);
      const matchesInId = representations.filter((r) => r.id.includes(height.toString()));
      suitableRepresentations = matchesInHeight?.length ? matchesInHeight : matchesInId;
    }

    const representation = this.findBestRepresentation(
      suitableRepresentations.length ? suitableRepresentations : representations
    );
    const adaptationSet = adaptationSets.find((a) => a.representations.includes(representation));
    let codec = 'x264';
    if (representation.codecs.includes('hvc') || representation.codecs.includes('hev'))
      codec = 'x265';
    let bitDepth = '8bit';
    if (representation.codecs.includes('.2.4.')) bitDepth = '10bit';
    if (representation.codecs.includes('.4.16.')) bitDepth = '12bit';
    return {
      id: 0,
      type: CONTENT_TYPE.video,
      pssh: this.getWidevinePssh(adaptationSet),
      licenseUrl: this.getWidevineLicenseUrl(adaptationSet),
      segments: this.getSegments(adaptationSet, representation),
      bitrate: Math.round(representation.bandwidth / 1000), // Kbps
      size: Math.ceil((representation.bandwidth / 8e6) * this.mediaPresentationDuration), // MB
      width: representation.width,
      height: representation.height,
      qualityLabel: getQualityLabel(representation.width),
      hevc: representation.codecs.includes('hvc') || representation.codecs.includes('hev'),
      codec,
      bitDepth,
    };
  }

  getAudioTracks(languages) {
    const filterAudio = (adaptationSet) =>
      (adaptationSet.contentType === CONTENT_TYPE.audio ||
        adaptationSet.mimeType?.includes('audio') ||
        adaptationSet.representations.some((r) => r.mimeType?.includes('audio'))) &&
      !adaptationSet.maxWidth;
    const filterLanguages = (adaptationSet) =>
      languages?.length ? languages.some((lang) => adaptationSet.lang.includes(lang)) : true;
    const adaptationSets = this.periods
      .map((p) => p.adaptationSets)
      .flat(1)
      .filter(filterAudio)
      .filter(filterLanguages);

    const tracks = [];
    for (const adaptationSet of adaptationSets) {
      const representation = this.findBestRepresentation(adaptationSet.representations);
      let codec = '';
      const track = {
        id: tracks.length,
        type: CONTENT_TYPE.audio,
        label: adaptationSet.label,
        language: adaptationSet.lang,
        pssh: this.getWidevinePssh(adaptationSet),
        licenseUrl: this.getWidevineLicenseUrl(adaptationSet),
        segments: this.getSegments(adaptationSet, representation),
        bitrate: Math.round(representation.bandwidth / 1000), // Kbps
        size: Math.ceil((representation.bandwidth / 8e6) * this.mediaPresentationDuration), // MB
        audioSamplingRate: representation.audioSamplingRate / 1000,
      };
      tracks.push(track);
    }

    return tracks;
  }

  getSubtitleTracks(languages) {
    const isSubtitleAdaptationSet = (adaptationSet) =>
      (adaptationSet.contentType === CONTENT_TYPE.text ||
        adaptationSet.mimeType?.includes('text')) &&
      !adaptationSet.maxWidth;
    const adaptationSets = this.periods
      .map((p) => p.adaptationSets)
      .flat(1)
      .filter(isSubtitleAdaptationSet);

    const representations = adaptationSets.map((a) => a.representations).flat(2);
    const matches = representations.filter((r) =>
      languages?.length ? languages?.some((lang) => r.lang.includes(lang)) : true
    );
    const selectedRepresentations = matches?.length ? matches : representations;

    const tracks = [];
    for (const representation of selectedRepresentations) {
      const adaptationSet = adaptationSets.find((a) => a.representations.includes(representation));
      const baseUrl = this.baseUrls?.[0]?.value;
      const representationBaseUrl = representation.baseUrls?.[0]?.value;
      const url = isUrl(representationBaseUrl)
        ? representationBaseUrl
        : `${baseUrl || ''}${representationBaseUrl || ''}`;
      const track = {
        id: tracks.length,
        type: CONTENT_TYPE.text,
        label: adaptationSet.label,
        language: adaptationSet.lang,
        format: representation.mimeType?.split('/')[1] || adaptationSet.mimeType?.split('/')[1],
        segments: [{ url }],
        bitrate: Math.round(representation.bandwidth / 1000), // Kbps
        size: Math.ceil((representation.bandwidth / 8e6) * this.mediaPresentationDuration), // MB
      };
      tracks.push(track);
    }

    return tracks;
  }

  getWidevinePssh(adaptationSet) {
    const isWidevineProtection = (protection) =>
      protection.schemeIdUri === KEY_SYSTEMS['com.widevine.alpha'];
    return adaptationSet?.contentProtections?.find(isWidevineProtection)?.cencPssh || null;
  }

  getWidevineLicenseUrl(adaptationSet) {
    const isWidevineProtection = (protection) =>
      protection.schemeIdUri === KEY_SYSTEMS['com.widevine.alpha'];
    return adaptationSet?.contentProtections?.find(isWidevineProtection)?.licenseUrl || null;
  }

  findBestRepresentation(representations) {
    const bandwidths = representations.map((r) => r.bandwidth);
    const maxBandwidth = Math.max(...bandwidths);
    return representations.find((r) => r.bandwidth === maxBandwidth);
  }

  getSegments(adaptationSet, representation) {
    const segments = [];
    const segmentTemplate = representation.segmentTemplate || adaptationSet.segmentTemplate;
    const baseUrls = representation.baseUrls || this.baseUrls;
    const isBaseUrlRequired = !segmentTemplate.media.includes(`https://`);
    const baseUrl = baseUrls?.map((url) => url.value)?.[0];
    const initTemplate = segmentTemplate.initialization;
    const initUrl = initTemplate
      ?.replace(/\$Bandwidth\$/i, representation.bandwidth)
      ?.replace(/\$RepresentationID\$/i, representation.id);
    const initFullUrl = isBaseUrlRequired ? baseUrl + initUrl : initUrl;
    if (initUrl) segments.push({ url: initFullUrl, init: true });

    const mediaTemplate = segmentTemplate.media.replace(/\$Bandwidth\$/i, representation.bandwidth);
    let time = 0;
    let index = parseInt(segmentTemplate.startNumber) || 0;

    if (!Array.isArray(segmentTemplate['SegmentTimeline']['S']))
      segmentTemplate['SegmentTimeline']['S'] = [segmentTemplate['SegmentTimeline']['S']];

    for (const segment of segmentTemplate['SegmentTimeline']['S']) {
      const repeats = parseInt(segment.r || '0') + 1;
      if (segment.t) time = parseInt(segment.t);
      const duration = parseInt(segment.d || segmentTemplate.timescale || '0');
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

  getPssh(schemeIdUri = KEY_SYSTEMS['com.widevine.alpha']) {
    let pssh = null;
    for (const period of this.periods)
      for (const adaptationSet of period.adaptationSets) {
        if (!adaptationSet.contentProtections) continue;
        for (const contentProtection of adaptationSet.contentProtections)
          if (contentProtection.cencPssh && contentProtection.schemeIdUri === schemeIdUri) {
            pssh = contentProtection.cencPssh;
            break;
          }
      }
    return pssh;
  }

  getLicenseUrl(schemeIdUri = KEY_SYSTEMS['com.widevine.alpha']) {
    let licenseUrl = null;
    for (const period of this.periods)
      for (const adaptationSet of period.adaptationSets) {
        if (!adaptationSet.contentProtections) continue;
        for (const contentProtection of adaptationSet.contentProtections)
          if (contentProtection.licenseUrl && contentProtection.schemeIdUri === schemeIdUri) {
            licenseUrl = contentProtection.licenseUrl;
            break;
          }
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
