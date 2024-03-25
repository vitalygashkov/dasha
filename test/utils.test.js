const { test } = require('node:test');
const { strictEqual } = require('node:assert');
const { getQualityLabel } = require('../dasha');

test('getQualityLabel', () => {
  strictEqual(getQualityLabel({ width: 1920, height: 1080 }), '1080p');
});
