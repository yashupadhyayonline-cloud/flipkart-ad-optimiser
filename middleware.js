// middleware.js — Edge Middleware, runs server-side on Vercel
// Shows a custom login page, checks password server-side, sets a signed cookie

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };

const LOGIN_HTML = (error) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ad/Opt — Login</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f5f6f8;font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border:1px solid #dde1e7;border-radius:20px;padding:44px 40px;max-width:380px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.08)}
.logo{font-size:22px;font-weight:700;color:#2563eb;margin-bottom:4px;letter-spacing:-.4px}
.logo span{color:#6b7280;font-weight:400}
.tagline{font-size:13px;color:#6b7280;margin-bottom:36px}
.field{margin-bottom:16px}
label{display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px}
input{width:100%;background:#f9fafb;border:1.5px solid #dde1e7;border-radius:9px;font-size:14px;padding:11px 14px;outline:none;font-family:'Inter',sans-serif;color:#1a1d23;transition:border-color .15s}
input:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.08)}
.btn{width:100%;background:#2563eb;color:#fff;border:none;border-radius:9px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;margin-top:8px;transition:opacity .15s;letter-spacing:.1px}
.btn:hover{opacity:.88}
.err{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:12px;color:#dc2626;margin-bottom:16px;display:${error ? 'flex' : 'none'};align-items:center;gap:8px}
.divider{height:1px;background:#f0f2f5;margin:24px 0}
.footer{font-size:11px;color:#9ca3af;text-align:center}
</style>
</head>
<body>
<div class="card">
  <div class="logo">Ad<span>/</span>Opt</div>
  <div class="tagline">Flipkart Ad Optimiser — Sign in to continue</div>
  <div class="err">⚠ Incorrect password — please try again</div>
  <form method="POST" action="/__auth">
    <div class="field">
      <label>Password</label>
      <input type="password" name="password" placeholder="Enter your password" autofocus autocomplete="current-password">
    </div>
    <button class="btn" type="submit">Sign In →</button>
  </form>
  <div class="divider"></div>
  <div class="footer">Your data is stored securely in the cloud</div>
</div>
</body>
</html>`;

function signCookie(password, secret) {
  // Simple HMAC-like signature using secret — good enough for this use case
  // We XOR-hash the password+secret together to create a token
  const str = password + '|' + secret;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36) + str.length.toString(36);
}

export default async function middleware(req) {
  const url = new URL(req.url);
  const APP_PASSWORD = process.env.APP_PASSWORD;
  const COOKIE_SECRET = process.env.COOKIE_SECRET || APP_PASSWORD || 'default';

  // No password set — let everything through
  if (!APP_PASSWORD) return;

  const expectedToken = signCookie(APP_PASSWORD, COOKIE_SECRET);

  // ── Handle login form POST ──────────────────────────────
  if (req.method === 'POST' && url.pathname === '/__auth') {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const submitted = params.get('password') || '';

    if (submitted === APP_PASSWORD) {
      // ✅ Correct — set auth cookie and redirect to app
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/',
          'Set-Cookie': `adopt_session=${expectedToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
        },
      });
    } else {
      // ❌ Wrong password — show login page with error
      return new Response(LOGIN_HTML(true), {
        status: 401,
        headers: { 'Content-Type': 'text/html' },
      });
    }
  }

  // ── Check auth cookie on all other requests ─────────────
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );

  if (cookies['adopt_session'] === expectedToken) {
    return; // ✅ Valid session — let through
  }

  // ❌ Not authenticated — show login page
  return new Response(LOGIN_HTML(false), {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}
