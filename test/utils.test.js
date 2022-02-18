const { getQualityLabel } = require('../lib/utils');

test('lib/utils getQualityLabel', () => {
  expect(getQualityLabel(360)).toBe('SD');
  expect(getQualityLabel(480)).toBe('SD');
  expect(getQualityLabel(540)).toBe('SD');
  expect(getQualityLabel(576)).toBe('SD');
  expect(getQualityLabel(720)).toBe('HD');
  expect(getQualityLabel(1080)).toBe('Full HD');
  expect(getQualityLabel(2160)).toBe('4K');
  expect(getQualityLabel(4320)).toBe('8K');
  expect(getQualityLabel('360')).toBe('SD');
  expect(getQualityLabel('480')).toBe('SD');
  expect(getQualityLabel('540')).toBe('SD');
  expect(getQualityLabel('576')).toBe('SD');
  expect(getQualityLabel('720')).toBe('HD');
  expect(getQualityLabel('1080')).toBe('Full HD');
  expect(getQualityLabel('2160')).toBe('4K');
  expect(getQualityLabel('4320')).toBe('8K');
  expect(getQualityLabel('')).toBe(undefined);
  expect(getQualityLabel('abc')).toBe(undefined);
});
