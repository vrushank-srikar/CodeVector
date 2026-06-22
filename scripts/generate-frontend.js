const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'index.html'),
  'utf8'
);

const js = `'use strict';
const HTML = ${JSON.stringify(html)};
module.exports = { getIndexHtml: () => HTML };
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'frontend.js'), js, 'utf8');
console.log('frontend.js generated:', js.length, 'bytes');
