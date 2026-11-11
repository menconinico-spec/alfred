// Regole su stati, pianificazione e tempo. Funzioni pure: non leggono né scrivono l'archivio.

import { giornoRoma, lunediDi, aggiungiGiorni, istanteDi } from './fuso.js';

export const STATI = {
  da_fare: 'Da fare',
  in_corso: 'In corso',
  in_attesa: 'In attesa',
  completata: 'Completata',
  annullata: 'Annullata',
};

export const STATI_BLOCCO = {
  da_scrivere: 'Non ancora scritto su Google',
  in_calendario: 'In calendario',
  svolto: 'Svolto',
  saltato: 'Saltato',
  rimosso_in_google: 'Rimosso in Google',
  annullato: 'Tolto dal calendario',
};

// Colori degli eventi di Google Calendar: usando questi, il colore è identico nei due sistemi.
export const COLORI = {
  1: ['Lavanda', '#7986cb'], 2: ['Salvia', '#33b679'], 3: ['Uva', '#8e24aa'],
  4: ['Fenicottero', '#e67c73'], 5: ['Banana', '#f6bf26'], 6: ['Mandarino', '#f4511e'],
  7: ['Pavone', '#039be5'], 8: ['Grafite', '#616161'], 9: ['Mirtillo', '#3f51b5'],
  10: ['Basilico', '#0b8043'], 11: ['Pomodoro', '#d50000'],
};

const ms = (x) => new Date(x).getTime();
const minutiBlocco = (b) => Math.round((ms(b.fine) - ms(b.inizio)) / 60000);

export const eAperta = (a) => a.tipo === 'attivita' && !['completata', 'annullata'].includes(a.stato);

/** Blocchi ancora davanti a noi (scritti o in attesa di scrittura). */
export function blocchiFuturi(blocchi, adesso = new Date()) {
  return blocchi.filter(
    (b) => ['in_calendario', 'da_scrivere'].includes(b.stato) && ms(b.fine) > ms(adesso),
  );
}

/** Blocchi terminati per i quali manca la conferma di Nico. */
export function blocchiDaConfermare(blocchi, adesso = new Date()) {
  return blocchi.filter((b) => b.stato === 'in_calendario' && ms(b.fine) <= ms(adesso));
}

/** Minuti effettivi: solo registrazioni confermate. Nessuna registrazione = null, non zero. */
export function minutiEffettivi(registrazioni) {
  if (!registrazioni.length) return null;
  return registrazioni.reduce((s, r) => s + r.minuti, 0);
}

/**
 * Stato di pianificazione di un'attività, ricavato dai suoi blocchi:
 * 'assente' (nessun blocco futuro), 'parziale' (i blocchi futuri non coprono
 * la durata prevista residua), 'completa'.
 */
export function pianificazione(attivita, blocchi, registrazioni, adesso = new Date()) {
  const futuri = blocchiFuturi(blocchi, adesso);
  if (!futuri.length) return 'assente';
  if (attivita.durata_prevista_min == null) return 'completa';
  const residuo = attivita.durata_prevista_min - (minutiEffettivi(registrazioni) || 0);
  const pianificati = futuri.reduce((s, b) => s + minutiBlocco(b), 0);
  return pianificati >= residuo ? 'completa' : 'parziale';
}

/** Vero se l'attività va mostrata in "Da pianificare". */
export function eDaPianificare(attivita, blocchi, registrazioni, adesso = new Date()) {
  return eAperta(attivita) && pianificazione(attivita, blocchi, registrazioni, adesso) === 'assente';
}

/** Minuti di blocchi (scritti o svolti) che cadono nella settimana di Roma che contiene `giorno`. */
export function minutiNellaSettimana(blocchi, giorno) {
  const lunedi = lunediDi(giorno);
  const da = ms(istanteDi(lunedi)), a = ms(istanteDi(aggiungiGiorni(lunedi, 7)));
  return blocchi
    .filter((b) => ['in_calendario', 'da_scrivere', 'svolto'].includes(b.stato))
    .filter((b) => ms(b.inizio) >= da && ms(b.inizio) < a)
    .reduce((s, b) => s + minutiBlocco(b), 0);
}

/**
 * Riepilogo del tempo per un insieme di attività.
 * previsti: somma delle durate previste indicate (le attività senza durata sono contate a parte).
 * effettivi: somma delle registrazioni confermate, null se non ce ne sono.
 */
export function riepilogoTempo(attivita, blocchi, registrazioni) {
  const vive = attivita.filter((a) => a.tipo === 'attivita' && a.stato !== 'annullata');
  const ids = new Set(vive.map((a) => a.id));
  const conDurata = vive.filter((a) => a.durata_prevista_min != null);
  const reg = registrazioni.filter((r) => ids.has(r.attivita_id));
  return {
    attivita: vive.length,
    senzaDurata: vive.length - conDurata.length,
    previsti: conDurata.length ? conDurata.reduce((s, a) => s + a.durata_prevista_min, 0) : null,
    pianificati: blocchi
      .filter((b) => ids.has(b.attivita_id) && ['in_calendario', 'da_scrivere', 'svolto'].includes(b.stato))
      .reduce((s, b) => s + minutiBlocco(b), 0),
    effettivi: minutiEffettivi(reg),
  };
}

export { minutiBlocco, giornoRoma };
