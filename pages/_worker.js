export default {
  async fetch(request, env) {
    const source = new URL(request.url);
    const target = new URL(env.ARENA_BACKEND_URL || 'https://arena-teste-9ln6.onrender.com');
    target.pathname = source.pathname;
    target.search = source.search;
    const headers = new Headers(request.headers);
    headers.delete('host');
    if (headers.get('Origin') === source.origin) {
      headers.set('Origin', target.origin);
    }
    return fetch(new Request(target, request), { headers, redirect: 'manual' });
  },
};
