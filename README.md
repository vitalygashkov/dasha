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
const { Dash } = require('./dasha');

const rawManifest = `
  <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <MPD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    ...
  </MPD>
`
const dash = new Dash();
dash.parseManifest(rawManifest);

const height = 1080;
const duration = 1438;
const videoTracks = dash.getTracks({ contentType: 'video', height, duration });
const audioTracks = dash.getTracks({ contentType: 'audio', height, duration });
const tracks = [...videoTracks, ...audioTracks];
```

**Track structure**

```typescript
type Track = {
  type: "audio" | "video",
  segments: { url: string, init: boolean }[],
  bitrate: number, // Kbps
  size: number | null, // MB
  width: number | null,
  height: number | null,
  quality: "SD" | "HD" | "Full HD" | null,
  audioSampleRate: number | null // kHz
}
```
