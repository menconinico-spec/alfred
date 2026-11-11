// Attrezzi comuni alle prove nel browser. Usano un utente di prova separato e dati fittizi.
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const qui = dirname(fileURLToPath(import.meta.url));
export const RISULTATI = join(qui, 'risultati');
mkdirSync(RISULTATI, { recursive: true });

// Le chiavi si leggono dal file locale dei segreti, mai scritte nel codice.
export const segreti = Object.fromEntries(
  readFileSync(join(qui, '..', '.env.segreti'), 'utf8').split('\n').filter((r) => r.includes('='))
    .map((r) => [r.slice(0, r.indexOf('=')), r.slice(r.indexOf('=') + 1)]),
);
export const URL_SB = segreti.SUPABASE_URL;
export const RIF = new URL(URL_SB).hostname.split('.')[0];
export const PAGINA = process.env.ALFRED_PAGINA || 'http://127.0.0.1:8765/';
export const EMAIL_PROVA = 'prova-automatica@alfred.invalid';

const servizio = { apikey: segreti.SUPABASE_CHIAVE_SERVIZIO, Authorization: `Bearer ${segreti.SUPABASE_CHIAVE_SERVIZIO}`, 'Content-Type': 'application/json' };

async function json(r) {
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

export async function eliminaUtenteDiProva() {
  const elenco = await json(await fetch(`${URL_SB}/auth/v1/admin/users?per_page=200`, { headers: servizio }));
  for (const u of elenco.users.filter((x) => x.email === EMAIL_PROVA)) {
    await json(await fetch(`${URL_SB}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: servizio }));
  }
}

/** Crea l'utente di prova e restituisce una sessione valida per lui. */
export async function sessioneDiProva() {
  await eliminaUtenteDiProva();
  const parola = crypto.randomUUID() + crypto.randomUUID();
  await json(await fetch(`${URL_SB}/auth/v1/admin/users`, {
    method: 'POST', headers: servizio, body: JSON.stringify({ email: EMAIL_PROVA, password: parola, email_confirm: true }),
  }));
  return json(await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: segreti.SUPABASE_CHIAVE_PUBBLICA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL_PROVA, password: parola }),
  }));
}

/** Legge o scrive nell'archivio con i diritti dell'utente della sessione (valgono le regole sulle righe). */
export function archivioCome(sessione) {
  const h = { apikey: segreti.SUPABASE_CHIAVE_PUBBLICA, Authorization: `Bearer ${sessione.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  return async (percorso, metodo = 'GET', corpo) => json(await fetch(`${URL_SB}/rest/v1/${percorso}`, { method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined }));
}

export async function apriBrowser() {
  return puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--no-first-run', '--disable-extensions'],
  });
}

export const MAC = { width: 1440, height: 900, deviceScaleFactor: 1 };
export const IPHONE = { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/** Apre la pagina di Alfred. Con `sessione` l'utente risulta già entrato. */
export async function apriPagina(browser, { sessione = null, schermo = MAC, percorso = '' } = {}) {
  const contesto = await browser.createBrowserContext();
  const pagina = await contesto.newPage();
  await pagina.setViewport(schermo);
  const errori = [];
  pagina.on('pageerror', (e) => errori.push(`errore di pagina: ${e.message}`));
  pagina.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) errori.push(`console: ${m.text()}`); });
  if (sessione) {
    await pagina.evaluateOnNewDocument((chiave, valore) => localStorage.setItem(chiave, valore),
      `sb-${RIF}-auth-token`, JSON.stringify(sessione));
  }
  await pagina.goto(PAGINA + percorso, { waitUntil: 'networkidle0' });
  return { pagina, errori, contesto };
}

/** Clicca il primo elemento visibile che contiene il testo. */
export async function clicca(pagina, selettore, testo, dentro = 'body') {
  const fatto = await pagina.evaluate((sel, t, radice) => {
    const base = [...document.querySelectorAll(radice)].pop();
    const el = [...base.querySelectorAll(sel)].find((e) => e.textContent.includes(t) && e.getClientRects().length);
    if (!el) return false;
    el.click();
    return true;
  }, selettore, testo, dentro);
  if (!fatto) throw new Error(`Non trovo «${testo}» (${selettore}) in ${dentro}`);
  await pausa(pagina);
}

export const pausa = (pagina, ms = 150) => pagina.waitForNetworkIdle({ idleTime: ms, timeout: 15000 }).catch(() => {});
export const testo = (pagina, selettore = 'main') => pagina.$eval(selettore, (e) => e.innerText);
export const foto = (pagina, nome) => pagina.screenshot({ path: join(RISULTATI, `${nome}.png`) });

const esiti = [];
export function esito(numero, descrizione, riuscita, prova) {
  esiti.push({ numero, descrizione, riuscita, prova });
  console.log(`${riuscita ? 'RIUSCITA' : 'FALLITA '} · ${numero} · ${descrizione}\n           prova: ${prova}`);
}
export const tutteRiuscite = () => esiti.every((e) => e.riuscita);
