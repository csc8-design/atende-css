import { describe, expect, it } from 'vitest';
import { getMediaType, validateMediaSize } from './chatMedia';

describe('chat attachments', () => {
  it('detects PDF without browser MIME', () => expect(getMediaType({ name: 'Catálogo.PDF', type: '' })).toEqual({ mime: 'application/pdf', kind: 'document' }));
  it('detects iPhone photos', () => expect(getMediaType({ name: 'foto.heic', type: '' }).kind).toBe('image'));
  it('accepts documents up to 100MB', () => { expect(() => validateMediaSize('document', 100 * 1024 * 1024)).not.toThrow(); expect(() => validateMediaSize('document', 100 * 1024 * 1024 + 1)).toThrow(); });
  it('enforces 5MB photo limit after conversion', () => expect(() => validateMediaSize('image', 5 * 1024 * 1024 + 1)).toThrow());
  it('enforces 16MB video limit', () => expect(() => validateMediaSize('video', 16 * 1024 * 1024 + 1)).toThrow());
  it('enforces 16MB audio limit', () => expect(() => validateMediaSize('audio', 16 * 1024 * 1024 + 1)).toThrow());
});