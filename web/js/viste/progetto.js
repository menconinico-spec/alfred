// Pagina di un progetto (direzione in alto, schede sotto) e pagina di una scheda aperta.

import { h, apriFinestra, conferma, avviso, modificabile, riga } from '../ui.js';
import {
  S, crea, modifica, elimina, sposta, trova, schedeDi, sottoschedeDi, attivitaDi, prossimaPosizione,
  creaProgetto, attivitaDelProgetto,
} from '../archivio.js';
import { COLORI, eAperta } from '../stato.js';
import { giornoTesto } from '../fuso.js';
import { cartellino, colore } from './attivita.js';

const TIPI = [
  ['obiettivo', 'Obiettivi', 'Aggiungi obiettivo'],
  ['microobiettivo', 'Micro-obiettivi', 'Aggiungi micro-obiettivo'],
  ['indicatore', 'Indicatori (KPI)', 'Aggiungi indicatore'],
];

// Misure predefinite dei blocchi, in dodicesimi della larghezza della pagina.
const LARGHEZZE = { mission: 6, vision: 6, obiettivo: 4, microobiettivo: 4, indicatore: 4, scheda: 3, nota: 3 };

/**
 * Rende un blocco ridimensionabile: si trascina l'angolo in basso a destra.
 * La larghezza scatta sui dodicesimi della pagina, l'altezza ogni 20 punti.
 * Doppio clic sull'angolo: torna alla misura automatica. Su iPhone i blocchi stanno in colonna e non si ridimensionano.
 */
function blocco(contenuto, { larghezza, altezza, predefinita, salva }) {
  const el = h('div', { class: `blocco ${altezza ? 'alta' : ''}` }, contenuto);
  el.style.gridColumn = `span ${larghezza || predefinita}`;
  if (altezza) el.style.height = `${altezza}px`;
  const maniglia = h('span', { class: 'maniglia', title: 'Trascina per ridimensionare. Doppio clic: misura automatica' });
  maniglia.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const tela = el.parentElement, r = el.getBoundingClientRect();
    const spazio = parseFloat(getComputedStyle(tela).columnGap) || 0;
    const colonna = (tela.clientWidth + spazio) / 12;
    let l = larghezza || predefinita, a = altezza || null, mosso = false;
    maniglia.setPointerCapture(e.pointerId);
    el.classList.add('in-modifica');
    const muovi = (m) => {
      mosso = true;
      l = Math.min(12, Math.max(2, Math.round((m.clientX - r.left + spazio) / colonna)));
      a = Math.min(4000, Math.max(80, Math.round((m.clientY - r.top) / 20) * 20));
      el.style.gridColumn = `span ${l}`; el.style.height = `${a}px`; el.classList.add('alta');
    };
    const fine = async () => {
      maniglia.removeEventListener('pointermove', muovi);
      el.classList.remove('in-modifica');
      if (!mosso) return;
      try { await salva({ larghezza: l, altezza: a }); } catch (err) { avviso(err.message, 'errore'); }
    };
    maniglia.addEventListener('pointermove', muovi);
    maniglia.addEventListener('pointerup', fine, { once: true });
    maniglia.addEventListener('pointercancel', fine, { once: true });
  });
  maniglia.addEventListener('dblclick', async (e) => {
    e.stopPropagation();
    try { await salva({ larghezza: null, altezza: null }); } catch (err) { avviso(err.message, 'errore'); }
  });
  el.append(maniglia);
  return el;
}

export function vistaProgetto(progettoId) {
  const p = trova('progetti', progettoId);
  if (!p) return h('p', { class: 'nota' }, 'Progetto non trovato.');
  const schede = schedeDi(p.id);
  const fissa = schede.find((s) => s.fissa);
  const altre = schede.filter((s) => !s.fissa);
  const disposizione = p.disposizione || {};

  // Riquadro fisso della parte alta: la sua misura sta nel progetto.
  const fisso = (chiave, contenuto) => blocco(contenuto, {
    larghezza: disposizione[chiave]?.larghezza, altezza: disposizione[chiave]?.altezza, predefinita: LARGHEZZE[chiave],
    salva: (m) => modifica('progetti', p.id, { disposizione: { ...disposizione, [chiave]: m } }),
  });
  // Scheda o nota: la sua misura sta nella scheda stessa.
  const mobile = (s, sorelle) => blocco(s.tipo === 'nota' ? notaBase(s, sorelle) : schedaBase(p, s, sorelle), {
    larghezza: s.larghezza, altezza: s.altezza, predefinita: LARGHEZZE[s.tipo] || 3,
    salva: (m) => modifica('schede', s.id, m),
  });

  return h('div', { class: 'pagina progetto', style: `--colore:${colore(p)}` },
    h('header', { class: 'testata' },
      h('h1', {}, h('span', { class: 'pallino' }), modificabile(p.nome, (v) => modifica('progetti', p.id, { nome: v }), { obbligatorio: true })),
      h('div', { class: 'testata-azioni' },
        h('label', { class: 'colore-scelta' }, 'Colore ',
          h('select', { onchange: (e) => modifica('progetti', p.id, { colore_google: +e.target.value }) },
            Object.entries(COLORI).map(([k, [nome]]) => h('option', { value: k, selected: +k === p.colore_google }, nome)))),
        h('label', { class: 'colore-scelta' }, 'Ore a settimana ',
          h('input', { type: 'number', min: 0, step: 0.5, class: 'corto', value: p.limite_ore_settimana ?? '', placeholder: 'nessun limite',
            onchange: (e) => modifica('progetti', p.id, { limite_ore_settimana: e.target.value === '' ? null : Math.max(0, +e.target.value) }) })),
        h('button', { class: 'pericolo-tenue piccolo', onclick: () => eliminaProgetto(p) }, 'Elimina progetto'))),

    h('p', { class: 'nota solo-mac' }, 'Ogni riquadro si ridimensiona trascinando l\'angolo in basso a destra. Doppio clic sull\'angolo: misura automatica.'),

    h('section', { class: 'direzione tela' },
      fisso('mission', h('div', { class: 'riquadro' }, h('h3', {}, 'Mission'),
        modificabile(p.mission, (v) => modifica('progetti', p.id, { mission: v }), { multilinea: true, segnaposto: 'Scrivi la mission in sintesi' }))),
      fisso('vision', h('div', { class: 'riquadro' }, h('h3', {}, 'Vision'),
        modificabile(p.vision, (v) => modifica('progetti', p.id, { vision: v }), { multilinea: true, segnaposto: 'Scrivi la vision in sintesi' }))),
      TIPI.map(([tipo, titolo, aggiungi]) => {
        const voci = S.obiettivi.filter((o) => o.progetto_id === p.id && o.tipo === tipo).sort((a, b) => a.posizione - b.posizione);
        return fisso(tipo, h('div', { class: 'riquadro' }, h('h3', {}, titolo),
          h('ul', { class: 'obiettivi' }, voci.map((o) => h('li', {},
            h('button', { class: 'voce-obiettivo', onclick: () => apriObiettivo(p.id, tipo, o) },
              h('span', {}, o.titolo),
              (o.valore_iniziale || o.valore_attuale || o.valore_desiderato)
                ? h('small', {}, [o.valore_iniziale && `da ${o.valore_iniziale}`, o.valore_attuale && `ora ${o.valore_attuale}`, o.valore_desiderato && `obiettivo ${o.valore_desiderato}`].filter(Boolean).join(' · '))
                : null,
              o.scadenza ? h('small', {}, `entro ${giornoTesto(o.scadenza)}`) : null)))),
          h('button', { class: 'aggiungi', onclick: () => apriObiettivo(p.id, tipo, null) }, `+ ${aggiungi}`)));
      })),

    h('section', { class: 'bacheca tela' },
      fissa ? mobile(fissa, schede) : null,
      altre.map((s) => mobile(s, altre)),
      h('div', { class: 'blocco aggiungi-blocco', style: 'grid-column: span 3' },
        nuovaVoce('+ Aggiungi scheda', 'Titolo della scheda', async (titolo) => {
          const s = await crea('schede', { progetto_id: p.id, titolo, posizione: prossimaPosizione(schede) });
          let n = 1;
          for (const t of ['Da fare', 'In corso', 'Fatto']) await crea('sottoschede', { scheda_id: s.id, titolo: t, posizione: n++ });
        }),
        nuovaVoce('+ Aggiungi nota', 'Titolo della nota', (titolo) =>
          crea('schede', { progetto_id: p.id, titolo, tipo: 'nota', posizione: prossimaPosizione(schede) })))));
}

async function eliminaProgetto(p) {
  const ids = new Set(attivitaDelProgetto(p.id).map((a) => a.id));
  const inCalendario = S.blocchi.filter((b) => ids.has(b.attivita_id) && ['in_calendario', 'da_scrivere'].includes(b.stato)).length;
  if (inCalendario) {
    avviso(`«${p.nome}» ha ${inCalendario} blocchi ancora in calendario: toglili prima dalle attività, così non restano eventi orfani in Google Calendar.`, 'errore');
    return;
  }
  if (!await conferma(`Eliminare il progetto «${p.nome}» con tutte le sue schede${ids.size ? ` e le sue ${ids.size} voci` : ''}? Non si può annullare. Conviene prima esportare una copia dei dati.`, 'Elimina il progetto', true)) return;
  try { await elimina('progetti', p.id); location.hash = '#/calendario'; } catch (err) { avviso(err.message, 'errore'); }
}

/** Finestra per creare un nuovo progetto. */
export function apriNuovoProgetto() {
  const usati = new Set(S.progetti.map((x) => x.colore_google));
  const libero = Object.keys(COLORI).map(Number).find((k) => !usati.has(k)) ?? 1;
  const c = {
    nome: h('input', { type: 'text', required: true, placeholder: 'Nome del progetto' }),
    colore: h('select', {}, Object.entries(COLORI).map(([k, [nome]]) => h('option', { value: k, selected: +k === libero }, nome))),
    limite: h('input', { type: 'number', min: 0, step: 0.5, placeholder: 'nessun limite' }),
  };
  const f = apriFinestra({
    titolo: 'Nuovo progetto',
    corpo: h('form', { class: 'modulo', onsubmit: async (e) => {
      e.preventDefault();
      const nome = c.nome.value.trim();
      if (!nome) return;
      try {
        const nuovo = await creaProgetto({ nome, colore_google: +c.colore.value, limite_ore_settimana: c.limite.value === '' ? null : +c.limite.value });
        f.chiudi();
        location.hash = `#/progetto/${nuovo.id}`;
      } catch (err) { avviso(err.message, 'errore'); }
    } },
      riga('Nome', c.nome),
      h('div', { class: 'griglia-campi' }, riga('Colore (lo stesso in Google Calendar)', c.colore), riga('Limite di ore a settimana', c.limite)),
      h('p', { class: 'nota' }, 'Il progetto nasce con la scheda fissa «Base del progetto» (Processi, Idee, Link utili). Tutto si può cambiare dopo.'),
      h('div', { class: 'azioni' },
        h('button', { type: 'button', onclick: () => f.chiudi() }, 'Annulla'),
        h('button', { type: 'submit', class: 'primario' }, 'Crea il progetto'))),
  });
  setTimeout(() => c.nome.focus(), 50);
}

const mosse = (s, sorelle, elimina_) => h('span', { class: 'mosse' },
  h('button', { class: 'icona', 'aria-label': 'Sposta prima', onclick: () => sposta('schede', sorelle, s.id, -1) }, '◀'),
  h('button', { class: 'icona', 'aria-label': 'Sposta dopo', onclick: () => sposta('schede', sorelle, s.id, 1) }, '▶'),
  h('button', { class: 'icona', 'aria-label': 'Elimina', onclick: elimina_ }, '✕'));

/** Nota libera: un titolo e un testo, senza attività. */
function notaBase(s, sorelle) {
  return h('article', { class: 'scheda-base nota-libera' },
    h('header', {},
      h('h3', {}, modificabile(s.titolo, (v) => modifica('schede', s.id, { titolo: v }), { obbligatorio: true })),
      mosse(s, sorelle, async () => {
        if (await conferma(`Eliminare la nota «${s.titolo}»? Non si può annullare.`, 'Elimina', true)) await elimina('schede', s.id);
      })),
    h('div', { class: 'nota-testo' },
      modificabile(s.testo, (v) => modifica('schede', s.id, { testo: v }), { multilinea: true, segnaposto: 'Scrivi qui' })));
}

function schedaBase(p, s, sorelle) {
  const sotto = sottoschedeDi(s.id);
  const apri = () => { location.hash = `#/progetto/${p.id}/scheda/${s.id}`; };
  return h('article', { class: `scheda-base ${s.fissa ? 'fissa' : ''}` },
    h('header', {},
      h('h3', {}, modificabile(s.titolo, (v) => modifica('schede', s.id, { titolo: v }), { obbligatorio: true })),
      s.fissa ? h('span', { class: 'targa' }, 'fissa') : mosse(s, sorelle, async () => {
        const n = sotto.reduce((t, ss) => t + attivitaDi(ss.id).length, 0);
        if (await conferma(`Eliminare la scheda «${s.titolo}»${n ? ` con le sue ${n} attività` : ''}? Non si può annullare.`, 'Elimina', true)) await elimina('schede', s.id);
      })),
    h('button', { class: 'scheda-corpo', onclick: apri, 'aria-label': `Apri la scheda ${s.titolo}` },
      sotto.map((ss) => {
        const voci = attivitaDi(ss.id);
        const aperte = voci.filter((a) => a.tipo === 'appunto' || eAperta(a)).length;
        return h('span', { class: 'sotto-riga' }, h('span', {}, ss.titolo), h('span', { class: 'conta' }, s.fissa ? voci.length : `${aperte}/${voci.length}`));
      }),
      sotto.length ? null : h('span', { class: 'nota' }, 'Scheda vuota'),
      h('span', { class: 'apri' }, 'Apri →')));
}

/** Pulsante che diventa un campo per aggiungere una voce con un titolo. */
function nuovaVoce(etichetta, segnaposto, creaVoce) {
  const contenitore = h('div', { class: 'nuova-voce' });
  const chiuso = () => contenitore.replaceChildren(h('button', { class: 'aggiungi', onclick: aperto }, etichetta));
  function aperto() {
    const campo = h('input', { type: 'text', placeholder: segnaposto });
    const modulo = h('form', { onsubmit: async (e) => {
      e.preventDefault();
      const titolo = campo.value.trim();
      if (!titolo) return;
      campo.disabled = true;
      try { await creaVoce(titolo); } catch (err) { avviso(err.message, 'errore'); campo.disabled = false; }
    } }, campo, h('button', { type: 'submit', class: 'primario' }, 'Aggiungi'),
    h('button', { type: 'button', onclick: chiuso }, 'Annulla'));
    contenitore.replaceChildren(modulo);
    campo.focus();
  }
  chiuso();
  return contenitore;
}

function apriObiettivo(progettoId, tipo, o) {
  const c = {
    titolo: h('input', { type: 'text', value: o?.titolo ?? '', required: true }),
    iniziale: h('input', { type: 'text', value: o?.valore_iniziale ?? '' }),
    attuale: h('input', { type: 'text', value: o?.valore_attuale ?? '' }),
    desiderato: h('input', { type: 'text', value: o?.valore_desiderato ?? '' }),
    scadenza: h('input', { type: 'date', value: o?.scadenza ?? '' }),
  };
  const f = apriFinestra({
    titolo: TIPI.find((t) => t[0] === tipo)[1],
    corpo: h('form', { class: 'modulo', onsubmit: async (e) => {
      e.preventDefault();
      const campi = {
        titolo: c.titolo.value.trim(), valore_iniziale: c.iniziale.value.trim(), valore_attuale: c.attuale.value.trim(),
        valore_desiderato: c.desiderato.value.trim(), scadenza: c.scadenza.value || null,
      };
      if (!campi.titolo) return;
      try {
        if (o) await modifica('obiettivi', o.id, campi);
        else await crea('obiettivi', { ...campi, progetto_id: progettoId, tipo, posizione: prossimaPosizione(S.obiettivi) });
        f.chiudi();
      } catch (err) { avviso(err.message, 'errore'); }
    } },
      riga('Titolo', c.titolo),
      h('div', { class: 'griglia-campi' }, riga('Valore iniziale', c.iniziale), riga('Valore attuale', c.attuale), riga('Valore desiderato', c.desiderato), riga('Entro', c.scadenza)),
      h('p', { class: 'nota' }, 'I valori sono facoltativi: scrivi solo quelli che conosci.'),
      h('div', { class: 'azioni' },
        o ? h('button', { type: 'button', class: 'pericolo-tenue', onclick: async () => {
          if (await conferma(`Eliminare «${o.titolo}»?`, 'Elimina', true)) { await elimina('obiettivi', o.id); f.chiudi(); }
        } }, 'Elimina') : null,
        h('span', { class: 'spazio' }),
        h('button', { type: 'button', onclick: () => f.chiudi() }, 'Annulla'),
        h('button', { type: 'submit', class: 'primario' }, 'Salva'))),
  });
}

/** Scheda aperta: le schede interne come colonne, con le attività dentro. */
export function vistaScheda(progettoId, schedaId) {
  const p = trova('progetti', progettoId), s = trova('schede', schedaId);
  if (!p || !s) return h('p', { class: 'nota' }, 'Scheda non trovata.');
  const sotto = sottoschedeDi(s.id);
  const tipo = s.fissa ? 'appunto' : 'attivita';

  return h('div', { class: 'pagina scheda-aperta', style: `--colore:${colore(p)}` },
    h('header', { class: 'testata' },
      h('a', { class: 'indietro', href: `#/progetto/${p.id}` }, `← ${p.nome}`),
      h('h1', {}, h('span', { class: 'pallino' }), modificabile(s.titolo, (v) => modifica('schede', s.id, { titolo: v }), { obbligatorio: true }))),
    h('div', { class: 'colonne' },
      sotto.map((ss) => {
        const voci = attivitaDi(ss.id);
        const colonna = h('section', { class: 'colonna' },
          h('header', {},
            h('h3', {}, modificabile(ss.titolo, (v) => modifica('sottoschede', ss.id, { titolo: v }), { obbligatorio: true })),
            h('span', { class: 'mosse' },
              h('button', { class: 'icona', 'aria-label': 'Sposta a sinistra', onclick: () => sposta('sottoschede', sotto, ss.id, -1) }, '◀'),
              h('button', { class: 'icona', 'aria-label': 'Sposta a destra', onclick: () => sposta('sottoschede', sotto, ss.id, 1) }, '▶'),
              h('button', { class: 'icona', 'aria-label': 'Elimina scheda interna', onclick: async () => {
                if (await conferma(`Eliminare «${ss.titolo}»${voci.length ? ` con le sue ${voci.length} voci` : ''}? Non si può annullare.`, 'Elimina', true)) await elimina('sottoschede', ss.id);
              } }, '✕'))),
          h('div', { class: 'colonna-voci' }, voci.map((a) => cartellino(a, { trascinabile: true }))),
          nuovaVoce(s.fissa ? '+ Aggiungi appunto' : '+ Aggiungi attività', 'Titolo', (titolo) =>
            crea('attivita', { sottoscheda_id: ss.id, titolo, tipo, posizione: prossimaPosizione(voci) })));
        // Trascinamento fra colonne (Mac). Su iPhone si usa il campo «Posizione» dentro l'attività.
        colonna.addEventListener('dragover', (e) => { e.preventDefault(); colonna.classList.add('bersaglio'); });
        colonna.addEventListener('dragleave', () => colonna.classList.remove('bersaglio'));
        colonna.addEventListener('drop', async (e) => {
          e.preventDefault(); colonna.classList.remove('bersaglio');
          const id = e.dataTransfer.getData('text/plain');
          const a = trova('attivita', id);
          if (a && a.sottoscheda_id !== ss.id) {
            try { await modifica('attivita', id, { sottoscheda_id: ss.id, posizione: prossimaPosizione(voci) }); } catch (err) { avviso(err.message, 'errore'); }
          }
        });
        return colonna;
      }),
      nuovaVoce('+ Aggiungi scheda interna', 'Titolo della scheda interna', (titolo) =>
        crea('sottoschede', { scheda_id: s.id, titolo, posizione: prossimaPosizione(sotto) }))));
}
