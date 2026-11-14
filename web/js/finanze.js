// Regole delle finanze: somme per mese e per gestione, crescita, impegni fissi, obiettivi.
// Funzioni pure. Un dato mancante resta `null`: non diventa mai zero.
// Gli effettivi e i previsti non si sommano mai fra loro.

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const centesimi = (v) => Math.round(Number(v || 0) * 100);
const VUOTO = () => ({ entrate: 0, uscite: 0, entratePreviste: 0, uscitePreviste: 0, righe: 0 });

/** Importo in euro scritto all'italiana. `null` resta «non indicato». */
export function euro(v, mancante = 'non indicato') {
  if (v == null || v === '') return mancante;
  return `${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })} €`;
}

export const chiaveMese = (anno, mese) => `${anno}-${String(mese).padStart(2, '0')}`;

/** Gestioni presenti nei movimenti, nell'ordine in cui compaiono nei fogli. */
export function gestioniDi(movimenti) {
  return [...new Set(movimenti.map((m) => m.gestione))];
}

/**
 * Somme per mese ('AAAA-MM'). Con `gestioni` si contano solo quelle indicate (elenco vuoto o assente = tutte).
 * Restituisce una Map: mese → { entrate, uscite, entratePreviste, uscitePreviste, righe } in euro.
 */
export function sommePerMese(movimenti, gestioni = null) {
  const solo = gestioni && gestioni.length ? new Set(gestioni) : null;
  const somme = new Map();
  for (const m of movimenti) {
    if (solo && !solo.has(m.gestione)) continue;
    const k = chiaveMese(m.anno, m.mese);
    if (!somme.has(k)) somme.set(k, VUOTO());
    const s = somme.get(k);
    s.righe++;
    if (m.previsto) { s.entratePreviste += centesimi(m.entrata); s.uscitePreviste += centesimi(m.uscita); }
    else { s.entrate += centesimi(m.entrata); s.uscite += centesimi(m.uscita); }
  }
  for (const s of somme.values()) for (const c of ['entrate', 'uscite', 'entratePreviste', 'uscitePreviste']) s[c] /= 100;
  return somme;
}

/** Somma di più mesi (per esempio un anno intero). */
export function totale(somme, filtro = () => true) {
  const t = VUOTO();
  for (const [k, s] of somme) {
    if (!filtro(k)) continue;
    for (const c of Object.keys(t)) t[c] = (centesimi(t[c]) + centesimi(s[c])) / 100;
  }
  t.righe = Math.round(t.righe);
  return t;
}

/** Variazione percentuale rispetto al valore precedente. `null` se manca il termine di confronto. */
export function crescita(attuale, precedente) {
  if (attuale == null || precedente == null || precedente === 0) return null;
  return Math.round(((attuale - precedente) / precedente) * 1000) / 10;
}

/** Mese precedente di 'AAAA-MM'. */
export function mesePrima(k) {
  const [a, m] = k.split('-').map(Number);
  return m === 1 ? chiaveMese(a - 1, 12) : chiaveMese(a, m - 1);
}

/**
 * Media delle entrate effettive degli ultimi `n` mesi conclusi prima di `meseCorrente` ('AAAA-MM')
 * fra quelli che hanno almeno una riga letta. `null` se non ce n'è nessuno.
 */
export function mediaEntrate(movimenti, gestioni, meseCorrente, n = 3) {
  const somme = sommePerMese(movimenti, gestioni);
  const mesi = [...somme.keys()].filter((k) => k < meseCorrente).sort().slice(-n);
  if (!mesi.length) return null;
  const tot = mesi.reduce((t, k) => t + centesimi(somme.get(k).entrate), 0);
  return { media: Math.round(tot / mesi.length) / 100, mesi };
}

/** Movimenti segnati «Previsto» con una data già passata: da incassare, da pagare o da aggiornare nel foglio. */
export function previstiScaduti(movimenti, oggi) {
  return movimenti.filter((m) => m.previsto && m.data && m.data < oggi).sort((a, b) => a.data.localeCompare(b.data));
}

/** La ricorrenza vale nel mese indicato? (mese = 'AAAA-MM') */
export function ricorreNel(r, mese) {
  if (r.archiviata) return false;
  if (r.inizio && r.inizio.slice(0, 7) > mese) return false;
  if (r.fine && r.fine.slice(0, 7) < mese) return false;
  return r.cadenza === 'mensile' || Number(mese.slice(5)) === r.mese;
}

/** Quanto pesa al mese una ricorrenza: le annuali divise per dodici. */
export const quotaMensile = (r) => (r.cadenza === 'annuale' ? centesimi(r.importo) / 12 / 100 : Number(r.importo));

/**
 * Impegni fissi al mese: uscite ricorrenti attive più rate dei debiti non estinti.
 * `rateMancanti` conta i debiti senza rata indicata: il totale in quel caso è parziale.
 */
export function impegniMensili(ricorrenze, debiti) {
  const attive = ricorrenze.filter((r) => !r.archiviata && r.verso === 'uscita');
  const aperti = debiti.filter((d) => !d.estinto);
  const ricorrenti = Math.round(attive.reduce((t, r) => t + quotaMensile(r) * 100, 0)) / 100;
  const rate = aperti.reduce((t, d) => t + centesimi(d.rata), 0) / 100;
  return {
    ricorrenti, rate, totale: (centesimi(ricorrenti) + centesimi(rate)) / 100,
    rateMancanti: aperti.filter((d) => d.rata == null).length,
  };
}

/** Totale dei debiti aperti. `residuiMancanti` conta quelli senza residuo indicato. */
export function totaleDebiti(debiti) {
  const aperti = debiti.filter((d) => !d.estinto);
  const noti = aperti.filter((d) => d.residuo != null);
  return {
    aperti: aperti.length, residuiMancanti: aperti.length - noti.length,
    residuo: noti.length ? noti.reduce((t, d) => t + centesimi(d.residuo), 0) / 100 : null,
  };
}

/**
 * I due ordini di estinzione più diffusi. Si calcolano solo sui debiti che hanno il dato necessario:
 * «dal più piccolo» serve il residuo, «dal più caro» serve il tasso. Gli altri finiscono in `senzaDato`.
 */
export function ordiniDiEstinzione(debiti) {
  const aperti = debiti.filter((d) => !d.estinto);
  return {
    dalPiuPiccolo: aperti.filter((d) => d.residuo != null).sort((a, b) => a.residuo - b.residuo),
    senzaResiduo: aperti.filter((d) => d.residuo == null),
    dalPiuCaro: aperti.filter((d) => d.tasso != null).sort((a, b) => b.tasso - a.tasso),
    senzaTasso: aperti.filter((d) => d.tasso == null),
  };
}

/** Stato di un obiettivo sulle entrate mensili: media recente, quanto manca, mesi che restano. */
export function statoObiettivo(ob, movimenti, meseCorrente) {
  const mesiRestanti = ob.entro ? Math.max(0, (Number(ob.entro.slice(0, 4)) - Number(meseCorrente.slice(0, 4))) * 12
    + Number(ob.entro.slice(5, 7)) - Number(meseCorrente.slice(5, 7))) : null;
  if (ob.tipo === 'importo') {
    const raggiunto = ob.raggiunto == null ? null : Number(ob.raggiunto);
    return { attuale: raggiunto, manca: raggiunto == null ? null : Math.max(0, (centesimi(ob.importo) - centesimi(raggiunto)) / 100), percento: raggiunto == null ? null : Math.min(100, Math.round((raggiunto / ob.importo) * 100)), mesiRestanti, mesi: [] };
  }
  const m = mediaEntrate(movimenti, ob.gestioni, meseCorrente);
  if (!m) return { attuale: null, manca: null, percento: null, mesiRestanti, mesi: [] };
  return {
    attuale: m.media, manca: Math.max(0, (centesimi(ob.importo) - centesimi(m.media)) / 100),
    percento: Math.min(100, Math.round((m.media / ob.importo) * 100)), mesiRestanti, mesi: m.mesi,
  };
}

/** Legge un importo scritto all'italiana («1.234,56» o «1234.56»). `null` se vuoto o non valido. */
export function leggiImporto(testo) {
  const t = String(testo ?? '').trim().replace(/[€\s]/g, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}
