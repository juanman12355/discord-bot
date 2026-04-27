'use strict';

/**
 * get-spotify-token.js
 * Corre este script UNA SOLA VEZ en tu PC para obtener el refresh token
 * de la cuenta del bot. Luego copia el token al .env de la VM.
 *
 * Uso: node get-spotify-token.js
 */

require('dotenv').config();
const http = require('http');
const { exec } = require('child_process');

const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI  = 'http://127.0.0.1:8888/callback';
const SCOPE         = 'playlist-read-private playlist-read-collaborative';
const PORT          = 8888;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan SPOTIFY_CLIENT_ID o SPOTIFY_CLIENT_SECRET en el .env');
  process.exit(1);
}

// ── 1. Construir URL de autorización ─────────────────────────────────────────

const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
  client_id:     CLIENT_ID,
  response_type: 'code',
  redirect_uri:  REDIRECT_URI,
  scope:         SCOPE,
}).toString();

// ── 2. Iniciar servidor local para recibir el callback ────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code  = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>❌ Autorización cancelada o fallida. Cierra esta ventana.</h2>');
    server.close();
    return;
  }

  // ── 3. Intercambiar code por tokens ────────────────────────────────────────

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Spotify respondió ${tokenRes.status}`);
    }

    const data = await tokenRes.json();

    // ── 4. Mostrar resultado ──────────────────────────────────────────────────

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <h2>✅ ¡Autenticación exitosa! Cierra esta ventana.</h2>
      <p>Copia el refresh token que aparece en la terminal.</p>
    `);

    console.log('\n✅ ¡Token obtenido correctamente!\n');
    console.log('━'.repeat(60));
    console.log('SPOTIFY_REFRESH_TOKEN=' + data.refresh_token);
    console.log('━'.repeat(60));
    console.log('\n👉 Agrega esa línea al .env de tu VM y reinicia el bot.\n');

  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>❌ Error: ${err.message}</h2>`);
    console.error('❌ Error al obtener el token:', err.message);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log('🎵 Abriendo Spotify para autenticar la cuenta del bot...');
  console.log('   Inicia sesión con la cuenta del bot (NO con tu cuenta personal)\n');

  // Abrir navegador automáticamente
  const cmd = process.platform === 'win32'
    ? `start "" "${authUrl}"`
    : `open "${authUrl}"`;

  exec(cmd, err => {
    if (err) {
      console.log('No se pudo abrir el navegador automáticamente.');
      console.log('Abre esta URL manualmente:\n');
      console.log(authUrl);
    }
  });
});
