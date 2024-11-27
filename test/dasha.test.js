const { test } = require('node:test');
const { strictEqual } = require('node:assert');
const { getQualityLabel } = require('../lib/util');
const { parse } = require('../dasha');
const { load } = require('./utils');

test('get video quality label', () => {
  strictEqual(getQualityLabel({ width: 1920, height: 804 }), '1080p');
});

const kionUrl =
  'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20230707/268697239/268697239.mpd';

test('DASH: parse with URL parameter', async () => {
  const url = kionUrl;
  const response = await fetch(url);
  const text = await response.text();
  const manifest = await parse(text, url);
  strictEqual(manifest.tracks.all.length, 5);
});

test('DASH: parse without URL parameter', async () => {
  const text = load('cr.mpd');
  const manifest = await parse(text);
  strictEqual(manifest.tracks.all.length, 8);
  const initUrl =
    'https://a-vrv.akamaized.net/evs3/8a1b3acce53d49eea0ce2104fae30046/assets/p/c46e06c5fd496e8aec0b6776b97eca3f_,3748583.mp4,3748584.mp4,3748582.mp4,3748580.mp4,3748581.mp4,.urlset/init-f2-v1-x3.mp4?t=exp=1713871228~acl=/evs3/8a1b3acce53d49eea0ce2104fae30046/assets/p/c46e06c5fd496e8aec0b6776b97eca3f_,3748583.mp4,3748584.mp4,3748582.mp4,3748580.mp4,3748581.mp4,.urlset/*~hmac=7dc7daeb338da040c65111a88cbf947505a5897f42d1c433c3858f8d890ed29c';
  strictEqual(manifest.tracks.videos[0].segments[0].url, initUrl);
});
