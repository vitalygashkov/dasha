const { test } = require('node:test');
const { strictEqual } = require('node:assert');
const { readFileSync } = require('node:fs');
const { getQualityLabel, parse } = require('../dasha');

test('getQualityLabel', () => {
  strictEqual(getQualityLabel({ width: 1920, height: 1080 }), '1080p');
});

const kionMpdBody = readFileSync('./test/kion.mpd', 'utf8');
const kionMpdUrl =
  'https://htv-mag2-moscow2.mts.ru/htv-rrs.mts.ru/88888888/16/20230707/268697239/268697239.mpd';

test('DASH parsing', () => {
  const manifest = parse(kionMpdBody, kionMpdUrl);
});
