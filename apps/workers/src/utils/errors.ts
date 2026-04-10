/**
 * Consistent error response format for all Veltara Workers.
 * { error: { code, message, status } }
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    status: number;
  };
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  headers?: Record<string, string>,
): Response {
  const body: ApiErrorBody = { error: { code, message, status } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export const Errors = {
  unauthorized: () => errorResponse('UNAUTHORIZED', 'Authentication required', 401),
  forbidden: (msg = 'Insufficient permissions') => errorResponse('FORBIDDEN', msg, 403),
  notFound: (msg = 'Resource not found') => errorResponse('NOT_FOUND', msg, 404),
  badRequest: (msg: string) => errorResponse('BAD_REQUEST', msg, 400),
  tooManyRequests: (msg = 'Rate limit exceeded') => errorResponse('RATE_LIMITED', msg, 429),
  internalError: (msg = 'Internal server error') => errorResponse('INTERNAL_ERROR', msg, 500),
  methodNotAllowed: () => errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', 405),
  conflict: (msg: string) => errorResponse('CONFLICT', msg, 409),
};
