const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const load = (filename) => readFileSync(join('./test', filename), 'utf8');

module.exports = { load };
