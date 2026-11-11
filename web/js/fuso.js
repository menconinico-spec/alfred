// Date e orari nel fuso Europe/Rome, ora legale compresa.
// Nell'archivio gli istanti sono assoluti; qui si convertono da e verso l'ora di Roma.

export const FUSO = 'Europe/Rome';

const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Scompone un istante nei valori letti su un orologio di Roma. */
export function partiRoma(istante) {
  const p = {};
  for (const { type, value } of formato.formatToParts(new Date(istante))) p[type] = value;
  return {
    anno: +p.year, mese: +p.month, giorno: +p.day,
    ora: +p.hour, minuto: +p.minute, secondo: +p.second,
  };
}

/** Minuti di differenza fra Roma e l'ora universale in quell'istante (60 d'inverno, 120 d'estate). */
export function scartoMinuti(istante) {
  const d = new Date(istante);
  const p = partiRoma(d);
  const comeUniversale = Date.UTC(p.anno, p.mese - 1, p.giorno, p.ora, p.minuto, p.secondo);
  return Math.round((comeUniversale - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/** Dall'ora di Roma all'istante assoluto. */
export function daRoma(anno, mese, giorno, ora = 0, minuto = 0) {
  const ipotesi = Date.UTC(anno, mese - 1, giorno, ora, minuto);
  let d = new Date(ipotesi - scartoMinuti(ipotesi) * 60000);
  d = new Date(ipotesi - scartoMinuti(d) * 60000);
  return d;
}

const due = (n) => String(n).padStart(2, '0');

/** Giorno di Roma come testo 'AAAA-MM-GG'. */
export function giornoRoma(istante) {
  const p = partiRoma(istante);
  return `${p.anno}-${due(p.mese)}-${due(p.giorno)}`;
}

/** Somma giorni di calendario a un testo 'AAAA-MM-GG'. */
export function aggiungiGiorni(giorno, n) {
  const [a, m, g] = giorno.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g + n));
  return `${d.getUTCFullYear()}-${due(d.getUTCMonth() + 1)}-${due(d.getUTCDate())}`;
}

/** 0 = domenica … 6 = sabato, per un testo 'AAAA-MM-GG'. */
export function giornoSettimana(giorno) {
  const [a, m, g] = giorno.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, g)).getUTCDay();
}

/** Lunedì della settimana che contiene il giorno dato. */
export function lunediDi(giorno) {
  const gs = giornoSettimana(giorno);
  return aggiungiGiorni(giorno, gs === 0 ? -6 : 1 - gs);
}

/** Istante di un giorno di Roma a una certa ora 'HH:MM'. */
export function istanteDi(giorno, oraMinuti = '00:00') {
  const [a, m, g] = giorno.split('-').map(Number);
  const [h, min] = oraMinuti.split(':').map(Number);
  return daRoma(a, m, g, h, min);
}

export function oraTesto(istante) {
  const p = partiRoma(istante);
  return `${due(p.ora)}:${due(p.minuto)}`;
}

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** 'mer 11 nov' a partire da un testo 'AAAA-MM-GG'. */
export function giornoTesto(giorno) {
  const [, m, g] = giorno.split('-').map(Number);
  return `${GIORNI[giornoSettimana(giorno)]} ${g} ${MESI[m - 1]}`;
}

/** 'mer 11 nov, 10:00–11:00' */
export function intervalloTesto(inizio, fine) {
  const g1 = giornoRoma(inizio), g2 = giornoRoma(fine);
  const coda = g1 === g2 ? oraTesto(fine) : `${giornoTesto(g2)} ${oraTesto(fine)}`;
  return `${giornoTesto(g1)}, ${oraTesto(inizio)}–${coda}`;
}

export function dataOraTesto(istante) {
  return `${giornoTesto(giornoRoma(istante))}, ${oraTesto(istante)}`;
}

/** Valore per un campo data-e-ora del modulo, letto come ora di Roma. */
export function perCampo(istante) {
  const p = partiRoma(istante);
  return `${p.anno}-${due(p.mese)}-${due(p.giorno)}T${due(p.ora)}:${due(p.minuto)}`;
}

/** Dal campo data-e-ora del modulo (ora di Roma) all'istante assoluto. */
export function daCampo(testo) {
  const [giorno, ora] = testo.split('T');
  return istanteDi(giorno, ora.slice(0, 5));
}

/** '1 h 30 min' */
export function durataTesto(minuti) {
  if (minuti == null) return '—';
  const h = Math.floor(minuti / 60), m = Math.round(minuti % 60);
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}
