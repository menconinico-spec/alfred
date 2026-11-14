// Finanze: panoramica dei fogli letti, conti, ricorrenti (previsioni), debiti, percorso a tappe.
// I movimenti arrivano dai fogli Excel tramite il comando /finanze: qui si guardano, non si modificano.

import { h, apriFinestra, conferma, avviso, riga } from '../ui.js';
import { S, crea, modifica, togli, prossimaPosizione } from '../archivio.js';
import { giornoRoma, giornoTesto, dataOraTesto } from '../fuso.js';
import {
  MESI, euro, chiaveMese, gestioniDi, sommePerMese, totale, crescita, mesePrima, previstiScaduti, quotaMensile,
  impegniMensili, totaleDebiti, ordiniDiEstinzione, statoObiettivo, leggiImporto,
} from '../finanze.js';
import { TAPPE, STATI_TAPPA, AVVERTENZA, NON_USATI } from '../finanze_percorso.js';

const SCHEDE = [['panoramica', 'Panoramica'], ['conti', 'Conti'], ['ricorrenti', 'Ricorrenti'], ['debiti', 'Debiti'], ['percorso', 'Percorso']];
let annoScelto = null, gestioneScelta = '';

/** Giorno scritto per esteso, sempre con l'anno: qui le date arrivano a più anni di distanza. */
const dataTesto = (g) => `${giornoTesto(g)} ${g.slice(0, 4)}`;
const ridisegna = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
const numero = (v) => (v == null ? '' : String(Number(v)).replace('.', ','));
const num = (testo, classe = '') => h('td', { class: `num ${classe}` }, testo);
const vuoto = (testo) => h('p', { class: 'nota' }, testo);

/**
 * Modulo generico. `campi`: [{ k, etichetta, tipo, opzioni, obbligatorio, aiuto, segnaposto, intero }]
 * tipi: 'testo', 'importo', 'data', 'scelta', 'area'. Per le scelte: `intero`, `booleano`, `nulloSeVuoto` dicono come salvare il valore;
 * `elenco` trasforma un testo separato da virgole in un elenco. Un importo lasciato vuoto resta vuoto, non diventa zero.
 */
function apriModulo({ titolo, campi, esistente, tabella, predefiniti = {}, eliminabile = true }) {
  const c = {};
  for (const campo of campi) {
    const v = esistente ? esistente[campo.k] : predefiniti[campo.k];
    if (campo.tipo === 'scelta') c[campo.k] = h('select', {}, campo.opzioni.map(([val, nome]) => h('option', { value: val, selected: String(v ?? '') === String(val) }, nome)));
    else if (campo.tipo === 'area') { c[campo.k] = h('textarea', { rows: 2 }); c[campo.k].value = v ?? ''; }
    else if (campo.tipo === 'data') c[campo.k] = h('input', { type: 'date', value: v ?? '' });
    else if (campo.tipo === 'importo') c[campo.k] = h('input', { type: 'text', inputmode: 'decimal', value: numero(v), placeholder: campo.segnaposto ?? '0,00', class: 'corto', name: campo.k });
    else c[campo.k] = h('input', { type: 'text', value: Array.isArray(v) ? v.join(', ') : (v ?? ''), placeholder: campo.segnaposto ?? '', name: campo.k });
    if (campo.obbligatorio) c[campo.k].required = true;
  }
  const f = apriFinestra({
    titolo,
    corpo: (finestra) => h('form', { class: 'modulo', onsubmit: async (e) => {
      e.preventDefault();
      const valori = {};
      for (const campo of campi) {
        const t = c[campo.k].value.trim();
        if (campo.tipo === 'importo') {
          const n = leggiImporto(t);
          if (t && n == null) { avviso(`${campo.etichetta}: scrivi un numero, per esempio 120,50.`, 'errore'); return; }
          if (n != null && n < 0) { avviso(`${campo.etichetta}: l'importo non può essere negativo.`, 'errore'); return; }
          if (campo.obbligatorio && !(n > 0)) { avviso(`${campo.etichetta}: serve un importo maggiore di zero.`, 'errore'); return; }
          valori[campo.k] = n;
        } else if (campo.tipo === 'data') valori[campo.k] = t || null;
        else if (campo.booleano) valori[campo.k] = t === 'true';
        else if (campo.nulloSeVuoto) valori[campo.k] = t || null;
        else if (campo.intero) valori[campo.k] = t ? Number(t) : null;
        else if (campo.elenco) valori[campo.k] = t.split(',').map((x) => x.trim()).filter(Boolean);
        else valori[campo.k] = t;
        if (campo.obbligatorio && (valori[campo.k] === '' || valori[campo.k] == null)) { avviso(`${campo.etichetta}: campo obbligatorio.`, 'errore'); return; }
      }
      try {
        if (esistente) await modifica(tabella, esistente.id, valori);
        else await crea(tabella, { ...valori, posizione: prossimaPosizione(S[tabella]) });
        finestra.chiudi();
      } catch (err) { avviso(err.message, 'errore'); }
    } },
      campi.map((campo) => riga(campo.etichetta, c[campo.k], campo.aiuto)),
      h('div', { class: 'azioni' },
        esistente && eliminabile ? h('button', { type: 'button', class: 'pericolo-tenue', onclick: async () => {
          if (await conferma(`Eliminare «${esistente.nome}»? Non si può annullare.`, 'Elimina', true)) {
            try { await togli(tabella, esistente.id); finestra.chiudi(); } catch (err) { avviso(err.message, 'errore'); }
          }
        } }, 'Elimina') : null,
        h('span', { class: 'spazio' }),
        h('button', { type: 'button', onclick: () => finestra.chiudi() }, 'Annulla'),
        h('button', { type: 'submit', class: 'primario' }, esistente ? 'Salva' : 'Aggiungi'))),
  });
  setTimeout(() => Object.values(c)[0]?.focus(), 50);
  return f;
}

const elencoGestioni = () => [...new Set([...gestioniDi(S.fin_movimenti), ...S.fin_ricorrenze.map((r) => r.gestione).filter(Boolean)])];
const aiutoGestioni = () => (elencoGestioni().length ? `Come nei fogli: ${elencoGestioni().join(', ')}.` : 'Il nome della gestione come è scritto nei fogli.');

// ---------- panoramica ----------

function panoramica() {
  const oggi = giornoRoma(new Date()), meseCorrente = oggi.slice(0, 7);
  const movimenti = S.fin_movimenti;
  const ultima = [...S.fin_letture].sort((a, b) => b.letto_il.localeCompare(a.letto_il))[0];
  const anni = [...new Set(movimenti.map((m) => m.anno))].sort();
  if (!anni.includes(annoScelto)) annoScelto = anni.includes(Number(oggi.slice(0, 4))) ? Number(oggi.slice(0, 4)) : (anni[anni.length - 1] ?? null);
  const gestioni = gestioniDi(movimenti);
  if (gestioneScelta && !gestioni.includes(gestioneScelta)) gestioneScelta = '';
  const somme = sommePerMese(movimenti, gestioneScelta ? [gestioneScelta] : null);
  const anno = totale(somme, (k) => k.startsWith(`${annoScelto}-`));
  const scaduti = previstiScaduti(movimenti, oggi).filter((m) => !gestioneScelta || m.gestione === gestioneScelta);
  const impegni = impegniMensili(S.fin_ricorrenze, S.fin_debiti);

  const lettura = h('section', { class: 'riquadro' },
    h('h2', {}, 'Fogli «Flusso di cassa»'),
    ultima
      ? h('p', {}, `Ultima lettura: ${dataOraTesto(ultima.letto_il)} · ${ultima.righe} ${ultima.righe === 1 ? 'riga' : 'righe'} con importo · ${ultima.file.join(', ') || 'nessun file'}.`)
      : h('p', {}, 'I fogli non sono ancora stati letti.'),
    h('p', { class: 'nota' }, 'Per leggerli di nuovo: apri Claude Code sul Mac e scrivi /finanze. I numeri qui sotto restano quelli dell\'ultima lettura.'),
    ultima?.avvisi?.length ? h('details', {}, h('summary', { class: 'nota allerta' }, `${ultima.avvisi.length} ${ultima.avvisi.length === 1 ? 'avviso' : 'avvisi'} dall'ultima lettura`),
      h('ul', { class: 'cronologia' }, ultima.avvisi.map((a) => h('li', {}, a)))) : null);

  const obiettivi = h('section', { class: 'riquadro' },
    h('header', { class: 'testata' }, h('h2', {}, 'Obiettivi'),
      h('button', { class: 'piccolo', onclick: () => moduloObiettivo(null) }, '+ Obiettivo')),
    S.fin_obiettivi.length ? S.fin_obiettivi.map((ob) => {
      const s = statoObiettivo(ob, movimenti, meseCorrente);
      const mensile = ob.tipo === 'entrate_mensili';
      return h('button', { class: 'voce-fin', onclick: () => moduloObiettivo(ob) },
        h('div', { class: 'voce-testa' }, h('strong', {}, ob.nome),
          h('span', {}, `${euro(ob.importo)}${mensile ? ' al mese' : ''}${ob.entro ? ` entro il ${dataTesto(ob.entro)}` : ''}`)),
        h('div', { class: 'barra', role: 'img', 'aria-label': s.percento == null ? 'dato mancante' : `${s.percento}%` }, h('span', { style: `width:${s.percento ?? 0}%` })),
        h('small', {}, s.attuale == null
          ? (mensile ? 'Dato mancante: nessun mese concluso letto dai fogli per queste gestioni.' : 'Dato mancante: scrivi quanto c\'è oggi.')
          : (mensile
            ? `Media entrate effettive ${s.mesi.length === 1 ? 'dell\'ultimo mese concluso' : `degli ultimi ${s.mesi.length} mesi conclusi`}: ${euro(s.attuale)} (${s.percento}%). Mancano ${euro(s.manca)} al mese.`
            : `Oggi: ${euro(s.attuale)} (${s.percento}%). Mancano ${euro(s.manca)}.`),
        s.mesiRestanti != null ? ` Restano ${s.mesiRestanti} mesi.` : '',
        mensile ? ` Gestioni: ${ob.gestioni.length ? ob.gestioni.join(', ') : 'tutte'}.` : ''));
    }) : vuoto('Nessun obiettivo. Aggiungine uno con «+ Obiettivo».'));

  if (!movimenti.length) {
    return [lettura, obiettivi, h('section', { class: 'riquadro' }, h('h2', {}, 'Andamento'),
      vuoto('Nessun movimento letto dai fogli: non c\'è ancora nulla da mostrare. Un dato che manca qui resta vuoto, non diventa zero.'))];
  }

  const righeMesi = MESI.map((nome, i) => {
    const k = chiaveMese(annoScelto, i + 1), s = somme.get(k);
    if (!s) return h('tr', { class: 'tenue' }, h('td', {}, nome), h('td', { class: 'num', colspan: 6 }, 'nessuna riga'));
    const c = crescita(s.entrate, somme.get(mesePrima(k))?.entrate ?? null);
    const saldo = Math.round((s.entrate - s.uscite) * 100) / 100;
    return h('tr', {}, h('td', {}, nome, k === meseCorrente ? h('small', {}, ' (in corso)') : null),
      num(euro(s.entrate)), num(euro(s.uscite)), num(euro(saldo), saldo < 0 ? 'negativo' : ''),
      num(c == null ? '—' : `${c > 0 ? '+' : ''}${String(c).replace('.', ',')}%`, c != null && c < 0 ? 'negativo' : ''),
      num(s.entratePreviste ? euro(s.entratePreviste) : '—', 'previsto'), num(s.uscitePreviste ? euro(s.uscitePreviste) : '—', 'previsto'));
  });
  const saldoAnno = Math.round((anno.entrate - anno.uscite) * 100) / 100;

  const andamento = h('section', { class: 'riquadro' },
    h('header', { class: 'testata' }, h('h2', {}, `Andamento ${annoScelto}`),
      h('div', { class: 'azioni strette' },
        h('select', { 'aria-label': 'Anno', onchange: (e) => { annoScelto = Number(e.target.value); ridisegna(); } },
          anni.map((a) => h('option', { value: a, selected: a === annoScelto }, a))),
        h('select', { 'aria-label': 'Gestione', onchange: (e) => { gestioneScelta = e.target.value; ridisegna(); } },
          h('option', { value: '' }, 'Tutte le gestioni'), gestioni.map((g) => h('option', { value: g, selected: g === gestioneScelta }, g))))),
    h('div', { class: 'cifre' },
      h('div', { class: 'cifra' }, h('small', {}, 'Entrate effettive'), h('strong', {}, euro(anno.entrate))),
      h('div', { class: 'cifra' }, h('small', {}, 'Uscite effettive'), h('strong', {}, euro(anno.uscite))),
      h('div', { class: 'cifra' }, h('small', {}, 'Saldo effettivo'), h('strong', { class: saldoAnno < 0 ? 'negativo' : '' }, euro(saldoAnno)))),
    h('p', { class: 'nota' }, `Previsto e non ancora avvenuto, contato a parte: entrate ${euro(anno.entratePreviste)}, uscite ${euro(anno.uscitePreviste)}.`),
    h('div', { class: 'tabella-scorri' }, h('table', { class: 'tabella-fin' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Mese'), ['Entrate', 'Uscite', 'Saldo', 'Crescita entrate', 'Entrate previste', 'Uscite previste'].map((t) => h('th', { class: 'num' }, t)))),
      h('tbody', {}, righeMesi))),
    h('p', { class: 'nota' }, 'Crescita: entrate effettive rispetto al mese prima; «—» quando manca il termine di confronto. Gli spostamenti fra conti non vanno scritti nei fogli come entrate o uscite.'));

  const inRitardo = h('section', { class: 'riquadro' },
    h('h2', {}, `Previsti con data passata (${scaduti.length})`),
    scaduti.length ? h('div', { class: 'tabella-scorri' }, h('table', { class: 'tabella-fin' },
      h('thead', {}, h('tr', {}, ['Data', 'Gestione', 'Descrizione'].map((t) => h('th', {}, t)), h('th', { class: 'num' }, 'Da incassare'), h('th', { class: 'num' }, 'Da pagare'))),
      h('tbody', {}, scaduti.map((m) => h('tr', {}, h('td', {}, dataTesto(m.data)), h('td', {}, m.gestione), h('td', {}, m.descrizione || '—'),
        num(m.entrata == null ? '—' : euro(m.entrata)), num(m.uscita == null ? '—' : euro(m.uscita)))))))
      : vuoto('Nessuna riga segnata «Previsto» con una data già passata.'),
    scaduti.length ? h('p', { class: 'nota' }, 'Sono incassi da sollecitare, pagamenti da fare oppure righe da aggiornare nel foglio.') : null);

  const fissi = h('section', { class: 'riquadro' },
    h('h2', {}, 'Impegni fissi al mese (previsione)'),
    h('div', { class: 'cifre' },
      h('div', { class: 'cifra' }, h('small', {}, 'Spese ricorrenti'), h('strong', {}, euro(impegni.ricorrenti))),
      h('div', { class: 'cifra' }, h('small', {}, 'Rate dei debiti'), h('strong', {}, euro(impegni.rate))),
      h('div', { class: 'cifra' }, h('small', {}, 'Totale'), h('strong', {}, euro(impegni.totale)))),
    h('p', { class: 'nota' }, 'Viene da «Ricorrenti» e «Debiti»: è una previsione, non la prova di un pagamento. Le spese annuali contano per un dodicesimo.',
      impegni.rateMancanti ? ` Totale parziale: ${impegni.rateMancanti === 1 ? 'un debito non ha' : `${impegni.rateMancanti} debiti non hanno`} la rata indicata.` : ''));

  return [lettura, obiettivi, andamento, inRitardo, fissi];
}

function moduloObiettivo(ob) {
  apriModulo({
    titolo: ob ? 'Modifica obiettivo' : 'Nuovo obiettivo', tabella: 'fin_obiettivi', esistente: ob, predefiniti: { tipo: 'entrate_mensili', gestioni: [] },
    campi: [
      { k: 'nome', etichetta: 'Nome', tipo: 'testo', obbligatorio: true },
      { k: 'tipo', etichetta: 'Tipo', tipo: 'scelta', opzioni: [['entrate_mensili', 'Entrate al mese (confrontate con i fogli)'], ['importo', 'Cifra da raggiungere (aggiornata a mano)']] },
      { k: 'importo', etichetta: 'Importo (€)', tipo: 'importo', obbligatorio: true },
      { k: 'gestioni', etichetta: 'Gestioni contate', tipo: 'testo', elenco: true, aiuto: `Solo per le entrate al mese. Separate da virgola; vuoto = tutte. ${aiutoGestioni()}` },
      { k: 'raggiunto', etichetta: 'Quanto c\'è oggi (€)', tipo: 'importo', segnaposto: '', aiuto: 'Solo per la cifra da raggiungere. Vuoto = non indicato.' },
      { k: 'entro', etichetta: 'Entro il', tipo: 'data' },
      { k: 'nota', etichetta: 'Nota', tipo: 'area' },
    ],
  });
}

// ---------- conti ----------

function conti() {
  const attivi = S.fin_conti.filter((c) => !c.archiviato);
  const principali = attivi.filter((c) => !c.dentro_id || !attivi.some((x) => x.id === c.dentro_id));
  const voce = (c, dentro = false) => h('button', { class: `voce-fin ${dentro ? 'dentro' : ''}`, onclick: () => moduloConto(c) },
    h('div', { class: 'voce-testa' }, h('strong', {}, c.nome), h('span', {}, c.saldo == null ? 'saldo non indicato' : euro(c.saldo))),
    h('small', {}, c.tipo === 'tasca' ? 'Tasca' : 'Conto', c.scopo ? ` · ${c.scopo}` : '', c.saldo != null && c.saldo_al ? ` · saldo al ${dataTesto(c.saldo_al)}` : ''));
  return [h('section', { class: 'riquadro' },
    h('header', { class: 'testata' }, h('h2', {}, 'Conti e tasche'), h('button', { class: 'primario', onclick: () => moduloConto(null) }, '+ Conto')),
    attivi.length ? principali.map((c) => [voce(c), attivi.filter((x) => x.dentro_id === c.id).map((x) => voce(x, true))])
      : vuoto('Nessun conto. Aggiungi i tuoi conti e le tasche in cui dividi i soldi.'),
    h('p', { class: 'nota' }, 'Alfred non è collegato alle banche: i saldi li scrivi tu, con la data. Uno spostamento da un conto all\'altro non è una spesa né un\'entrata.'))];
}

function moduloConto(c) {
  const altri = S.fin_conti.filter((x) => x.id !== c?.id && x.tipo === 'conto' && !x.archiviato);
  apriModulo({
    titolo: c ? 'Modifica conto' : 'Nuovo conto', tabella: 'fin_conti', esistente: c, predefiniti: { tipo: 'conto' },
    campi: [
      { k: 'nome', etichetta: 'Nome', tipo: 'testo', obbligatorio: true },
      { k: 'tipo', etichetta: 'Tipo', tipo: 'scelta', opzioni: [['conto', 'Conto'], ['tasca', 'Tasca dentro un conto']] },
      { k: 'dentro_id', etichetta: 'Dentro il conto', tipo: 'scelta', opzioni: [['', '—'], ...altri.map((x) => [x.id, x.nome])], nulloSeVuoto: true, aiuto: 'Solo per le tasche.' },
      { k: 'scopo', etichetta: 'A cosa serve', tipo: 'testo' },
      { k: 'saldo', etichetta: 'Saldo (€)', tipo: 'importo', segnaposto: '', aiuto: 'Vuoto = non indicato.' },
      { k: 'saldo_al', etichetta: 'Saldo alla data', tipo: 'data' },
    ],
  });
}

// ---------- ricorrenti ----------

function ricorrenti() {
  const attive = S.fin_ricorrenze.filter((r) => !r.archiviata);
  const gruppo = (verso, titolo) => {
    const voci = attive.filter((r) => r.verso === verso);
    if (!voci.length) return null;
    const alMese = Math.round(voci.reduce((t, r) => t + quotaMensile(r) * 100, 0)) / 100;
    return h('section', { class: 'riquadro' },
      h('h2', {}, `${titolo}: ${euro(alMese)} al mese`),
      voci.map((r) => h('button', { class: 'voce-fin', onclick: () => moduloRicorrenza(r) },
        h('div', { class: 'voce-testa' }, h('strong', {}, r.nome),
          h('span', {}, `${euro(r.importo)} ${r.cadenza === 'annuale' ? `l'anno${r.mese ? `, a ${MESI[r.mese - 1].toLowerCase()}` : ''}` : 'al mese'}`)),
        h('small', {}, [r.gestione || 'gestione non indicata', r.categoria, r.giorno ? `giorno ${r.giorno}` : '', r.fine ? `fino al ${dataTesto(r.fine)}` : '', r.nota].filter(Boolean).join(' · ')))));
  };
  const archiviate = S.fin_ricorrenze.filter((r) => r.archiviata);
  return [
    h('section', { class: 'riquadro' },
      h('header', { class: 'testata' }, h('h2', {}, 'Spese ed entrate ricorrenti'), h('button', { class: 'primario', onclick: () => moduloRicorrenza(null) }, '+ Ricorrente')),
      h('p', { class: 'nota' }, 'Una ricorrenza è una previsione: dice cosa ti aspetti, non che il pagamento è avvenuto. I pagamenti avvenuti si scrivono nei fogli. Le rate dei finanziamenti stanno in «Debiti», non qui, per non contarle due volte.'),
      attive.length ? null : vuoto('Nessuna ricorrenza.')),
    gruppo('uscita', 'Uscite ricorrenti'), gruppo('entrata', 'Entrate ricorrenti'),
    archiviate.length ? h('section', { class: 'riquadro tenue' }, h('h2', {}, `Archiviate (${archiviate.length})`),
      h('div', { class: 'fila' }, archiviate.map((r) => h('button', { class: 'piccolo', onclick: () => moduloRicorrenza(r) }, r.nome)))) : null,
  ];
}

function moduloRicorrenza(r) {
  apriModulo({
    titolo: r ? 'Modifica ricorrenza' : 'Nuova ricorrenza', tabella: 'fin_ricorrenze', esistente: r, predefiniti: { verso: 'uscita', cadenza: 'mensile' },
    campi: [
      { k: 'nome', etichetta: 'Nome', tipo: 'testo', obbligatorio: true },
      { k: 'verso', etichetta: 'Tipo', tipo: 'scelta', opzioni: [['uscita', 'Uscita'], ['entrata', 'Entrata']] },
      { k: 'importo', etichetta: 'Importo (€)', tipo: 'importo', obbligatorio: true },
      { k: 'cadenza', etichetta: 'Cadenza', tipo: 'scelta', opzioni: [['mensile', 'Ogni mese'], ['annuale', 'Una volta l\'anno']] },
      { k: 'mese', etichetta: 'Mese (per le annuali)', tipo: 'scelta', intero: true, opzioni: [['', '—'], ...MESI.map((m, i) => [i + 1, m])] },
      { k: 'giorno', etichetta: 'Giorno del mese', tipo: 'scelta', intero: true, opzioni: [['', '—'], ...Array.from({ length: 31 }, (_, i) => [i + 1, i + 1])] },
      { k: 'gestione', etichetta: 'Gestione', tipo: 'testo', aiuto: aiutoGestioni() },
      { k: 'categoria', etichetta: 'Categoria', tipo: 'testo' },
      { k: 'fine', etichetta: 'Fino al (facoltativo)', tipo: 'data' },
      { k: 'nota', etichetta: 'Nota', tipo: 'area' },
      ...(r ? [{ k: 'archiviata', etichetta: 'Stato', tipo: 'scelta', booleano: true, opzioni: [['false', 'Attiva'], ['true', 'Archiviata']] }] : []),
    ],
  });
}

// ---------- debiti ----------

function debiti() {
  const aperti = S.fin_debiti.filter((d) => !d.estinto), estinti = S.fin_debiti.filter((d) => d.estinto);
  const t = totaleDebiti(S.fin_debiti), o = ordiniDiEstinzione(S.fin_debiti), imp = impegniMensili([], S.fin_debiti);
  const voce = (d) => h('button', { class: 'voce-fin', onclick: () => moduloDebito(d) },
    h('div', { class: 'voce-testa' }, h('strong', {}, d.nome), h('span', {}, d.residuo == null ? 'residuo non indicato' : `residuo ${euro(d.residuo)}`)),
    h('small', {}, [d.creditore, d.rata == null ? 'rata non indicata' : `rata ${euro(d.rata)} al mese`, d.tasso == null ? 'tasso non indicato' : `tasso ${numero(d.tasso)}%`,
      d.residuo != null && d.residuo_al ? `residuo al ${dataTesto(d.residuo_al)}` : '', d.ultima_rata ? `ultima rata ${dataTesto(d.ultima_rata)}` : '', d.nota].filter(Boolean).join(' · ')));
  const ordine = (titolo, lista, mancanti, cosaManca) => h('div', {},
    h('h3', {}, titolo),
    lista.length ? h('ol', { class: 'cronologia' }, lista.map((d) => h('li', {}, d.nome))) : null,
    mancanti.length ? h('p', { class: 'nota' }, `Fuori dall'ordine perché manca ${cosaManca}: ${mancanti.map((d) => d.nome).join(', ')}.`) : null);
  return [
    h('section', { class: 'riquadro' },
      h('header', { class: 'testata' }, h('h2', {}, 'Debiti'), h('button', { class: 'primario', onclick: () => moduloDebito(null) }, '+ Debito')),
      h('div', { class: 'cifre' },
        h('div', { class: 'cifra' }, h('small', {}, 'Debiti aperti'), h('strong', {}, t.aperti)),
        h('div', { class: 'cifra' }, h('small', {}, 'Residuo totale'), h('strong', {}, euro(t.residuo))),
        h('div', { class: 'cifra' }, h('small', {}, 'Rate al mese'), h('strong', {}, euro(imp.rate)))),
      t.residuiMancanti || imp.rateMancanti ? h('p', { class: 'nota allerta' },
        [t.residuiMancanti ? `Residuo non indicato per ${t.residuiMancanti} ${t.residuiMancanti === 1 ? 'debito' : 'debiti'}: il totale è parziale.` : '',
          imp.rateMancanti ? `Rata non indicata per ${imp.rateMancanti} ${imp.rateMancanti === 1 ? 'debito' : 'debiti'}.` : ''].filter(Boolean).join(' ')) : null,
      aperti.length ? aperti.map(voce) : vuoto('Nessun debito aperto.')),
    aperti.length > 1 ? h('section', { class: 'riquadro' },
      h('h2', {}, 'In che ordine chiuderli'),
      h('p', { class: 'nota' }, 'Due ordini diffusi, descritti nella tappa 2 del Percorso. Alfred li mostra con i dati che hai scritto; la scelta è tua. In entrambi si paga sempre almeno la rata su tutti.'),
      h('div', { class: 'due-ordini' },
        ordine('Dal residuo più piccolo', o.dalPiuPiccolo, o.senzaResiduo, 'il residuo'),
        ordine('Dal tasso più alto', o.dalPiuCaro, o.senzaTasso, 'il tasso'))) : null,
    estinti.length ? h('section', { class: 'riquadro tenue' }, h('h2', {}, `Estinti (${estinti.length})`),
      h('div', { class: 'fila' }, estinti.map((d) => h('button', { class: 'piccolo', onclick: () => moduloDebito(d) }, d.nome)))) : null,
  ];
}

function moduloDebito(d) {
  apriModulo({
    titolo: d ? 'Modifica debito' : 'Nuovo debito', tabella: 'fin_debiti', esistente: d,
    campi: [
      { k: 'nome', etichetta: 'Nome', tipo: 'testo', obbligatorio: true },
      { k: 'creditore', etichetta: 'A chi', tipo: 'testo' },
      { k: 'residuo', etichetta: 'Residuo da pagare (€)', tipo: 'importo', segnaposto: '', aiuto: 'Vuoto = non indicato.' },
      { k: 'residuo_al', etichetta: 'Residuo alla data', tipo: 'data' },
      { k: 'rata', etichetta: 'Rata al mese (€)', tipo: 'importo', segnaposto: '' },
      { k: 'tasso', etichetta: 'Tasso annuo (%)', tipo: 'importo', segnaposto: '', aiuto: 'Quello scritto nel contratto. Vuoto = non indicato.' },
      { k: 'ultima_rata', etichetta: 'Data dell\'ultima rata', tipo: 'data' },
      { k: 'nota', etichetta: 'Nota', tipo: 'area' },
      ...(d ? [{ k: 'estinto', etichetta: 'Stato', tipo: 'scelta', booleano: true, opzioni: [['false', 'Aperto'], ['true', 'Estinto']] }] : []),
    ],
  });
}

// ---------- percorso ----------

async function salvaImpostazioni(campi) {
  const imp = S.fin_impostazioni[0];
  try {
    if (imp) await modifica('fin_impostazioni', imp.id, campi);
    else await crea('fin_impostazioni', campi);
  } catch (e) { avviso(e.message, 'errore'); }
}

function percorso() {
  const imp = S.fin_impostazioni[0], stati = imp?.tappe || {};
  const fatte = TAPPE.filter((t) => stati[t.chiave] === 'fatta').length;
  const quota = h('input', { type: 'text', inputmode: 'decimal', class: 'corto', value: numero(imp?.accantonamento_percento), placeholder: 'non indicata', 'aria-label': 'Percentuale da accantonare' });
  const notaQuota = h('input', { type: 'text', value: imp?.accantonamento_nota ?? '', placeholder: 'Chi te l\'ha indicata e quando' });
  return [
    h('section', { class: 'riquadro' },
      h('h2', {}, `Percorso a tappe: ${fatte} su ${TAPPE.length} fatte`),
      h('p', { class: 'nota' }, AVVERTENZA),
      h('p', { class: 'nota' }, 'L\'ordine segue le urgenze che hai indicato. Lo stato di ogni tappa lo decidi tu. La tappa 5 procede insieme alle altre.')),
    TAPPE.map((t) => h('section', { class: `riquadro tappa ${stati[t.chiave] || 'da_iniziare'}` },
      h('header', { class: 'testata' }, h('h2', {}, t.titolo),
        h('select', { 'aria-label': `Stato: ${t.titolo}`, onchange: (e) => salvaImpostazioni({ tappe: { ...stati, [t.chiave]: e.target.value } }) },
          STATI_TAPPA.map(([k, nome]) => h('option', { value: k, selected: (stati[t.chiave] || 'da_iniziare') === k }, nome)))),
      h('p', {}, t.perche),
      h('h3', {}, 'Cosa fare'),
      h('ul', { class: 'cronologia' }, t.passi.map((p) => h('li', {}, p))),
      t.chiave === 'tasse' ? h('div', { class: 'griglia-campi quota' },
        riga('Percentuale di ogni incasso da accantonare (%)', quota, 'La indica il commercialista. Alfred non la calcola e non la ipotizza.'),
        riga('Nota', notaQuota),
        h('div', { class: 'azioni sinistra' }, h('button', { class: 'piccolo', onclick: async () => {
          const n = leggiImporto(quota.value);
          if (quota.value.trim() && (n == null || n < 0 || n > 100)) { avviso('Scrivi una percentuale fra 0 e 100.', 'errore'); return; }
          await salvaImpostazioni({ accantonamento_percento: n, accantonamento_nota: notaQuota.value.trim() });
          avviso('Percentuale salvata.');
        } }, 'Salva la percentuale'))) : null,
      h('details', {},
        h('summary', {}, 'Cosa dicono gli autori'),
        h('dl', { class: 'metodi' }, t.metodi.map((m) => [h('dt', {}, m.autori), h('dd', {}, m.testo)])),
        h('p', {}, h('strong', {}, 'Dove non concordano. '), t.divergenze)))),
    h('section', { class: 'riquadro tenue' }, h('p', { class: 'nota' }, NON_USATI)),
  ];
}

// ---------- pagina ----------

export function vistaFinanze(scheda) {
  const attiva = SCHEDE.some(([k]) => k === scheda) ? scheda : 'panoramica';
  const corpo = { panoramica, conti, ricorrenti, debiti, percorso }[attiva]();
  return h('div', { class: 'pagina finanze' },
    h('header', { class: 'testata' }, h('h1', {}, 'Finanze')),
    h('nav', { class: 'linguette', 'aria-label': 'Sezioni delle finanze' },
      SCHEDE.map(([k, nome]) => h('a', { href: `#/finanze/${k}`, class: k === attiva ? 'attiva' : '' }, nome))),
    corpo);
}
