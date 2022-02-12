'use strict';

const PREFIX_LINE_PATTERN = /\s*(<\/?[^>]+>)/;
const TAG_ATTR_PATTERN = /\s*(?:<\/?([^\s>]+))?\s*([^>]+)*(?:\/?>)?/;
const ATTR_PAIR_PATTERN = /\s*([^=]+)="([^"]+)"/g;

const getTagList = (xmlString) => {
  const list = xmlString.split(PREFIX_LINE_PATTERN).filter(Boolean);
  if (list[0].startsWith(`<?xml`)) list.splice(0, 1);
  return list;
};

const parseTag = (tagString) => {
  const match = tagString.match(TAG_ATTR_PATTERN);
  if (!match) return null;

  const tagNameWithBrackets = match[0];
  const tagName = match[1];
  const tagAttributes = match[2];

  const isClosedTag = /^<\//.test(tagNameWithBrackets);
  const isNormalTag = /^</.test(tagNameWithBrackets);

  // const formattedTagName = formatTagName(tagName);

  const tag = {
    tagName,
  };

  // <TagName xx=xx xxx=xxx>
  // <TagName xx=xxx xx=xxx />
  if (tagName && tagAttributes) {
    const isSelfClosed = /\/$/.test(tagAttributes);
    const attrs = {};
    let currentAttribute = ATTR_PAIR_PATTERN.exec(tagAttributes);
    while (currentAttribute !== null) {
      const [rawAttribute, attributeName, attributeValue] = currentAttribute;
      attrs[attributeName] = attributeValue;
      currentAttribute = ATTR_PAIR_PATTERN.exec(tagAttributes);
    }
    tag.attrs = attrs;
    tag.closed = isSelfClosed;
    return tag;
  }

  // </TagName>
  if (isClosedTag) {
    tag.closed = true;
    return tag;
  }

  // <TagName>
  if (isNormalTag) {
    tag.attrs = {};
    return tag;
  }

  // pure value
  tag.tagName = 'pureValue';
  tag.attrs = { value: tagAttributes };
  tag.closed = true;
  return tag;
};

const mergeTags = (tagList) => {
  const stack = [];
  let last;
  let lastPre;

  for (const tag of tagList) {
    // start tag
    if (!tag.closed) {
      stack.push(tag);
      continue;
    }

    last = stack.pop();

    if (tag.tagName === 'pureValue') {
      last.attrs ? (last.attrs.value = tag.attrs.value) : (last.attrs = tag.attrs);
      stack.push(last);
      continue;
    }

    if (last && last.tagName === tag.tagName) {
      lastPre = stack.pop();
    } else {
      // self closed tag
      lastPre = last;
      last = tag;
    }

    if (!lastPre) {
      stack.push(last);
      break;
    }

    const { tagName } = last;
    let { attrs } = last;
    const prop = lastPre.attrs[tagName];

    if (prop) {
      lastPre.attrs[tagName] = Array.isArray(prop) ? prop.concat(attrs) : [prop, attrs];
    } else {
      lastPre.attrs[tagName] = attrs;
    }
    stack.push(lastPre);
  }

  const firstTag = stack[0];

  if (!firstTag) return null;
  if (firstTag.tagName !== undefined) return { [firstTag.tagName]: firstTag.attrs };

  return firstTag.tagName;
};

const parseXml = (text) => {
  if (!text) return { error: 1, message: 'invalid input' };
  try {
    const rawTags = getTagList(text);
    const parsedTags = rawTags.map((tag) => parseTag(tag)).filter(Boolean);
    const mergedTags = mergeTags(parsedTags);
    return mergedTags;
  } catch (e) {
    return { error: 1, message: e.message };
  }
};

module.exports = { parseXml };
