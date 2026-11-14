// Avvio di Alfred: accesso obbligatorio, barra laterale, pagine, stato degli aggiornamenti.

import { h, avviso } from './ui.js';
import { sb, S, alCambio, caricaTutto, assicuraAgePlus, trova } from './archivio.js';
import { CONFIG } from '../config.js';
import { chiama, sincronizza, googleCollegato } from './google.js';
import { blocchiDaConfermare, COLORI } from './stato.js';
import { oraTesto, dataOraTesto, giornoRoma, intervalloTesto } from './fuso.js';
import { vistaProgetto, vistaScheda, apriNuovoProgetto } from './viste/progetto.js';
import { vistaMatrice, listaDaPianificare } from './viste/matrice.js';
import { vistaCalendario } from './viste/calendario.js';
import { vistaElenco, vistaTempo, vistaDati, collegaGoogle, testoCronologia } from './viste/altre.js';
import { apriEsito } from './viste/attivita.js';
import { vistaAbitudini } from './viste/abitudini.js';
import { vistaFinanze } from './viste/finanze.js';

const radice = document.getElementById('alfred');
let sessione = null;
let ultimoControllo = 0;
let cassettoAperto = false;

const STRUMENTI = [
  ['#/calendario', 'Calendario', '▦'],
  ['#/attivita', 'Attività', '☰'],
  ['#/matrice', 'Matrice', '◫'],
  ['#/abitudini', 'Abitudini', '✓'],
  ['#/finanze', 'Finanze', '€'],
  ['#/tempo', 'Gestione del tempo', '◔'],
  ['#/dati', 'Dati e collegamenti', '⚙'],
];
const IN_ARRIVO = [];

function percorso() {
  const parti = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  return parti.length ? parti : ['progetto', S.progetti[0]?.id];
}

function contenuto() {
  const [a, b, c, d] = percorso();
  if (a === 'progetto' && c === 'scheda') return vistaScheda(b, d);
  if (a === 'progetto') return vistaProgetto(b || S.progetti[0]?.id);
  if (a === 'matrice') return vistaMatrice();
  if (a === 'calendario') return vistaCalendario(disegna);
  if (a === 'attivita') return vistaElenco(disegna);
  if (a === 'abitudini') return vistaAbitudini();
  if (a === 'finanze') return vistaFinanze(b);
  if (a === 'tempo') return vistaTempo();
  if (a === 'dati') return vistaDati(disegna);
  return vistaProgetto(S.progetti[0]?.id);
}

function barraLaterale() {
  const qui = `#/${percorso().slice(0, 2).join('/')}`;
  const attiva = (href) => (qui === href || qui.startsWith(`${href}/`) || (href.startsWith('#/progetto') && qui === href) ? 'attiva' : '');
  const daPianificare = listaDaPianificare().length;
  const chiudi = () => { cassettoAperto = false; };
  return h('nav', { class: `laterale-barra ${cassettoAperto ? 'aperta' : ''}`, 'aria-label': 'Navigazione' },
    h('div', { class: 'marchio' }, 'Alfred'),
    h('div', { class: 'gruppo' },
      h('h2', {}, 'Strumenti'),
      STRUMENTI.map(([href, nome, segno]) => h('a', { href, class: attiva(href), onclick: chiudi },
        h('span', { class: 'segno', 'aria-hidden': 'true' }, segno), nome,
        href === '#/matrice' && daPianificare ? h('span', { class: 'conta' }, daPianificare) : null)),
      IN_ARRIVO.map((nome) => h('span', { class: 'spento', title: 'Previsto in un incremento futuro' },
        h('span', { class: 'segno', 'aria-hidden': 'true' }, '·'), nome, h('small', {}, 'in arrivo')))),
    h('div', { class: 'gruppo' },
      h('h2', {}, 'Progetti'),
      S.progetti.map((p) => h('a', { href: `#/progetto/${p.id}`, class: attiva(`#/progetto/${p.id}`), onclick: chiudi },
        h('span', { class: 'pallino', style: `--colore:${COLORI[p.colore_google][1]}` }), p.nome)),
      h('button', { class: 'aggiungi nuovo-progetto', onclick: () => { chiudi(); apriNuovoProgetto(); } }, '+ Nuovo progetto')));
}

function barraTelefono() {
  const qui = `#/${percorso()[0]}`;
  const voce = (href, nome, segno) => h('a', { href, class: qui === href ? 'attiva' : '' }, h('span', { 'aria-hidden': 'true' }, segno), nome);
  return h('nav', { class: 'barra-telefono', 'aria-label': 'Navigazione rapida' },
    h('button', { class: cassettoAperto ? 'attiva' : '', onclick: () => { cassettoAperto = !cassettoAperto; disegna(); } }, h('span', { 'aria-hidden': 'true' }, '≡'), 'Menu'),
    voce(`#/progetto`, 'Progetto', '◉'),
    voce('#/matrice', 'Matrice', '◫'),
    voce('#/calendario', 'Calendario', '▦'),
    voce('#/tempo', 'Tempo', '◔'));
}

function statoAggiornamenti() {
  const daConfermare = blocchiDaConfermare(S.blocchi);
  const nonScritti = S.blocchi.filter((b) => b.stato === 'da_scrivere');
  const novita = S.cronologia.filter((c) => !c.visto && ['spostato_in_google', 'rimosso_in_google', 'giornata_intera_in_google'].includes(c.tipo));
  return h('div', { class: 'stato-zona' },
    S.errore ? h('div', { class: 'fascia errore', role: 'alert' }, S.errore,
      h('button', { onclick: () => caricaTutto().then(() => avviso('Archivio di nuovo raggiungibile.')).catch(() => {}) }, 'Riprova')) : null,
    S.erroreGoogle ? h('div', { class: 'fascia errore', role: 'alert' }, S.erroreGoogle,
      h('button', { onclick: () => allinea(true) }, 'Riprova'),
      h('button', { onclick: () => { S.erroreGoogle = null; disegna(); } }, 'Nascondi')) : null,
    novita.length ? h('div', { class: 'fascia novita' },
      h('div', {}, h('strong', {}, 'Modifiche arrivate da Google Calendar:'),
        h('ul', {}, novita.map((c) => h('li', {}, testoCronologia(c))))),
      h('button', { onclick: async () => {
        try {
          const { error } = await sb.from('cronologia').update({ visto: true }).in('id', novita.map((c) => c.id));
          if (error) throw error;
          novita.forEach((c) => { c.visto = true; });
          disegna();
        } catch (e) { avviso(`Non sono riuscito a registrare la presa visione: ${e.message}`, 'errore'); }
      } }, 'Ho visto')) : null,
    daConfermare.length ? h('div', { class: 'fascia conferma' },
      h('div', {}, h('strong', {}, `${daConfermare.length === 1 ? 'Un blocco è terminato' : `${daConfermare.length} blocchi sono terminati`}: com'è andata?`),
        h('ul', {}, daConfermare.map((b) => h('li', {},
          h('button', { class: 'collegamento', onclick: () => apriEsito(b.id) },
            `${trova('attivita', b.attivita_id)?.titolo || 'Attività'} · ${intervalloTesto(b.inizio, b.fine)}`)))))) : null,
    nonScritti.length ? h('div', { class: 'fascia novita' },
      `${nonScritti.length === 1 ? 'Un blocco non è ancora stato scritto' : `${nonScritti.length} blocchi non sono ancora stati scritti`} su Google Calendar. Apri l'attività e premi «Riprova a scrivere».`) : null,
    h('div', { class: 'ultimo' },
      h('span', {}, `Archivio: ultimo aggiornamento riuscito ${S.ultimoRiuscito ? ora(S.ultimoRiuscito) : 'mai'}`),
      h('span', {}, googleCollegato()
        ? `Google Calendar: ultimo allineamento riuscito ${S.sinc?.ultimo_riuscito ? ora(S.sinc.ultimo_riuscito) : 'mai'}`
        : 'Google Calendar: non collegato')));
}

const ora = (t) => (giornoRoma(t) === giornoRoma(new Date()) ? `oggi alle ${oraTesto(t)}` : dataOraTesto(t));

function disegna() {
  if (!sessione) return disegnaAccesso();
  if (!S.caricato) {
    radice.replaceChildren(h('div', { class: 'accesso' }, h('h1', {}, 'Alfred'),
      S.errore ? [h('p', { class: 'errore-testo', role: 'alert' }, S.errore), h('button', { class: 'primario', onclick: avvia }, 'Riprova')] : h('p', {}, 'Carico i dati…')));
    return;
  }
  const vecchio = radice.querySelector('main');
  const scorrimento = vecchio ? [vecchio.scrollTop, vecchio.querySelector('.colonne, .bacheca-mobili')?.scrollLeft || 0] : [0, 0];
  const principale = h('main', {}, statoAggiornamenti(), contenuto());
  radice.replaceChildren(h('div', { class: 'ossatura' }, barraLaterale(), principale, barraTelefono()));
  principale.scrollTop = scorrimento[0];
  const orizzontale = principale.querySelector('.colonne, .bacheca-mobili');
  if (orizzontale) orizzontale.scrollLeft = scorrimento[1];
}

function disegnaAccesso(messaggio) {
  radice.replaceChildren(h('div', { class: 'accesso' },
    h('h1', {}, 'Alfred'),
    h('p', {}, 'Gestionale personale. L\'accesso è riservato.'),
    messaggio ? h('p', { class: 'errore-testo', role: 'alert' }, messaggio) : null,
    h('button', { class: 'primario grande', onclick: async () => {
      const { error } = await collegaGoogle();
      if (error) disegnaAccesso(`Accesso non riuscito: ${error.message}`);
    } }, 'Accedi con Google')));
}

/** Allinea con Google: recepisce spostamenti e rimozioni fatti in Google Calendar. */
async function allinea(conAvviso = false) {
  if (!googleCollegato()) return;
  ultimoControllo = Date.now();
  try {
    const r = await sincronizza();
    if (conAvviso) avviso(r.modifiche.length ? `Recepite ${r.modifiche.length} modifiche fatte in Google.` : 'Allineato: nessuna novità.');
  } catch { /* l'errore resta visibile nella fascia in alto */ }
}

/** Dopo l'accesso con Google consegna alla funzione riservata la chiave di rinnovo, una volta sola. */
async function consegnaChiaveGoogle() {
  const chiave = sessione?.provider_refresh_token;
  if (!chiave) return;
  const impronta = chiave.slice(-12);
  if (localStorage.getItem('alfred-chiave-consegnata') === impronta) return;
  try {
    await chiama('collega', { chiave_rinnovo: chiave });
    localStorage.setItem('alfred-chiave-consegnata', impronta);
    avviso('Google Calendar collegato.');
  } catch (e) {
    avviso(`Accesso riuscito, ma il collegamento a Google Calendar no: ${e.message}`, 'errore');
  }
}

/**
 * Segnala all'avviso di pausa che l'archivio è stato appena letto con successo.
 * Passa dalla funzione riservata, che sola conosce l'indirizzo dell'avviso.
 * Al massimo una volta ogni sei ore per dispositivo; se non riesce, riprova alla prossima apertura.
 */
async function segnalaAccesso() {
  const ultimo = +localStorage.getItem('alfred-ultimo-segnale') || 0;
  if (Date.now() - ultimo < 6 * 3600000) return;
  try {
    const r = await fetch(`${CONFIG.url}/functions/v1/calendario`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessione?.access_token || ''}`, apikey: CONFIG.chiavePubblica, 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'segnale' }),
    });
    const d = await r.json();
    if (d.riuscito) localStorage.setItem('alfred-ultimo-segnale', String(Date.now()));
  } catch { /* silenzioso: non deve disturbare l'uso */ }
}

async function avvia() {
  const errore = new URLSearchParams(location.search).get('error_description');
  const { data } = await sb.auth.getSession();
  sessione = data.session;
  if (!sessione) { disegnaAccesso(errore ? `Accesso non riuscito: ${errore}` : null); return; }
  if (location.search) history.replaceState(null, '', location.pathname + location.hash);
  disegna();
  try {
    await consegnaChiaveGoogle();
    await caricaTutto();
    await assicuraAgePlus();
  } catch { disegna(); return; }
  segnalaAccesso();
  disegna();
  allinea();
}

alCambio(disegna);
window.addEventListener('hashchange', () => { cassettoAperto = false; disegna(); });
window.addEventListener('online', () => { caricaTutto().catch(() => {}); });
window.addEventListener('offline', () => { S.errore = 'Sei senza rete: quello che vedi potrebbe non essere aggiornato e le modifiche non verranno salvate.'; disegna(); });
window.matchMedia('(max-width: 760px)').addEventListener('change', disegna);
// Al ritorno sulla pagina, se sono passati più di cinque minuti, si riallinea con Google.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sessione && S.caricato && Date.now() - ultimoControllo > 300000) { allinea(); segnalaAccesso(); }
});
// Ogni minuto controlla se un blocco è terminato, senza interrogare la rete.
let terminati = 0;
setInterval(() => {
  if (!S.caricato || document.querySelector('dialog[open]')) return;
  const n = blocchiDaConfermare(S.blocchi).length;
  if (n !== terminati) { terminati = n; disegna(); }
}, 60000);

sb.auth.onAuthStateChange((evento, nuova) => {
  if (evento === 'SIGNED_OUT') { sessione = null; S.caricato = false; disegna(); }
  else if (nuova) sessione = nuova;
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

avvia();
