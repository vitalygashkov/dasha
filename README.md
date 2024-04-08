# dasha

[![npm version](https://img.shields.io/npm/v/dasha?style=flat&color=white)](https://www.npmjs.com/package/dasha)
[![npm downloads/month](https://img.shields.io/npm/dm/dasha?style=flat&color=white)](https://www.npmjs.com/package/dasha)
[![npm downloads](https://img.shields.io/npm/dt/dasha?style=flat&color=white)](https://www.npmjs.com/package/dasha)

Library for parsing MPEG-DASH and HLS manifests. Made with the purpose of obtaining a simplified representation convenient for further downloading of segments.

## Install

```shell
npm i dasha
```

## Quick start

```js
import { parse } from 'dasha';

const url = 'https://dash.akamaized.net/dash264/TestCases/1a/sony/SNE_DASH_SD_CASE1A_REVISED.mpd';
const body = await fetch(url).then((res) => res.text());
const manifest = await parse(body, url);
```
