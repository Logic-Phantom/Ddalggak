// Renders the Google Play feature graphic (1024x500, no alpha) from an HTML layout with headless Chrome.
// Uses the app icon (assets/images/splash-icon.png), Pretendard and Ionicons from node_modules — no external assets.
// Usage: npm install --no-save puppeteer-core@24 && node scripts/store-feature-graphic.mjs
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'docs/store/assets/feature-graphic-1024x500.png');
const b64 = (p) => readFileSync(join(ROOT, p)).toString('base64');
const ICONS = 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons';
const glyphs = JSON.parse(readFileSync(join(ROOT, ICONS, 'glyphmaps/Ionicons.json'), 'utf8'));
const glyph = (name) => `&#${glyphs[name]};`;

// Category tile tones match src/design-system/tokens.ts (categoryTones.light).
const tiles = [
  { icon: 'link', bg: '#E3F4EA', fg: '#1F8A55', x: 88, y: 92, r: -8 },
  { icon: 'calendar', bg: '#E4EEFB', fg: '#2B63B8', x: 352, y: 96, r: 8 },
  { icon: 'ticket', bg: '#EFE8FB', fg: '#6B47B8', x: 44, y: 252, r: -12 },
  { icon: 'image', bg: '#FBF3DC', fg: '#C2841C', x: 362, y: 276, r: 10 },
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: P; src: url(data:font/otf;base64,${b64('assets/fonts/Pretendard-Bold.otf')}); font-weight: 700; }
@font-face { font-family: P; src: url(data:font/otf;base64,${b64('assets/fonts/Pretendard-SemiBold.otf')}); font-weight: 600; }
@font-face { font-family: P; src: url(data:font/otf;base64,${b64('assets/fonts/Pretendard-Regular.otf')}); font-weight: 400; }
@font-face { font-family: I; src: url(data:font/ttf;base64,${b64(`${ICONS}/Fonts/Ionicons.ttf`)}); }
* { margin: 0; box-sizing: border-box; }
body { width: 1024px; height: 500px; overflow: hidden; font-family: P; position: relative;
  background: radial-gradient(circle at 20% 30%, #F2FBF7 0, #FAFCFB 45%, #F6FAF8 100%); }
.blob { position: absolute; border-radius: 50%; background: #E3F5EE; opacity: .7; }
.orbit { position: absolute; left: 70px; top: 150px; width: 400px; height: 190px; border: 2px solid #BFE3D6; border-radius: 50%; transform: rotate(-22deg); }
.icon { position: absolute; left: 150px; top: 130px; width: 210px; height: 210px; border-radius: 50px;
  box-shadow: 0 24px 48px rgba(23, 74, 64, .28); }
.tile { position: absolute; width: 78px; height: 78px; border-radius: 22px; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10px 24px rgba(31, 91, 79, .12); border: 1px solid rgba(255,255,255,.8); }
.tile span { font-family: I; font-size: 38px; }
.text { position: absolute; left: 510px; top: 112px; }
h1 { font-size: 112px; line-height: 1; color: #1F5B4F; letter-spacing: -4px; display: inline; }
.en { font-size: 40px; font-weight: 600; color: #4CAB94; margin-left: 18px; }
h2 { margin-top: 30px; font-size: 40px; font-weight: 700; color: #15211D; letter-spacing: -1px; }
h2 i { font-style: normal; color: #4CAB94; }
p { margin-top: 22px; font-size: 24px; font-weight: 400; line-height: 1.55; color: #53625D; }
</style></head><body>
<div class="blob" style="left:-90px;top:-120px;width:300px;height:300px"></div>
<div class="blob" style="right:-110px;bottom:-140px;width:320px;height:320px"></div>
<div class="orbit"></div>
<img class="icon" src="data:image/png;base64,${b64('assets/images/splash-icon.png')}">
${tiles.map((t) => `<div class="tile" style="left:${t.x}px;top:${t.y}px;background:${t.bg};transform:rotate(${t.r}deg)"><span style="color:${t.fg}">${glyph(t.icon)}</span></div>`).join('')}
<div class="text">
  <h1>킵온</h1><span class="en">KeepOn</span>
  <h2>저장한 정보, 놓치지 않게<i>.</i></h2>
  <p>공유하면 모이고, 기한은 알림으로<br>로그인 없이 기기 안에만 저장</p>
</div>
</body></html>`;

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: OUT, type: 'png', omitBackground: false });
await browser.close();
console.log(`feature graphic written to ${OUT}`);
