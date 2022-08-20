/**
 * Parses an XML duration string.
 * @param {string} durationString The duration string, e.g., "PT1H3M43.2S",
 *   which means 1 hour, 3 minutes, and 43.2 seconds.
 * @return {?number} The parsed duration in seconds on success; otherwise,
 *   return null.
 * @see {@link http://www.datypic.com/sc/xsd/t-xsd_duration.html}
 */
const parseDuration = (durationString) => {
  if (!durationString) return null;

  const re =
    '^P(?:([0-9]*)Y)?(?:([0-9]*)M)?(?:([0-9]*)D)?' +
    '(?:T(?:([0-9]*)H)?(?:([0-9]*)M)?(?:([0-9.]*)S)?)?$';
  const matches = new RegExp(re).exec(durationString);
  if (!matches) return null;

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
};

const getHeightByWidth = (videoWidth) => {
  const width = typeof videoWidth === 'number' ? videoWidth : parseInt(videoWidth);
  if (isNaN(width)) return;
  let height = 144;
  if (width >= 426) height = 240;
  if (width >= 640) height = 360;
  if (width >= 854) height = 480;
  if (width >= 1024) height = 576;
  if (width >= 1280) height = 720;
  if (width >= 1920) height = 1080;
  if (width >= 3840) height = 2160;
  if (width >= 7680) height = 4320;
  return height;
};

const getQualityLabel = (videoWidth) => getHeightByWidth(videoWidth) + 'p';

module.exports = { parseDuration, getHeightByWidth, getQualityLabel };
