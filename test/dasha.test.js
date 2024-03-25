const { test } = require('node:test');
const { strictEqual } = require('node:assert');
const { getQualityLabel, parseMpd } = require('../dasha');
const { readFileSync } = require('node:fs');
const { parse } = require('../lib/xml-parser');

test('getQualityLabel', () => {
  strictEqual(getQualityLabel({ width: 1920, height: 1080 }), '1080p');
});

const iviMpdBody = readFileSync('./test/ivi.mpd', 'utf8');
const iviMpdUrl =
  'https://region.dfs.ivi.ru/jW1IJMiotdNBiHD4lSg9lP6hagbTPkSWIEwaCAAZ06jiyKhGIU4g50599/voddash-abrshq,4000/k5SE_TzrVR8MZwRunaX1ZQ,1711416086/storage4/contents/3/c/fb597d9676983b3c79d547dc082f70.ks/3438f09cad005bf5eae8b2fea20500c7.mpd';

test('parseMpd', () => {
  const manifest = parseMpd(iviMpdBody);
  // console.log(manifest);
  // strictEqual(getQualityLabel({ width: 1920, height: 1080 }), '1080p');
});
