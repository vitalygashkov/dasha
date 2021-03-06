const CONTENT_TYPE = {
  video: 'video',
  audio: 'audio',
  text: 'text',
  image: 'image',
  application: 'application',
};

const KEY_SYSTEMS = {
  'org.w3.clearkey': 'urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b',
  'com.widevine.alpha': 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
  'com.microsoft.playready': 'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95',
  'com.adobe.primetime': 'urn:uuid:f239e769-efa3-4850-9c16-a903c6932efb',
};

module.exports = { CONTENT_TYPE, KEY_SYSTEMS };
