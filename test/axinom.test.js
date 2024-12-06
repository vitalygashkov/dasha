const { test } = require('node:test');
const { strictEqual } = require('node:assert');
const { parse } = require('../dasha');
const { load } = require('./utils');

test('axinom manifest parsing', async () => {
  const url =
    'https://media.axprod.net/TestVectors/v7-MultiDRM-SingleKey/Manifest_1080p.mpd';
  const text = load('axinom.mpd');
  const manifest = await parse(text, url);

  const firstVideoTrack = manifest.tracks.videos[0];
  const firstVideoSegment = firstVideoTrack.segments[1]; // Skip init
  strictEqual(
    firstVideoSegment.url,
    'https://media.axprod.net/TestVectors/v7-MultiDRM-SingleKey/5/0001.m4s',
  );

  const firstSubtitleTrack = manifest.tracks.subtitles[0];
  strictEqual(firstSubtitleTrack.codec, 'WVTT');
  strictEqual(firstSubtitleTrack.language, 'en');

  strictEqual(manifest.tracks.all.length, 23);
});
