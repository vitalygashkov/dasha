const { test } = require('node:test');
const { strictEqual } = require('node:assert');
const { readFileSync } = require('node:fs');
const { getQualityLabel } = require('../lib/util');
const { parse } = require('../dasha');

const load = (path) => readFileSync(path, 'utf8');

test('getQualityLabel', () => {
  strictEqual(getQualityLabel({ width: 1920, height: 1080 }), '1080p');
});

const kionUrl =
  'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20230707/268697239/268697239.mpd';
const kionUrl2 =
  'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/268725201.mpd';

test('DASH parsing', async () => {
  const url = kionUrl;
  const response = await fetch(url);
  const text = await response.text();
  const manifest = await parse(text, url);
  strictEqual(manifest.tracks.all.length, 5);
});
