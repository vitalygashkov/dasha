'use strict';

const parseMimes = (codecs) =>
  codecs
    .toLowerCase()
    .split(',')
    .map((codec) => codec.trim().split('.')[0]);

const createTrack = ({ url, language, id }) => {};

module.exports = { parseMimes };
