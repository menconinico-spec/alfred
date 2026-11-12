// Regole delle abitudini: quando un'abitudine è prevista, quando è fatta, serie e percentuali.
// Funzioni pure: lavorano su giorni scritti 'AAAA-MM-GG' e non leggono l'orologio.

import { aggiungiGiorni, giornoSettimana, lunediDi } from './fuso.js';

export const MOMENTI = [['mattina', 'Mattina'], ['pomeriggio', 'Pomeriggio'], ['sera', 'Sera'], ['qualsiasi', 'In qualsiasi momento']];
export const GIORNI = [[1, 'lun'], [2, 'mar'], [3, 'mer'], [4, 'gio'], [5, 'ven'], [6, 'sab'], [7, 'dom']];

/** 1 = lunedì … 7 = domenica. */
export const giornoIso = (giorno) => giornoSettimana(giorno) || 7;

/** Registrazioni di un'abitudine, per giorno. */
export const perGiorno = (registrazioni, abitudineId) =>
  new Map(registrazioni.filter((r) => r.abitudine_id === abitudineId).map((r) => [r.giorno, r]));

/** L'abitudine è in calendario in quel giorno? Quelle «a volte a settimana» lo sono ogni giorno. */
export function prevista(ab, giorno) {
  if (giorno < ab.inizio) return false;
  return ab.frequenza === 'volte_settimana' || ab.giorni.includes(giornoIso(giorno));
}

/** Fatta: spunta presente, oppure quantità raggiunta. */
export function fatta(ab, registrazione) {
  if (!registrazione) return false;
  return ab.obiettivo === 'quantita' ? Number(registrazione.valore) >= Number(ab.quantita) : true;
}

/** Quante volte è stata fatta nella settimana che inizia il lunedì indicato. */
export function fatteNellaSettimana(ab, mappa, lunedi) {
  let n = 0;
  for (let i = 0; i < 7; i++) if (fatta(ab, mappa.get(aggiungiGiorni(lunedi, i)))) n++;
  return n;
}

/**
 * Serie attuale e serie migliore.
 * Abitudini a giorni: giorni previsti consecutivi fatti. Abitudini a volte a settimana: settimane consecutive riuscite.
 * Il giorno (o la settimana) in corso, se non ancora fatto, non interrompe la serie.
 */
export function serie(ab, mappa, oggi) {
  const esiti = []; // dal più vecchio al più recente: true, false, oppure null per «in corso»
  if (ab.frequenza === 'volte_settimana') {
    const corrente = lunediDi(oggi);
    for (let l = lunediDi(ab.inizio); l <= corrente; l = aggiungiGiorni(l, 7)) {
      const riuscita = fatteNellaSettimana(ab, mappa, l) >= ab.volte_settimana;
      esiti.push(riuscita ? true : (l === corrente ? null : false));
    }
  } else {
    for (let g = ab.inizio; g <= oggi; g = aggiungiGiorni(g, 1)) {
      if (!prevista(ab, g)) continue;
      const ok = fatta(ab, mappa.get(g));
      esiti.push(ok ? true : (g === oggi ? null : false));
    }
  }
  let migliore = 0, corsa = 0;
  for (const e of esiti) {
    if (e === true) { corsa++; migliore = Math.max(migliore, corsa); } else if (e === false) corsa = 0;
  }
  return { attuale: corsa, migliore, unita: ab.frequenza === 'volte_settimana' ? 'settimane' : 'giorni' };
}

/**
 * Andamento in un mese ('AAAA-MM'), fino a oggi compreso.
 * Per le abitudini a giorni: fatte su previste. Per quelle a volte a settimana le previste non esistono: resta vuoto.
 */
export function andamentoMese(ab, mappa, mese, oggi) {
  let fatte = 0, previste = 0;
  for (let g = `${mese}-01`; g.startsWith(mese) && g <= oggi; g = aggiungiGiorni(g, 1)) {
    if (fatta(ab, mappa.get(g))) fatte++;
    if (ab.frequenza === 'giorni' && prevista(ab, g)) previste++;
  }
  return { fatte, previste: ab.frequenza === 'giorni' ? previste : null };
}

/** Numero totale di volte in cui è stata fatta. */
export const totaleFatte = (ab, mappa) => [...mappa.values()].filter((r) => fatta(ab, r)).length;

/** Descrizione breve della frequenza. */
export function frequenzaTesto(ab) {
  if (ab.frequenza === 'volte_settimana') return ab.volte_settimana === 7 ? 'ogni giorno' : `${ab.volte_settimana} volte a settimana`;
  if (ab.giorni.length === 7) return 'ogni giorno';
  if (ab.giorni.length === 5 && [1, 2, 3, 4, 5].every((g) => ab.giorni.includes(g))) return 'dal lunedì al venerdì';
  return GIORNI.filter(([n]) => ab.giorni.includes(n)).map(([, t]) => t).join(', ');
}
