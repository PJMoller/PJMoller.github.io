// pjmoller-admin Cloudflare Worker
//
// This is the actual security boundary for the admin panel. Your admin
// password and your GitHub token both live here as Worker secrets, set
// with `wrangler secret put`, never shipped to the browser, never
// visible in any page source. The admin page at pjmoller.github.io/admin
// talks to this Worker instead of talking to GitHub directly.
//
// Endpoints:
//   POST /login              { password } -> { token }  (12h session)
//   GET  /projects            -> current projects.json content + sha
//   PUT  /projects             { content, sha } -> commits to the repo
//   GET  /import?url=<repo>   -> { info, readme } for the "import from github" box
//
// Everything except /login requires `Authorization: Bearer <token>`.

const ALLOWED_ORIGIN = 'https://pjmoller.github.io';
const OWNER = 'PJMoller';
const REPO = 'PJMoller.github.io';
const FILE_PATH = 'projects.json';
const BRANCH = 'main';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function b64urlEncode(bytesOrStr) {
  const bytes = typeof bytesOrStr === 'string' ? new TextEncoder().encode(bytesOrStr) : bytesOrStr;
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecodeToString(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + (4 - (str.length % 4 || 4)) % 4, '=');
  return atob(padded);
}

async function hmacSign(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return b64urlEncode(new Uint8Array(sig));
}

async function makeSession(secret) {
  const payloadB64 = b64urlEncode(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS }));
  const sig = await hmacSign(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

async function verifySession(secret, token) {
  if (!token) return false;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return false;
  const expectedSig = await hmacSign(secret, payloadB64);
  if (expectedSig !== sig) return false;
  try {
    const payload = JSON.parse(b64urlDecodeToString(payloadB64));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function githubFetch(env, path, options = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `token ${env.GITHUB_TOKEN}`,
      'User-Agent': 'pjmoller-admin-worker',
      ...(options.headers || {}),
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === '/login' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!timingSafeEqual(body.password, env.ADMIN_PASSWORD)) {
        return json({ error: 'wrong password' }, 401);
      }
      const token = await makeSession(env.SESSION_SECRET);
      return json({ token });
    }

    // everything below requires a valid session
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!(await verifySession(env.SESSION_SECRET, token))) {
      return json({ error: 'unauthorized' }, 401);
    }

    if (url.pathname === '/projects' && request.method === 'GET') {
      const res = await githubFetch(env, `/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`);
      const data = await res.json();
      return json(data, res.status);
    }

    if (url.pathname === '/projects' && request.method === 'PUT') {
      const body = await request.json().catch(() => ({}));
      const res = await githubFetch(env, `/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'update projects via admin panel',
          content: body.content,
          sha: body.sha,
          branch: BRANCH,
        }),
      });
      const data = await res.json();
      return json(data, res.status);
    }

    if (url.pathname === '/import' && request.method === 'GET') {
      const repoUrl = url.searchParams.get('url') || '';
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/#]+)/i);
      if (!match) return json({ error: 'paste a full github.com/owner/repo url' }, 400);
      const owner = match[1];
      const repo = match[2].replace(/\.git$/, '');

      const infoRes = await githubFetch(env, `/repos/${owner}/${repo}`);
      if (!infoRes.ok) return json({ error: await infoRes.text() }, infoRes.status);
      const info = await infoRes.json();

      let readme = '';
      const readmeRes = await githubFetch(env, `/repos/${owner}/${repo}/readme`, {
        headers: { Accept: 'application/vnd.github.raw+json' },
      });
      if (readmeRes.ok) readme = await readmeRes.text();

      return json({ info, readme });
    }

    return json({ error: 'not found' }, 404);
  },
};
