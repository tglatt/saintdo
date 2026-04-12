/**
 * Script à lancer UNE SEULE FOIS pour obtenir le refresh_token HelloAsso.
 * Lance un serveur local sur le port 4242 pour recevoir le callback OAuth.
 *
 * Usage : node scripts/get-token.mjs
 */

import http from 'http';
import crypto from 'crypto';

const CLIENT_ID = process.env.HELLOASSO_CLIENT_ID;
const CLIENT_SECRET = process.env.HELLOASSO_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:4242/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌  Charge le .env avant de lancer ce script :');
  console.error('   export $(cat .env | xargs) && node scripts/get-token.mjs');
  process.exit(1);
}

// Génération PKCE
const codeVerifier = crypto.randomBytes(48).toString('base64url');
const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

const authUrl =
  `https://auth.helloasso.com/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&code_challenge=${codeChallenge}` +
  `&code_challenge_method=S256`;

console.log('\n👉  Ouvre cette URL dans ton navigateur et connecte-toi avec le compte HelloAsso de l\'organisation :\n');
console.log(authUrl);
console.log('\n⏳  En attente du callback sur http://localhost:4242 ...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:4242');
  if (url.pathname !== '/callback') return;

  const code = url.searchParams.get('code');
  if (!code) {
    res.end('Pas de code reçu.');
    return;
  }

  console.log('✅  Code reçu, échange en cours...');

  const tokenRes = await fetch('https://api.helloasso.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: codeVerifier,
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokens.refresh_token) {
    console.error('❌  Erreur :', tokens);
    res.end('Erreur lors de l\'échange du token.');
    server.close();
    return;
  }

  console.log('\n✅  Tokens obtenus !');
  console.log('\n👉  Ajoute cette ligne dans ton .env :');
  console.log(`HELLOASSO_REFRESH_TOKEN=${tokens.refresh_token}\n`);

  res.end('Token obtenu ! Tu peux fermer cette fenêtre et retourner dans le terminal.');
  server.close();
});

server.listen(4242);
