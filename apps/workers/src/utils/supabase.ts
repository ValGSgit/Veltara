/**
 * Lightweight Supabase REST client for Cloudflare Workers.
 * Uses the REST API directly (no Node.js dependencies).
 */

export interface SupabaseClient {
  from: (table: string) => QueryBuilder;
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

interface QueryBuilder {
  select: (columns?: string) => QueryBuilder;
  insert: (data: Record<string, unknown> | Record<string, unknown>[]) => QueryBuilder;
  update: (data: Record<string, unknown>) => QueryBuilder;
  delete: () => QueryBuilder;
  upsert: (data: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string }) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  neq: (column: string, value: unknown) => QueryBuilder;
  gt: (column: string, value: unknown) => QueryBuilder;
  gte: (column: string, value: unknown) => QueryBuilder;
  lt: (column: string, value: unknown) => QueryBuilder;
  lte: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  is: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, opts?: { ascending?: boolean }) => QueryBuilder;
  limit: (n: number) => QueryBuilder;
  range: (from: number, to: number) => QueryBuilder;
  single: () => Promise<{ data: unknown; error: unknown }>;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  then: (resolve: (value: { data: unknown[]; error: unknown; count?: number }) => void) => Promise<void>;
}

export function createSupabaseClient(url: string, serviceKey: string): SupabaseClient {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  function buildQuery(
    table: string,
    method: string,
    body?: unknown,
    params?: URLSearchParams,
    isSingle = false,
    isCount = false,
  ): Promise<{ data: unknown; error: unknown; count?: number }> {
    const queryUrl = `${url}/rest/v1/${table}${params ? '?' + params.toString() : ''}`;
    const reqHeaders: Record<string, string> = { ...headers };
    if (isSingle) reqHeaders['Accept'] = 'application/vnd.pgrst.object+json';
    if (isCount) reqHeaders['Prefer'] = 'count=exact';

    return fetch(queryUrl, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (res) => {
      const text = await res.text();
      let data: unknown = null;
      try { data = JSON.parse(text); } catch { data = text; }
      if (!res.ok) return { data: null, error: data };
      const count = res.headers.get('Content-Range')
        ? parseInt(res.headers.get('Content-Range')!.split('/')[1] ?? '0')
        : undefined;
      return { data, error: null, count };
    });
  }

  function makeBuilder(table: string): QueryBuilder {
    let _method = 'GET';
    let _body: unknown = undefined;
    const _params = new URLSearchParams();
    let _single = false;
    let _select = '*';

    const builder: QueryBuilder = {
      select(cols = '*') { _select = cols; _params.set('select', cols); return builder; },
      insert(data) { _method = 'POST'; _body = data; _params.set('select', _select); return builder; },
      update(data) { _method = 'PATCH'; _body = data; _params.set('select', _select); return builder; },
      delete() { _method = 'DELETE'; return builder; },
      upsert(data, opts) {
        _method = 'POST';
        _body = data;
        const conflict = opts?.onConflict ?? 'id';
        headers['Prefer'] = `resolution=merge-duplicates,return=representation`;
        _params.set('on_conflict', conflict);
        _params.set('select', _select);
        return builder;
      },
      eq(col, val) { _params.append(col, `eq.${String(val)}`); return builder; },
      neq(col, val) { _params.append(col, `neq.${String(val)}`); return builder; },
      gt(col, val) { _params.append(col, `gt.${String(val)}`); return builder; },
      gte(col, val) { _params.append(col, `gte.${String(val)}`); return builder; },
      lt(col, val) { _params.append(col, `lt.${String(val)}`); return builder; },
      lte(col, val) { _params.append(col, `lte.${String(val)}`); return builder; },
      in(col, vals) { _params.append(col, `in.(${vals.join(',')})`); return builder; },
      is(col, val) { _params.append(col, `is.${val === null ? 'null' : String(val)}`); return builder; },
      order(col, opts) {
        _params.set('order', `${col}.${opts?.ascending === false ? 'desc' : 'asc'}`);
        return builder;
      },
      limit(n) { _params.set('limit', String(n)); return builder; },
      range(from, to) {
        headers['Range'] = `${from}-${to}`;
        headers['Range-Unit'] = 'items';
        return builder;
      },
      single() { _single = true; return buildQuery(table, _method, _body, _params, true) as Promise<{ data: unknown; error: unknown }>; },
      maybeSingle() {
        return buildQuery(table, _method, _body, _params, false).then((result) => {
          if (result.error) return { data: null, error: result.error };
          if (Array.isArray(result.data)) return { data: result.data[0] ?? null, error: null };
          return { data: result.data ?? null, error: null };
        }) as Promise<{ data: unknown; error: unknown }>;
      },
      then(resolve) {
        return buildQuery(table, _method, _body, _params, _single).then((r) => {
          resolve({ data: Array.isArray(r.data) ? r.data : r.data ? [r.data] : [], error: r.error, count: r.count });
        });
      },
    };
    return builder;
  }

  return {
    from: (table: string) => makeBuilder(table),
    rpc: (fn, params) =>
      fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers,
        body: params ? JSON.stringify(params) : undefined,
      }).then(async (res) => {
        const data = await res.json();
        return res.ok ? { data, error: null } : { data: null, error: data };
      }),
  };
}
