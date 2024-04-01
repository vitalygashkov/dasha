'use strict';

const dash = require('./lib/dash');
const hls = require('./lib/hls');

const parse = (text, url) => {
  if (text.includes('<MPD')) return dash.parseManifest(text, url);
  else if (text.includes('#EXTM3U')) return hls.parseManifest(text, url);
  else throw new Error('Invalid manifest');
};

module.exports = { parse };
