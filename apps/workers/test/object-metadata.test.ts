import { describe, expect, it } from 'vitest';
import { normalizeAndValidateObjectMetadata } from '../src/object-metadata.js';

describe('object metadata normalization', () => {
  it('normalizes valid metadata name and permissions', () => {
    const result = normalizeAndValidateObjectMetadata({
      name: '  North   Gate  ',
      permissions: {
        'user-1': 'builder',
        ' user-2 ': 'viewer',
        'bad id': 'builder',
        'user-3': 'admin',
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.metadata).toEqual({
      name: 'North Gate',
      permissions: {
        'user-1': 'builder',
        'user-2': 'viewer',
      },
    });
  });

  it('rejects names containing links', () => {
    const result = normalizeAndValidateObjectMetadata({
      name: 'visit https://example.com now',
    });

    expect(result.error).toEqual({
      code: 'OBJECT_NAME_MODERATION_BLOCKED',
      message: 'Object name cannot contain links.',
    });
  });

  it('rejects names containing angle brackets', () => {
    const result = normalizeAndValidateObjectMetadata({
      name: 'Gate <A>',
    });

    expect(result.error).toEqual({
      code: 'OBJECT_NAME_INVALID',
      message: 'Object name cannot include angle brackets.',
    });
  });

  it('normalizes a valid model key', () => {
    const result = normalizeAndValidateObjectMetadata({
      model_key: '  Beacon-Prime_01  ',
    });

    expect(result.error).toBeUndefined();
    expect(result.metadata).toEqual({
      model_key: 'beacon-prime_01',
    });
  });

  it('rejects invalid model key values', () => {
    const result = normalizeAndValidateObjectMetadata({
      model_key: 'https://example.com/model.glb',
    });

    expect(result.error).toEqual({
      code: 'OBJECT_MODEL_KEY_INVALID',
      message: 'Model key must be a short slug (letters, numbers, dash, underscore).',
    });
  });
});
