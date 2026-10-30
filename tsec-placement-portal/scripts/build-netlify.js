/**
 * Netlify build step: copy the chart library and fonts into public/,
 * because on Netlify the pages are served directly (not through server.js).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');

fs.mkdirSync(path.join(pub, 'vendor'), { recursive: true });
fs.copyFileSync(path.join(root, 'node_modules/chart.js/dist/chart.umd.min.js'), path.join(pub, 'vendor', 'chart.js'));

const fontsOut = path.join(pub, 'fonts');
fs.mkdirSync(fontsOut, { recursive: true });
for (const pkg of ['ibm-plex-sans', 'ibm-plex-mono']) {
  const dir = path.join(root, 'node_modules/@fontsource', pkg, 'files');
  for (const f of fs.readdirSync(dir)) fs.copyFileSync(path.join(dir, f), path.join(fontsOut, f));
}
console.log('Copied chart.js and fonts into public/ for Netlify.');
