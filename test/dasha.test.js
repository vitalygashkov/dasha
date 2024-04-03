const { test } = require('node:test');
const { strictEqual } = require('node:assert');
const { readFileSync } = require('node:fs');
const { getQualityLabel } = require('../lib/util');
const { parse } = require('../dasha');

const load = (path) => readFileSync(path, 'utf8');

test('getQualityLabel', () => {
  strictEqual(getQualityLabel({ width: 1920, height: 1080 }), '1080p');
});

test('DASH parsing', async () => {
  const url =
    'https://bitmovin-a.akamaihd.net/content/MI201109210084_1/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd';
  const response = await fetch(url);
  const text = await response.text();
  const manifest = await parse(text, url);
  strictEqual(manifest.tracks.all.length, 7);
});
