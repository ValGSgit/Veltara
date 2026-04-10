type MetadataError = {
  code: string;
  message: string;
};

export type MetadataValidationResult = {
  metadata?: Record<string, unknown>;
  error?: MetadataError;
};

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/i;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;
const USER_ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;
const MODEL_KEY_PATTERN = /^[a-z0-9][a-z0-9-_]{0,63}$/;

function normalizeObjectName(value: unknown): { name?: string; error?: MetadataError } {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 64);

  if (!normalized) return {};

  if (CONTROL_CHAR_PATTERN.test(normalized)) {
    return {
      error: {
        code: 'OBJECT_NAME_INVALID',
        message: 'Object name contains unsupported control characters.',
      },
    };
  }

  if (/[<>]/.test(normalized)) {
    return {
      error: {
        code: 'OBJECT_NAME_INVALID',
        message: 'Object name cannot include angle brackets.',
      },
    };
  }

  if (URL_PATTERN.test(normalized)) {
    return {
      error: {
        code: 'OBJECT_NAME_MODERATION_BLOCKED',
        message: 'Object name cannot contain links.',
      },
    };
  }

  return { name: normalized };
}

function normalizePermissions(
  value: unknown,
): Record<string, 'viewer' | 'builder'> | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const normalized: Record<string, 'viewer' | 'builder'> = {};
  for (const [rawId, rawRole] of Object.entries(value as Record<string, unknown>)) {
    const userId = String(rawId).trim().slice(0, 64);
    if (!USER_ID_PATTERN.test(userId)) continue;
    if (rawRole === 'viewer' || rawRole === 'builder') {
      normalized[userId] = rawRole;
    }
  }

  return normalized;
}

export function normalizeAndValidateObjectMetadata(
  input: Record<string, unknown> | undefined,
): MetadataValidationResult {
  if (!input || typeof input !== 'object') return { metadata: input };

  const next: Record<string, unknown> = { ...input };

  if ('name' in next) {
    const normalizedName = normalizeObjectName(next.name);
    if (normalizedName.error) return { error: normalizedName.error };
    if (normalizedName.name) {
      next.name = normalizedName.name;
    } else {
      delete next.name;
    }
  }

  if ('permissions' in next) {
    const normalized = normalizePermissions(next.permissions);
    if (normalized && Object.keys(normalized).length > 0) {
      next.permissions = normalized;
    } else {
      delete next.permissions;
    }
  }

  if ('model_key' in next) {
    const modelKey = String(next.model_key ?? '').trim().toLowerCase();
    if (!modelKey) {
      delete next.model_key;
    } else if (URL_PATTERN.test(modelKey) || !MODEL_KEY_PATTERN.test(modelKey)) {
      return {
        error: {
          code: 'OBJECT_MODEL_KEY_INVALID',
          message: 'Model key must be a short slug (letters, numbers, dash, underscore).',
        },
      };
    } else {
      next.model_key = modelKey;
    }
  }

  return { metadata: next };
}
