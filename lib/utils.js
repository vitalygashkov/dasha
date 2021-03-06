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

const getQualityLabel = (videoWidth) => {
  const width = typeof videoWidth === 'number' ? videoWidth : parseInt(videoWidth);
  if (isNaN(width)) return;
  let label = 'SD';
  if (width >= 1280) label = 'HD';
  if (width >= 1920) label = 'Full HD';
  if (width >= 3840) label = 'UHD';
  if (width >= 4096) label = '4K';
  if (width >= 7680) label = '8K';
  return label;
};

module.exports = { parseDuration, getQualityLabel };
