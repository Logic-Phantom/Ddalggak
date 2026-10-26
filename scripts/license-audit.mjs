// Builds the open source notice list (src/generated/oss-licenses.json, shown in the app) and audits licenses.
//
// Which packages ship: every node_modules package that appears in the exported JS bundle's source map,
// plus every direct runtime dependency in package.json (native modules are linked even when little JS
// reaches the bundle). Build-only tooling (Babel, Metro, CLI) is not shipped and not listed.
//
// Usage:
//   npx expo export --platform android --source-maps --output-dir <dir>
//   node scripts/license-audit.mjs <dir>/_expo/static/js/android/<entry>.map
// Exits 1 when a shipped package has a license outside ALLOWED (review it before release).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'src/generated/oss-licenses.json');
const ALLOWED = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'Unlicense', 'CC0-1.0', 'BlueOak-1.0.0', 'OFL-1.1', 'Python-2.0']);

const mapPath = process.argv[2];
if (!mapPath) {
  console.error('usage: node scripts/license-audit.mjs <bundle source map>');
  process.exit(2);
}

/** "node_modules/a/node_modules/@s/b/lib/x.js" → "node_modules/a/node_modules/@s/b" (deepest package dir). */
function packageDir(source) {
  const norm = source.replace(/\\/g, '/');
  const i = norm.lastIndexOf('node_modules/');
  if (i < 0) return null;
  const rest = norm.slice(i + 'node_modules/'.length).split('/');
  const name = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
  return { name, rel: `${norm.slice(norm.indexOf('node_modules/'), i)}node_modules/${name}` };
}

const dirs = new Map(); // rel dir → name
const map = JSON.parse(readFileSync(mapPath, 'utf8'));
for (const s of map.sources ?? []) {
  const p = packageDir(s);
  if (p) dirs.set(p.rel, p.name);
}
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
for (const name of Object.keys(pkg.dependencies)) dirs.set(`node_modules/${name}`, name);

/** Every allowed license must appear in the expression; an OR needs only one allowed side. */
function isAllowed(expr) {
  const e = expr.replace(/[()]/g, '').trim();
  if (e.includes(' OR ')) return e.split(' OR ').some((x) => isAllowed(x));
  return e.split(' AND ').every((x) => ALLOWED.has(x.trim()));
}

function licenseOf(meta) {
  if (typeof meta.license === 'string') return meta.license;
  if (meta.license?.type) return meta.license.type;
  if (Array.isArray(meta.licenses)) return meta.licenses.map((l) => l.type ?? l).join(' OR ');
  return 'UNKNOWN';
}

const COPYRIGHT_RE = /^\s*(copyright\b|\(c\)|©)/i;
const texts = new Map(); // hash → text
const packages = [];
const problems = [];

for (const [rel, name] of dirs) {
  const dir = join(ROOT, rel);
  const pj = join(dir, 'package.json');
  if (!existsSync(pj)) continue;
  const meta = JSON.parse(readFileSync(pj, 'utf8'));
  if (meta.name !== name) continue; // nested package.json inside a package (e.g. lib/package.json)
  const license = licenseOf(meta);
  const file = readdirSync(dir).find((f) => /^(licen[sc]e|copying)(\.(md|txt))?$/i.test(f));
  let copyright = [];
  let textId = null;
  if (file) {
    const raw = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n').trim();
    const lines = raw.split('\n');
    copyright = Array.from(new Set(lines.filter((l) => COPYRIGHT_RE.test(l)).map((l) => l.trim()))).slice(0, 4);
    // Copyright lines are listed per package; the shared remainder is stored once.
    const body = lines.filter((l) => !COPYRIGHT_RE.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    textId = createHash('sha1').update(body).digest('hex').slice(0, 10);
    if (!texts.has(textId)) texts.set(textId, body);
  }
  if (!copyright.length) {
    // Monorepo packages often ship without a LICENSE file; credit the declared author (or Meta for RN/Metro).
    const author = typeof meta.author === 'string' ? meta.author.replace(/\s*<.*$/, '') : meta.author?.name;
    const repo = JSON.stringify(meta.repository ?? '');
    if (author) copyright = [`Copyright (c) ${author}`];
    else if (/(facebook|react)\/(react-native|metro)\b/.test(repo)) copyright = ['Copyright (c) Meta Platforms, Inc. and affiliates.'];
  }
  if (!isAllowed(license)) problems.push(`${name}@${meta.version}: ${license}`);
  packages.push({ name, version: meta.version, license, copyright, textId });
}

// Same package can ship in two nested copies of one version; keep one entry per name@version.
const unique = Array.from(new Map(packages.map((p) => [`${p.name}@${p.version}`, p])).values()).sort((a, b) => a.name.localeCompare(b.name));
// MIT packages without a LICENSE file get the most common MIT text (the terms are identical).
const mitCounts = {};
for (const p of unique) if (p.license === 'MIT' && p.textId) mitCounts[p.textId] = (mitCounts[p.textId] ?? 0) + 1;
const mitText = Object.entries(mitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
for (const p of unique) if (!p.textId && p.license === 'MIT') p.textId = mitText;
// Bundled assets that are not npm packages.
const fontLicense = readFileSync(join(ROOT, 'assets/fonts/Pretendard-OFL.txt'), 'utf8').replace(/\r\n/g, '\n').trim();
const fontLines = fontLicense.split('\n');
const fontTextId = createHash('sha1').update(fontLicense).digest('hex').slice(0, 10);
texts.set(fontTextId, fontLines.filter((l) => !COPYRIGHT_RE.test(l)).join('\n').trim());
unique.push({ name: 'Pretendard (font)', version: '', license: 'OFL-1.1', copyright: fontLines.filter((l) => COPYRIGHT_RE.test(l)).map((l) => l.trim()).slice(0, 4), textId: fontTextId });
const usedTexts = new Set(unique.map((p) => p.textId).filter(Boolean));
const out = {
  note: 'Generated by scripts/license-audit.mjs — do not edit by hand.',
  packages: unique,
  texts: Object.fromEntries(Array.from(texts).filter(([id]) => usedTexts.has(id))),
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out)}\n`);

const counts = {};
for (const p of unique) counts[p.license] = (counts[p.license] ?? 0) + 1;
console.log(`${unique.length} shipped packages, ${usedTexts.size} distinct license texts → ${OUT}`);
console.log(counts);
const missing = unique.filter((p) => !p.textId).map((p) => `${p.name}@${p.version}`);
if (missing.length) console.log(`no license file (license field only): ${missing.join(', ')}`);
if (problems.length) {
  console.error(`review needed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
