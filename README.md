# Dasha

[![npm version](https://img.shields.io/npm/v/dasha)](https://www.npmjs.com/package/dasha)
[![npm downloads/month](https://img.shields.io/npm/dm/dasha)](https://www.npmjs.com/package/dasha)
[![npm downloads](https://img.shields.io/npm/dt/dasha)](https://www.npmjs.com/package/dasha)
[![license](https://img.shields.io/npm/l/dasha)](https://github.com/vitnore/dasha/blob/main/LICENSE)

Dasha is a simple parser for MPD manifests.

## Usage

- Install: `npm install dasha`
- Require: `const { parseManifest } = require('dasha');`

```javascript
const { parseManifest } = require('./dasha');

const rawManifest = `
  <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <MPD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    ...
  </MPD>
`;
const manifest = parseManifest(rawManifest);
const targetHeight = 1080;
const targetAudioLanguages = ['rus'];
const videoTrack = manifest.getVideoTrack(targetHeight);
const audioTracks = manifest.getAudioTracks(targetAudioLanguages);
const tracks = [videoTrack, ...audioTracks];
```

```typescript
type VideoTrack = {
  type: 'video';
  segments: { url: string; init: boolean }[];
  bitrate: number; // Kbps
  size: number; // MB
  width: number;
  height: number;
  qualityLabel: '144p' | '240p' | '360p' | '480p' | '576p' | '720p' | '1080p' | '2160p';
};

type AudioTrack = {
  type: 'audio';
  segments: { url: string; init: boolean }[];
  bitrate: number; // Kbps
  size: number; // MB
  audioSampleRate: number; // kHz
};
```
