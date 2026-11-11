// Pagina di un progetto (direzione in alto, schede sotto) e pagina di una scheda aperta.

import { h, apriFinestra, conferma, avviso, modificabile, riga } from '../ui.js';
import {
  S, crea, modifica, elimina, sposta, trova, schedeDi, sottoschedeDi, attivitaDi, prossimaPosizione,
} from '../archivio.js';
import { COLORI, eAperta } from '../stato.js';
import { giornoTesto } from '../fuso.js';
import { cartellino, colore } from './attivita.js';

const TIPI = [
  ['obiettivo', 'Obiettivi', 'Aggiungi obiettivo'],
  ['microobiettivo', 'Micro-obiettivi', 'Aggiungi micro-obiettivo'],
  ['indicatore', 'Indicatori (KPI)', 'Aggiungi indicatore'],
];

export function vistaProgetto(progettoId) {
  const p = trova('progetti', progettoId);
  if (!p) return h('p', { class: 'nota' }, 'Progetto non trovato.');
  const schede = schedeDi(p.id);
  const fissa = schede.find((s) => s.fissa);
  const altre = schede.filter((s) => !s.fissa);

  return h('div', { class: 'pagina progetto', style: `--colore:${colore(p)}` },
    h('header', { class: 'testata' },
      h('h1', {}, h('span', { class: 'pallino' }), modificabile(p.nome, (v) => modifica('progetti', p.id, { nome: v }), { obbligatorio: true })),
      h('label', { class: 'colore-scelta' }, 'Colore ',
        h('select', { onchange: (e) => modifica('progetti', p.id, { colore_google: +e.target.value }) },
          Object.entries(COLORI).map(([k, [nome]]) => h('option', { value: k, selected: +k === p.colore_google }, nome))))),

    h('section', { class: 'direzione' },
      h('div', { class: 'direzione-testi' },
        h('div', { class: 'riquadro' }, h('h3', {}, 'Mission'),
          modificabile(p.mission, (v) => modifica('progetti', p.id, { mission: v }), { multilinea: true, segnaposto: 'Scrivi la mission in sintesi' })),
        h('div', { class: 'riquadro' }, h('h3', {}, 'Vision'),
          modificabile(p.vision, (v) => modifica('progetti', p.id, { vision: v }), { multilinea: true, segnaposto: 'Scrivi la vision in sintesi' }))),
      h('div', { class: 'direzione-liste' }, TIPI.map(([tipo, titolo, aggiungi]) => {
        const voci = S.obiettivi.filter((o) => o.progetto_id === p.id && o.tipo === tipo).sort((a, b) => a.posizione - b.posizione);
        return h('div', { class: 'riquadro' }, h('h3', {}, titolo),
          h('ul', { class: 'obiettivi' }, voci.map((o) => h('li', {},
            h('button', { class: 'voce-obiettivo', onclick: () => apriObiettivo(p.id, tipo, o) },
              h('span', {}, o.titolo),
              (o.valore_iniziale || o.valore_attuale || o.valore_desiderato)
                ? h('small', {}, [o.valore_iniziale && `da ${o.valore_iniziale}`, o.valore_attuale && `ora ${o.valore_attuale}`, o.valore_desiderato && `obiettivo ${o.valore_desiderato}`].filter(Boolean).join(' · '))
                : null,
              o.scadenza ? h('small', {}, `entro ${giornoTesto(o.scadenza)}`) : null)))),
          h('button', { class: 'aggiungi', onclick: () => apriObiettivo(p.id, tipo, null) }, `+ ${aggiungi}`));
      }))),

    h('section', { class: 'bacheca' },
      fissa ? schedaBase(p, fissa, schede) : null,
      h('div', { class: 'bacheca-mobili' },
        altre.map((s) => schedaBase(p, s, altre)),
        nuovaVoce('+ Aggiungi scheda', 'Titolo della scheda', async (titolo) => {
          const s = await crea('schede', { progetto_id: p.id, titolo, posizione: prossimaPosizione(schede) });
          let n = 1;
          for (const t of ['Da fare', 'In corso', 'Fatto']) await crea('sottoschede', { scheda_id: s.id, titolo: t, posizione: n++ });
        }))));
}

function schedaBase(p, s, sorelle) {
  const sotto = sottoschedeDi(s.id);
  const apri = () => { location.hash = `#/progetto/${p.id}/scheda/${s.id}`; };
  return h('article', { class: `scheda-base ${s.fissa ? 'fissa' : ''}` },
    h('header', {},
      h('h3', {}, modificabile(s.titolo, (v) => modifica('schede', s.id, { titolo: v }), { obbligatorio: true })),
      s.fissa ? h('span', { class: 'targa' }, 'fissa') : h('span', { class: 'mosse' },
        h('button', { class: 'icona', 'aria-label': 'Sposta a sinistra', onclick: () => sposta('schede', sorelle, s.id, -1) }, '◀'),
        h('button', { class: 'icona', 'aria-label': 'Sposta a destra', onclick: () => sposta('schede', sorelle, s.id, 1) }, '▶'),
        h('button', { class: 'icona', 'aria-label': 'Elimina scheda', onclick: async () => {
          const n = sotto.reduce((t, ss) => t + attivitaDi(ss.id).length, 0);
          if (await conferma(`Eliminare la scheda «${s.titolo}»${n ? ` con le sue ${n} attività` : ''}? Non si può annullare.`, 'Elimina', true)) await elimina('schede', s.id);
        } }, '✕'))),
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
