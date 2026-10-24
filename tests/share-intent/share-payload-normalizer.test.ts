import { checkFile, sanitizeFileName, sniffMime } from '@/features/incoming-share/mime-validation';
import { normalizeSharePayloads } from '@/features/incoming-share/share-payload-normalizer';

describe('share payload normalizer', () => {
  it('turns a shared URL into a url input', () => {
    const r = normalizeSharePayloads([{ shareType: 'url', value: 'https://map.naver.com/p/1' }]);
    expect(r.inputs).toEqual([{ kind: 'url', url: 'https://map.naver.com/p/1', text: null, sourceType: 'shared-url' }]);
  });

  it('keeps chat text around a link but drops text that is only the link', () => {
    const withText = normalizeSharePayloads([{ shareType: 'text', value: '여기 맛집 https://naver.me/abc 주말에 가자' }]);
    expect(withText.inputs[0]).toMatchObject({ kind: 'url', url: 'https://naver.me/abc', text: '여기 맛집 https://naver.me/abc 주말에 가자' });
    const onlyLink = normalizeSharePayloads([{ shareType: 'text', value: 'https://naver.me/abc' }]);
    expect(onlyLink.inputs[0]).toMatchObject({ kind: 'url', text: null });
  });

  it('keeps plain text', () => {
    expect(normalizeSharePayloads([{ shareType: 'text', value: ' 내일 7시 예약 ' }]).inputs[0]).toEqual({ kind: 'text', text: '내일 7시 예약', sourceType: 'shared-text' });
  });

  it('accepts local image/PDF URIs and resolves the type from the extension when needed', () => {
    const r = normalizeSharePayloads([
      { shareType: 'image', value: 'content://media/external/images/1/IMG_1.jpg', mimeType: 'image/*' },
      { shareType: 'file', value: 'file:///group/share/%EC%98%81%EC%88%98%EC%A6%9D.pdf', mimeType: 'application/pdf' },
    ]);
    expect(r.inputs).toEqual([
      { kind: 'file', uri: 'content://media/external/images/1/IMG_1.jpg', mimeType: 'image/jpeg', name: 'IMG_1.jpg', size: null, sourceType: 'shared-image' },
      { kind: 'file', uri: 'file:///group/share/%EC%98%81%EC%88%98%EC%A6%9D.pdf', mimeType: 'application/pdf', name: '영수증.pdf', size: null, sourceType: 'shared-document' },
    ]);
  });

  it('rejects empty, remote, video/audio and non-http payloads with a reason', () => {
    const r = normalizeSharePayloads([
      { shareType: 'text', value: '   ' },
      { shareType: 'image', value: 'https://evil.example/x.jpg' },
      { shareType: 'video', value: 'file:///a.mp4' },
      { shareType: 'url', value: 'javascript:alert(1)' },
      { shareType: 'file', value: 'file:///a.zip', mimeType: 'application/zip' },
    ]);
    expect(r.inputs).toHaveLength(0);
    expect(r.rejected.map((x) => x.reason)).toEqual(['share-empty', 'share-unsupported', 'share-unsupported', 'share-unsupported', 'share-unsupported']);
  });

  it('drops exact duplicates and caps the number of items', () => {
    const dup = normalizeSharePayloads([
      { shareType: 'url', value: 'https://a.com' },
      { shareType: 'url', value: 'https://a.com' },
    ]);
    expect(dup.inputs).toHaveLength(1);
    const many = normalizeSharePayloads(Array.from({ length: 12 }, (_, i) => ({ shareType: 'image' as const, value: `file:///p/${i}.png` })));
    expect(many.inputs).toHaveLength(10);
    expect(many.rejected).toHaveLength(2);
  });
});

describe('mime validation', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const pdf = new TextEncoder().encode('%PDF-1.7');
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it('sniffs real file headers', () => {
    expect(sniffMime(jpeg)).toBe('image/jpeg');
    expect(sniffMime(pdf)).toBe('application/pdf');
    expect(sniffMime(png)).toBe('image/png');
    expect(sniffMime(new TextEncoder().encode('PK\u0003\u0004'))).toBeNull();
  });

  it('rejects oversized files, unknown types and renamed files', () => {
    expect(checkFile({ mimeType: 'image/jpeg', size: 30 * 1024 * 1024 })).toEqual({ ok: false, code: 'file-too-large' });
    expect(checkFile({ mimeType: 'application/zip' })).toEqual({ ok: false, code: 'share-unsupported' });
    expect(checkFile({ mimeType: 'application/pdf', head: jpeg })).toEqual({ ok: false, code: 'file-type-mismatch' });
    expect(checkFile({ mimeType: 'image/png', head: jpeg })).toEqual({ ok: true, mimeType: 'image/jpeg' });
    expect(checkFile({ name: 'scan.PDF', head: pdf })).toEqual({ ok: true, mimeType: 'application/pdf' });
  });

  it('sanitizes file names against path traversal', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('..\\..\\a<b>.jpg')).toBe('ab.jpg');
    expect(sanitizeFileName('...')).toBe('file');
    expect(sanitizeFileName(null)).toBe('file');
  });
});
