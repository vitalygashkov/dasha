'use strict';

const m3u8Parser = require('m3u8-parser');

const parseM3u8 = (manifestString) => {
  const parser = new m3u8Parser.Parser();
  parser.push(manifestString);
  parser.end();
  const manifest = parser.manifest;
  return manifest;
};

const parseManifest = (body) => {
  const m3u8 = parseM3u8(body);
  return m3u8;
};

module.exports = { parseManifest };
