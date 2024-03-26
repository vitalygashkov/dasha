'use strict';

const dash = require('./lib/dash');
const hls = require('./lib/hls');

const parse = (body, url) => {
  if (body.includes('<MPD')) return dash.parseManifest(body, url);
  else if (body.includes('#EXTM3U')) return hls.parseManifest(body, url);
  else throw new Error('Invalid manifest');
};

module.exports = { parse };
