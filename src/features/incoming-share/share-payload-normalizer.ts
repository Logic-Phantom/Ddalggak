import { extractUrls, isHttpUrl, stripUrls } from '../extraction/url-utils';
import { ACCEPTED_FILE_MIME_TYPES, MAX_ITEMS_PER_SHARE, MAX_TEXT_LENGTH, mimeFromName } from './mime-validation';
import type { CaptureInput, NormalizedShare, RawSharePayload } from './types';

/** Shared files arrive as local URIs only (file:// from the iOS extension, content:// on Android). */
function isLocalUri(value: string): boolean {
  return /^(file|content):\/\//i.test(value);
}

function nameFromUri(uri: string): string | null {
  const last = uri.split(/[\\/]/).pop();
  if (!last) return null;
  try {
    return decodeURIComponent(last.split('?')[0]);
  } catch {
    return last;
  }
}

/**
 * Turns raw OS share payloads into capture inputs. Pure: no file access, no network.
 * Rejections carry a user-facing reason so the capture screen can explain what happened.
 */
export function normalizeSharePayloads(payloads: RawSharePayload[]): NormalizedShare {
  const inputs: CaptureInput[] = [];
  const rejected: NormalizedShare['rejected'] = [];
  const seen = new Set<string>();

  for (const p of payloads) {
    const value = (p.value ?? '').trim();
    if (!value) {
      rejected.push({ shareType: p.shareType, reason: 'share-empty' });
      continue;
    }
    const key = `${p.shareType}|${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (inputs.length >= MAX_ITEMS_PER_SHARE) {
      rejected.push({ shareType: p.shareType, reason: 'share-unsupported' });
      continue;
    }

    switch (p.shareType) {
      case 'url': {
        if (!isHttpUrl(value)) {
          rejected.push({ shareType: p.shareType, reason: 'share-unsupported' });
          break;
        }
        inputs.push({ kind: 'url', url: value, text: null, sourceType: 'shared-url' });
        break;
      }
      case 'text': {
        const text = value.slice(0, MAX_TEXT_LENGTH);
        const urls = extractUrls(text);
        if (urls.length) {
          // "URL only" shares keep no duplicate text; messages around a link keep their text.
          const rest = stripUrls(text);
          inputs.push({ kind: 'url', url: urls[0], text: rest ? text : null, sourceType: 'shared-url' });
        } else {
          inputs.push({ kind: 'text', text, sourceType: 'shared-text' });
        }
        break;
      }
      case 'image':
      case 'file': {
        if (!isLocalUri(value)) {
          rejected.push({ shareType: p.shareType, reason: 'share-unsupported' });
          break;
        }
        const name = nameFromUri(value);
        const declared = p.mimeType?.toLowerCase();
        // Some apps send image/* or octet-stream; fall back to the extension.
        const mimeType = declared && ACCEPTED_FILE_MIME_TYPES.includes(declared) ? declared : mimeFromName(name);
        if (!mimeType || !ACCEPTED_FILE_MIME_TYPES.includes(mimeType)) {
          rejected.push({ shareType: p.shareType, reason: 'share-unsupported' });
          break;
        }
        inputs.push({ kind: 'file', uri: value, mimeType, name, size: null, sourceType: mimeType.startsWith('image/') ? 'shared-image' : 'shared-document' });
        break;
      }
      default:
        rejected.push({ shareType: p.shareType, reason: 'share-unsupported' });
    }
  }

  return { inputs, rejected };
}
