# Dasha

Dasha is a simple parser for MPD manifests.

## Installing

**Requirements**

- [Node.js](https://nodejs.org) v16 or greater
- npm v8

**Install dependencies**

```bash
npm i
```

## Usage examples

**Parse manifest and get tracks with selected video height**

```javascript
const { parseManifest } = require('./dasha');

const rawManifest = `
  <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <MPD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    ...
  </MPD>
`
const manifest = parseManifest(rawManifest);
const targetHeight = 1080;
const targetAudioLanguages = ['rus']
const videoTrack = manifest.getVideoTrack(targetHeight);
const audioTracks = manifest.getAudioTracks(targetAudioLanguages);
const tracks = [videoTrack, ...audioTracks];
```

**Tracks structure**

```typescript
type VideoTrack = {
  type: "video",
  segments: { url: string, init: boolean }[],
  bitrate: number, // Kbps
  size: number, // MB
  width: number,
  height: number,
  quality: "SD" | "HD" | "Full HD",
}

type AudioTrack = {
  type: "audio",
  segments: { url: string, init: boolean }[],
  bitrate: number, // Kbps
  size: number, // MB
  audioSampleRate: number // kHz
}
```
