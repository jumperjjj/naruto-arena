export default {
  async fetch(request, env) {
    if (!env.ARENA_BACKEND_URL) {
      return new Response('Aguardando a configuração do servidor da arena.', { status: 503 });
    }
    const source = new URL(request.url);
    const target = new URL(env.ARENA_BACKEND_URL);
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
