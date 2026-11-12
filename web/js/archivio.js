// Accesso all'archivio (Supabase). Tiene in memoria una copia dei dati e avvisa la pagina a ogni cambiamento.
// Ogni errore viene reso visibile: nessuna scrittura fallita passa in silenzio.

import { CONFIG } from '../config.js';

export const sb = window.supabase.createClient(CONFIG.url, CONFIG.chiavePubblica, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const TABELLE = ['progetti', 'obiettivi', 'schede', 'sottoschede', 'attivita', 'blocchi', 'registrazioni_tempo', 'abitudini', 'abitudini_registrazioni'];

export const S = {
  progetti: [], obiettivi: [], schede: [], sottoschede: [], attivita: [], blocchi: [],
  registrazioni_tempo: [], abitudini: [], abitudini_registrazioni: [], cronologia: [], sinc: null,
  caricato: false,
  ultimoRiuscito: null, // ultimo scambio riuscito con l'archivio
  errore: null,         // ultimo errore dell'archivio ancora da risolvere
  erroreGoogle: null,   // ultimo errore di Google Calendar ancora da risolvere
};

const ascoltatori = new Set();
export const alCambio = (f) => { ascoltatori.add(f); return () => ascoltatori.delete(f); };
export const notifica = () => ascoltatori.forEach((f) => f());

export function spiega(e) {
  const m = String(e?.message || e || '');
  if (!navigator.onLine || /failed to fetch|networkerror|load failed|network request/i.test(m)) {
    return 'Rete non disponibile: l\'archivio non è stato raggiunto. Nessuna modifica è stata salvata.';
  }
  if (/jwt|token.*expired|not authenticated/i.test(m)) return 'Accesso scaduto: esci e rientra.';
  return `L'archivio ha risposto con un errore: ${m}`;
}

/** Esegue una richiesta all'archivio registrando esito e ora. */
async function esegui(richiesta) {
  try {
    const { data, error } = await richiesta();
    if (error) throw error;
    S.ultimoRiuscito = new Date();
    S.errore = null;
    return data;
  } catch (e) {
    S.errore = spiega(e);
    notifica();
    throw new Error(S.errore);
  }
}

const ORDINE = {
  progetti: 'posizione', obiettivi: 'posizione', schede: 'posizione', sottoschede: 'posizione',
  attivita: 'posizione', blocchi: 'inizio', registrazioni_tempo: 'creato_il',
  abitudini: 'posizione', abitudini_registrazioni: 'giorno',
};

export async function caricaTutto() {
  const [righe, cronologia, sinc] = await Promise.all([
    Promise.all(TABELLE.map((t) => esegui(() => sb.from(t).select('*').order(ORDINE[t]).order('creato_il')))),
    esegui(() => sb.from('cronologia').select('*').order('quando', { ascending: false }).limit(60)),
    esegui(() => sb.from('sincronizzazione').select('calendario_id,calendario_nome,ultimo_riuscito,ultimo_errore,ultimo_errore_il').maybeSingle()),
  ]);
  TABELLE.forEach((t, i) => { S[t] = righe[i]; });
  S.cronologia = cronologia;
  S.sinc = sinc;
  S.caricato = true;
  notifica();
}

export async function crea(tabella, riga) {
  const nuova = await esegui(() => sb.from(tabella).insert(riga).select().single());
  S[tabella].push(nuova);
  notifica();
  return nuova;
}

export async function modifica(tabella, id, campi) {
  const nuova = await esegui(() => sb.from(tabella).update(campi).eq('id', id).select().single());
  const i = S[tabella].findIndex((r) => r.id === id);
  if (i >= 0) S[tabella][i] = nuova;
  notifica();
  return nuova;
}

/** Elimina una riga (e, a cascata, ciò che contiene), poi rilegge l'archivio. */
export async function elimina(tabella, id) {
  await esegui(() => sb.from(tabella).delete().eq('id', id));
  await caricaTutto();
}

/** Elimina una riga senza figli e la toglie dalla copia in memoria, senza rileggere tutto. */
export async function togli(tabella, id) {
  await esegui(() => sb.from(tabella).delete().eq('id', id));
  S[tabella] = S[tabella].filter((r) => r.id !== id);
  notifica();
}

export async function annota(tipo, { attivita_id = null, blocco_id = null, dettaglio = {} } = {}) {
  const r = await esegui(() => sb.from('cronologia').insert({ tipo, attivita_id, blocco_id, dettaglio }).select().single());
  S.cronologia.unshift(r);
}

export const prossimaPosizione = (lista) => lista.reduce((m, r) => Math.max(m, r.posizione), 0) + 1;

/** Scambia la posizione di una riga con la vicina (direzione -1 o +1) dentro `lista` ordinata. */
export async function sposta(tabella, lista, id, direzione) {
  const i = lista.findIndex((r) => r.id === id), j = i + direzione;
  if (i < 0 || j < 0 || j >= lista.length) return;
  const a = lista[i], b = lista[j];
  const pa = a.posizione, pb = b.posizione === a.posizione ? a.posizione + direzione : b.posizione;
  await modifica(tabella, a.id, { posizione: pb });
  await modifica(tabella, b.id, { posizione: pa });
}

// ---------- letture di comodo ----------

const perPosizione = (a, b) => a.posizione - b.posizione || a.creato_il.localeCompare(b.creato_il);
export const trova = (tabella, id) => S[tabella].find((r) => r.id === id);
export const schedeDi = (progettoId) => S.schede.filter((s) => s.progetto_id === progettoId).sort(perPosizione);
export const sottoschedeDi = (schedaId) => S.sottoschede.filter((s) => s.scheda_id === schedaId).sort(perPosizione);
export const attivitaDi = (sottoschedaId) => S.attivita.filter((a) => a.sottoscheda_id === sottoschedaId).sort(perPosizione);
export const blocchiDi = (attivitaId) => S.blocchi.filter((b) => b.attivita_id === attivitaId);
export const registrazioniDi = (attivitaId) => S.registrazioni_tempo.filter((r) => r.attivita_id === attivitaId);

/** Risale da un'attività a sottoscheda, scheda e progetto. */
export function contesto(attivita) {
  const sottoscheda = trova('sottoschede', attivita?.sottoscheda_id);
  const scheda = trova('schede', sottoscheda?.scheda_id);
  const progetto = trova('progetti', scheda?.progetto_id);
  return { sottoscheda, scheda, progetto };
}

export function attivitaDelProgetto(progettoId) {
  const schede = new Set(S.schede.filter((s) => s.progetto_id === progettoId).map((s) => s.id));
  const sotto = new Set(S.sottoschede.filter((s) => schede.has(s.scheda_id)).map((s) => s.id));
  return S.attivita.filter((a) => sotto.has(a.sottoscheda_id));
}

/** Alla prima apertura crea il progetto Age+ con la sua scheda fissa. */
/** Crea un progetto con la sua scheda fissa (Processi, Idee, Link utili). */
export async function creaProgetto({ nome, colore_google = 2, limite_ore_settimana = null }) {
  const progetto = await crea('progetti', { nome, colore_google, limite_ore_settimana, posizione: prossimaPosizione(S.progetti) });
  const fissa = await crea('schede', { progetto_id: progetto.id, titolo: 'Base del progetto', fissa: true, posizione: 0 });
  let n = 1;
  for (const titolo of ['Processi', 'Idee', 'Link utili']) {
    await crea('sottoschede', { scheda_id: fissa.id, titolo, posizione: n++ });
  }
  return progetto;
}

/** Al primo avvio crea il progetto Age+. */
export async function assicuraAgePlus() {
  if (S.progetti.length) return;
  await creaProgetto({ nome: 'Age+', colore_google: 2, limite_ore_settimana: 5 });
}

// ---------- esportazione e ripristino ----------

/** Legge tutto dall'archivio (non dalla copia in memoria) e lo restituisce in forma leggibile. */
export async function esporta() {
  const tabelle = {};
  for (const t of [...TABELLE, 'cronologia']) {
    tabelle[t] = await esegui(() => sb.from(t).select('*').order(t === 'cronologia' ? 'quando' : 'creato_il'));
  }
  return { alfred: 1, esportato_il: new Date().toISOString(), tabelle };
}

/** Confronta una copia con l'archivio attuale: quante righe sono nuove e quante già presenti. */
export function anteprimaRipristino(copia) {
  if (copia?.alfred !== 1 || !copia.tabelle) throw new Error('Il file non è una copia di Alfred.');
  return TABELLE.map((t) => {
    const righe = copia.tabelle[t] || [];
    const presenti = new Set(S[t].map((r) => r.id));
    const gia = righe.filter((r) => presenti.has(r.id)).length;
    return { tabella: t, totale: righe.length, nuove: righe.length - gia, giaPresenti: gia };
  });
}

/**
 * Ripristina una copia: aggiunge le righe mancanti e riporta quelle esistenti ai valori della copia.
 * Non elimina nulla di ciò che c'è oggi. La cronologia non viene ripristinata.
 */
export async function ripristina(copia) {
  anteprimaRipristino(copia);
  for (const t of TABELLE) {
    const righe = (copia.tabelle[t] || []).map(({ proprietario, ...resto }) => resto);
    for (let i = 0; i < righe.length; i += 200) {
      await esegui(() => sb.from(t).upsert(righe.slice(i, i + 200), { onConflict: 'id' }));
    }
  }
  await annota('ripristino', { dettaglio: { copia_del: copia.esportato_il } });
  await caricaTutto();
}
