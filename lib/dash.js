'use strict';

const { parseXml } = require('./xml');

const KEY_SYSTEMS = {
  'urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b': 'org.w3.clearkey',
  'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed': 'com.widevine.alpha',
  'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95': 'com.microsoft.playready',
  'urn:uuid:f239e769-efa3-4850-9c16-a903c6932efb': 'com.adobe.primetime',
};

const CONTENT_TYPE = {
  video: 'video',
  audio: 'audio',
  text: 'text',
  image: 'image',
  application: 'application',
};

class Dash {
  _manifest = {};

  constructor({ logger } = {}) {
    this.logger = logger || console;
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

  getTracks({ contentType, width, height, bandwidth, duration }) {
    const tracks = [];

    const adaptationSets = this._manifest.periods.map((p) => p.adaptationSets).flat(1);
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
    for (const period of this._manifest.periods)
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
    for (const period of this._manifest.periods)
      for (const adaptationSet of period.adaptationSets)
        for (const contentProtection of adaptationSet.contentProtections)
          if (contentProtection.licenseUrl) {
            licenseUrl = contentProtection.licenseUrl;
            break;
          }
    return licenseUrl;
  }

  parseManifest(data) {
    const xml = parseXml(data);
    const mpd = xml.MPD;
    return this.processManifest(mpd);
  }

  processManifest(mpd) {
    const periods = this._parseElement(mpd['Period'], 'array');
    if (!periods.length) {
      this.logger.error(`Invalid number of Period`);
      return null;
    }

    const parsedPeriods = periods.map((p) => this.parsePeriod(p));
    const baseUrls = this._parseElement(mpd['BaseURL'], 'array');
    const locations = this._parseElement(mpd['Location'], 'array');
    const profiles = mpd['profiles'];
    const mediaPresentationDuration = this._parseElement(
      mpd['mediaPresentationDuration'],
      'duration'
    );

    this._manifest = {
      periods: parsedPeriods,
      baseUrls,
      locations,
      profiles,
      mediaPresentationDuration,
    };

    return this._manifest;
  }

  parsePeriod(period) {
    const id = this._parseElement(period['id'], 'number');
    const start = this._parseElement(period['start'], 'duration');
    const duration = this._parseElement(period['duration'], 'duration');
    const adaptationSets = this._parseElement(period['AdaptationSet'], 'array');
    const parsedAdaptationSets = adaptationSets.map((a) => this.parseAdaptationSet(a));
    return { id, start, duration, adaptationSets: parsedAdaptationSets };
  }

  parseAdaptationSet(adaptationSet) {
    const id = this._parseElement(adaptationSet['id'], 'number');
    const group = this._parseElement(adaptationSet['group'], 'number');
    const baseUrls = this._parseElement(adaptationSet['BaseURL'], 'array');
    const segmentAlignment = adaptationSet['segmentAlignment'];
    const lang = adaptationSet['lang'];
    const maxWidth = this._parseElement(adaptationSet['maxWidth'], 'number');
    const maxHeight = this._parseElement(adaptationSet['maxHeight'], 'number');
    const maxFrameRate = adaptationSet['maxFrameRate'];
    const segmentTemplate = adaptationSet['SegmentTemplate'];
    const contentProtections = this._parseElement(adaptationSet['ContentProtection'], 'array');
    const parsedContentProtections = contentProtections.map((c) => this.parseContentProtection(c));
    const representations = this._parseElement(adaptationSet['Representation'], 'array');
    const parsedRepresentations = representations.map((r) => this.parseRepresentation(r));
    return {
      id,
      group,
      baseUrls,
      segmentAlignment,
      maxWidth,
      maxHeight,
      maxFrameRate,
      segmentTemplate,
      lang,
      contentProtections: parsedContentProtections,
      representations: parsedRepresentations,
    };
  }

  parseContentProtection(contentProtection) {
    const schemeIdUri = contentProtection['schemeIdUri'];
    const value = contentProtection['value'];
    const cencDefaultKid = contentProtection['cenc:default_KID'];
    const cencPssh = contentProtection['cenc:pssh']?.['value'];
    const msprPro = contentProtection['mspr:pro']?.['value'];
    const licenseUrl = contentProtection['ms:laurl']?.['licenseUrl'];
    return { schemeIdUri, value, cencDefaultKid, cencPssh, msprPro, licenseUrl };
  }

  parseRepresentation(representation) {
    const id = representation['id'];
    const baseUrls = this._parseElement(representation['BaseURL'], 'array');
    const codecs = representation['codecs'];
    const bandwidth = this._parseElement(representation['bandwidth'], 'number');
    const frameRate = representation['frameRate'];
    const mimeType = representation['mimeType'];
    const audioSamplingRate = this._parseElement(representation['audioSamplingRate'], 'number');
    const width = this._parseElement(representation['width'], 'number');
    const height = this._parseElement(representation['height'], 'number');
    const sar = representation['sar'];
    const startWithSAP = representation['startWithSAP'];
    return {
      id,
      baseUrls,
      codecs,
      bandwidth,
      frameRate,
      mimeType,
      audioSamplingRate,
      width,
      height,
      sar,
      startWithSAP,
    };
  }

  _parseElement(element, type) {
    if (!element) return;
    switch (type) {
      case 'array':
        return Array.isArray(element) ? element : [element];
      case 'number':
        return parseInt(element);
      case 'duration':
        return this.parseDuration(element);
      default:
        return element;
    }
  }

  /**
   * Parses an XML duration string.
   * @param {string} durationString The duration string, e.g., "PT1H3M43.2S",
   *   which means 1 hour, 3 minutes, and 43.2 seconds.
   * @return {?number} The parsed duration in seconds on success; otherwise,
   *   return null.
   * @see {@link http://www.datypic.com/sc/xsd/t-xsd_duration.html}
   */
  parseDuration(durationString) {
    if (!durationString) return null;

    const re =
      '^P(?:([0-9]*)Y)?(?:([0-9]*)M)?(?:([0-9]*)D)?' +
      '(?:T(?:([0-9]*)H)?(?:([0-9]*)M)?(?:([0-9.]*)S)?)?$';
    const matches = new RegExp(re).exec(durationString);

    if (!matches) {
      this.logger.warn('Invalid duration string:', durationString);
      return null;
    }

    // Note: Number(null) == 0 but Number(undefined) == NaN.
    const years = Number(matches[1] || null);
    const months = Number(matches[2] || null);
    const days = Number(matches[3] || null);
    const hours = Number(matches[4] || null);
    const minutes = Number(matches[5] || null);
    const seconds = Number(matches[6] || null);

    // Assume a year always has 365 days and a month always has 30 days.
    const d =
      60 * 60 * 24 * 365 * years +
      60 * 60 * 24 * 30 * months +
      60 * 60 * 24 * days +
      60 * 60 * hours +
      60 * minutes +
      seconds;
    return isFinite(d) ? d : null;
  }
}

module.exports = { Dash };
