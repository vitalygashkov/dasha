const { test } = require('node:test');
const { strictEqual } = require('node:assert');
const { parse } = require('../dasha');
const { load } = require('./utils');

test('axinom manifest parsing', async () => {
  const url =
    'https://media.axprod.net/TestVectors/v7-MultiDRM-SingleKey/Manifest_1080p.mpd';
  const text = load('axinom.mpd');
  const manifest = await parse(text, url);
  strictEqual(manifest.tracks.all.length, 1);
});
