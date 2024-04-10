'use strict';

const { getWidth, getBestTrack } = require('./util');

const parseMimes = (codecs) =>
  codecs
    .toLowerCase()
    .split(',')
    .map((codec) => codec.trim().split('.')[0]);

const createResolutionFilter = (videos) => {
  return ({ width, height }) => {
    return videos.filter(
      (track) => (!width || track.width === width) && (!height || track.height === height)
    );
  };
};

const createVideoQualityFilter = (videos) => {
  return (quality) => {
    const height = parseInt(quality);
    const matchHeight = (track) => {
      if (!height) return false;
      const trackWidth = track.width;
      const targetWidth = getWidth(height);
      if (!trackWidth || !targetWidth) return false;
      return trackWidth === targetWidth;
    };
    const matches = videos.filter(matchHeight);
    return matches.length ? matches : [getBestTrack(videos)];
  };
};

const createAudioLanguageFilter = (audios) => {
  return (languages) => {
    if (!languages.length) return audios;
    return audios.filter((track) =>
      languages.some((language) => track.language?.startsWith(language))
    );
  };
};

const createSubtitleLanguageFilter = (subtitles) => {
  return (languages) => {
    if (!languages.length) return subtitles;
    return subtitles.filter((track) =>
      languages.some(
        (language) => track.language?.startsWith(language) || track.label?.startsWith(language)
      )
    );
  };
};

module.exports = {
  parseMimes,
  createResolutionFilter,
  createVideoQualityFilter,
  createAudioLanguageFilter,
  createSubtitleLanguageFilter,
};
