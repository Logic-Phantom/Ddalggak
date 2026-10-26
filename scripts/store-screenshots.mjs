// Seeds fictional data into the web preview and captures 1080x2160 (2:1) Play Store screenshots.
// Usage (web preview running on :8082, Google Chrome installed; puppeteer-core is not a project dependency):
//   npx expo start --web --port 8082
//   npm install --no-save puppeteer-core@24 && node scripts/store-screenshots.mjs docs/store/screenshots
// All sample text is fictional. The 알림 tab's web-only "no device notifications here" notice is hidden
// because Android builds never show it.
import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'http://localhost:8082';
const OUT = process.argv[2] ?? 'docs/store/screenshots';
const PROFILE = join(tmpdir(), 'ddalggak-store-shots-profile');
rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The web preview keeps SQLite in OPFS; a full reload must wait until the old page's worker
// releases its access handle, so leave the origin first.
let page;
let dbFail = false;
async function go(url) {
  for (let i = 0; i < 6; i++) {
    dbFail = false;
    await page.goto('about:blank');
    await sleep(2500);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await sleep(1500);
    if (!dbFail) return;
    console.log('db locked, retry', url);
  }
  throw new Error('db stayed locked');
}
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  userDataDir: PROFILE,
  args: ['--lang=ko-KR', '--force-color-profile=srgb'],
});
page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
await page.setViewport({ width: 360, height: 720, deviceScaleFactor: 3, isMobile: true, hasTouch: false });
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.text().includes('db.open')) dbFail = true; if (['warn', 'error'].includes(m.type())) console.log('console.' + m.type(), m.text().slice(0, 300)); });

async function clickText(text, { exact = true, nth = 0 } = {}) {
  const handle = await page.evaluateHandle(
    (text, exact, nth) => {
      const els = [...document.querySelectorAll('[role="button"],[role="tab"],[role="link"],[role="radio"],button,a')].filter((e) => {
        const t = (e.getAttribute('aria-label') || e.textContent || '').replace(/[\uE000-\uF8FF]/g, '').trim();
        return (exact ? t === text : t.includes(text)) && e.getBoundingClientRect().width > 0;
      });
      return els[nth] ?? null;
    },
    text,
    exact,
    nth,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`not found: ${text}`);
  await el.scrollIntoView();
  await sleep(150);
  await el.click();
  await sleep(600);
}
const waitPath = (p) => page.waitForFunction((p) => location.pathname.startsWith(p), { timeout: 6000 }, p);
async function shot(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(900);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

async function analyze() {
  for (let i = 0; i < 5; i++) {
    await page.click('[data-testid="analyze"]').catch(() => {});
    try {
      await waitPath('/capture/review');
      return;
    } catch {}
  }
  await page.screenshot({ path: `${OUT}/fail.png` });
  throw new Error('analyze did not navigate');
}

async function addItem(text, { confirmAll = true } = {}) {
  await go(`${BASE}/capture`);
  await page.waitForSelector('[data-testid="capture-text"]');
  await page.type('[data-testid="capture-text"]', text);
  await sleep(300);
  await analyze();
  await sleep(1500);
  if (confirmAll) {
    const ids = await page.$$eval('[data-testid^="confirm-"]', (els) => els.map((e) => e.getAttribute('data-testid')));
    for (const id of ids) {
      const el = await page.$(`[data-testid="${id}"]`);
      await el.scrollIntoView();
      await sleep(150);
      await el.click();
      await sleep(500);
    }
    console.log('confirmed', ids.length);
  }
  await page.click('[data-testid="save-item"]');
  await waitPath('/item/');
  await sleep(1200);
  return page.url().replace(/\?.*$/, '');
}

async function addReminder(itemUrl, offsetLabel) {
  await go(itemUrl);
  await sleep(1500);
  await page.click('[data-testid="add-reminder"]');
  await sleep(800);
  await clickText(offsetLabel);
  await clickText('알림 만들기');
  await sleep(1000);
}

// First run: onboarding.
await go(BASE);
await page.waitForSelector('[data-testid="onboarding-start"]', { timeout: 30000 });
await sleep(1000);
await page.click('[data-testid="onboarding-start"]');
await sleep(1500);

await addItem('치과 정기검진 예약\n11월 14일 오전 10시 30분');
await addItem('https://shop.example.com/products/winter-coat\n겨울 울 코트 89,000원 주문번호 20261024-1187\n배송 완료 후 7일 이내 반품 가능');
const fest = await addItem('가을 재즈 페스티벌 입장권\n2026년 11월 8일 오후 5시 입장\n티켓번호 T-58213\n서울 마포구 양화로 12');
const coupon = await addItem('[모바일 쿠폰] 아메리카노 1잔\n쿠폰번호 KCAF-2611-0583\n유효기간 2026.11.05까지');
const dinner = await addItem('딸깍식당 예약이 확정되었어요.\n일시: 11월 2일 저녁 7시, 4명\n예약번호 R20261102');
await addReminder(dinner, '하루 전');
await addReminder(fest, '3일 전');
await addReminder(coupon, '하루 전');

// 01 home
await go(BASE);
await sleep(2000);
await shot('01-home');

// 02 capture with text typed (category preview)
await go(`${BASE}/capture`);
await page.waitForSelector('[data-testid="capture-text"]');
await page.type('[data-testid="capture-text"]', '[공연 예매 완료] 뮤지컬 〈딸깍〉\n2026년 11월 21일 오후 2시\n예매번호 M4471209\n좌석 R석 12열 8번');
await sleep(800);
await shot('02-capture');

// 03 review screen (not saved: leave as draft, it is cleaned up later)
await analyze();
await sleep(1800);
await shot('03-review');

// 04 coupon detail (code masked by default)
await go(coupon);
await sleep(1800);
await shot('04-detail');

// 05 reminders tab — hide the web-preview-only "no device notifications here" notice
await go(`${BASE}/reminders`);
await sleep(1800);
await page.evaluate(() => {
  const clean = (e) => e.textContent.replace(/[\uE000-\uF8FF]/g, '').trim();
  const msg = [...document.querySelectorAll('div')].find((d) => clean(d).startsWith('이 실행 환경에서는 기기 알림을') && clean(d).length < 80);
  let box = msg;
  while (box && box.parentElement && clean(box.parentElement) === clean(box)) box = box.parentElement;
  if (box) box.style.display = 'none';
});
await shot('05-reminders');

// 06 library
await go(`${BASE}/library`);
await sleep(1800);
await shot('06-library');

// 07 privacy (local-only promise)
await go(`${BASE}/me`);
await sleep(1800);
await shot('07-me');

await browser.close();
