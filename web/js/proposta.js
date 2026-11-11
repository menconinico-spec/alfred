// Proposta di blocco: regole fisse, nessuna intelligenza artificiale.
// Cerca i primi spazi liberi dentro le fasce di lavoro, evitando gli orari occupati.

import { giornoRoma, aggiungiGiorni, giornoSettimana, istanteDi } from './fuso.js';

/**
 * Fasce in cui Alfred può proporre un blocco, per giorno della settimana
 * (0 = domenica). Derivate da routine_e_calendario_alfred.md: pranzo 13:15–14:30
 * e spazi protetti esclusi. Una scelta manuale può sempre uscire da queste fasce.
 */
export const FASCE = {
  0: [],
  1: [['09:00', '13:15'], ['14:30', '17:00']],
  2: [['11:00', '13:15'], ['14:30', '19:00']],
  3: [['09:00', '13:15'], ['14:30', '18:30']],
  4: [['09:00', '13:15'], ['14:30', '19:00']],
  5: [['11:00', '13:15'], ['14:30', '18:30']],
  6: [['10:00', '13:00'], ['14:30', '18:00']],
};

const ms = (x) => (x instanceof Date ? x.getTime() : new Date(x).getTime());

/** Ordina e fonde intervalli sovrapposti. Restituisce [{inizio, fine}] in millisecondi. */
export function unisciOccupati(intervalli) {
  const ordinati = intervalli
    .map((i) => ({ inizio: ms(i.inizio), fine: ms(i.fine) }))
    .filter((i) => i.fine > i.inizio)
    .sort((a, b) => a.inizio - b.inizio);
  const uniti = [];
  for (const i of ordinati) {
    const ultimo = uniti[uniti.length - 1];
    if (ultimo && i.inizio <= ultimo.fine) ultimo.fine = Math.max(ultimo.fine, i.fine);
    else uniti.push({ ...i });
  }
  return uniti;
}

/** Vero se [inizio, fine) non tocca nessun intervallo occupato. */
export function eLibero(inizio, fine, occupati) {
  const a = ms(inizio), b = ms(fine);
  return !occupati.some((o) => ms(o.inizio) < b && ms(o.fine) > a);
}

/** Vero se [inizio, fine) sta tutto dentro una fascia di lavoro. */
export function dentroLeFasce(inizio, fine, fasce = FASCE) {
  const giorno = giornoRoma(inizio);
  return (fasce[giornoSettimana(giorno)] || []).some(
    ([da, a]) => ms(istanteDi(giorno, da)) <= ms(inizio) && ms(fine) <= ms(istanteDi(giorno, a)),
  );
}

/**
 * Propone fino a `quante` collocazioni, al massimo una per giorno,
 * partendo da `adesso` e guardando avanti di `giorni` giorni.
 */
export function proponiBlocchi({
  durataMin, occupati = [], fasce = FASCE, adesso = new Date(),
  giorni = 14, quante = 3, passoMin = 15,
}) {
  const occ = unisciOccupati(occupati);
  const durata = durataMin * 60000, passo = passoMin * 60000;
  const ora = ms(adesso);
  const proposte = [];
  let giorno = giornoRoma(adesso);
  for (let n = 0; n < giorni && proposte.length < quante; n++, giorno = aggiungiGiorni(giorno, 1)) {
    let trovata = null;
    for (const [da, a] of fasce[giornoSettimana(giorno)] || []) {
      const fineFascia = ms(istanteDi(giorno, a));
      let t = ms(istanteDi(giorno, da));
      if (t < ora) t += Math.ceil((ora - t) / passo) * passo;
      for (; t + durata <= fineFascia; t += passo) {
        if (eLibero(t, t + durata, occ)) { trovata = t; break; }
      }
      if (trovata != null) break;
    }
    if (trovata != null) proposte.push({ inizio: new Date(trovata), fine: new Date(trovata + durata) });
  }
  return proposte;
}
