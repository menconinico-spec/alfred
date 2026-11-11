// Calendario settimanale: blocchi di Alfred (colore del progetto) e orari occupati degli altri calendari (grigio, senza titoli).

import { h, avviso, eTelefono } from '../ui.js';
import { S, trova, contesto } from '../archivio.js';
import { occupati, sincronizza, googleCollegato } from '../google.js';
import { unisciOccupati } from '../proposta.js';
import {
  giornoRoma, aggiungiGiorni, lunediDi, istanteDi, giornoTesto, oraTesto, partiRoma, intervalloTesto,
} from '../fuso.js';
import { apriAttivita, colore } from './attivita.js';

const PRIMA_ORA = 6, ULTIMA_ORA = 22, ALTEZZA_ORA = 44;
const st = { lunedi: null, occupati: {}, errore: null, inCorso: false };

export function vistaCalendario(ridisegna) {
  if (!st.lunedi) st.lunedi = lunediDi(giornoRoma(new Date()));
  const giorni = Array.from({ length: 7 }, (_, i) => aggiungiGiorni(st.lunedi, i));
  const da = istanteDi(st.lunedi), a = istanteDi(aggiungiGiorni(st.lunedi, 7));
  const oggi = giornoRoma(new Date());

  // Orari occupati della settimana: richiesti una volta, poi ridisegno.
  const chiave = st.lunedi;
  if (googleCollegato() && !(chiave in st.occupati) && !st.errore) {
    st.occupati[chiave] = null;
    occupati(da, a).then((r) => { st.occupati[chiave] = unisciOccupati(r.occupati); })
      .catch((e) => { delete st.occupati[chiave]; st.errore = e.message; })
      .finally(ridisegna);
  }
  const occ = st.occupati[chiave] || [];
  const blocchi = S.blocchi.filter((b) => ['in_calendario', 'da_scrivere', 'svolto', 'saltato'].includes(b.stato)
    && new Date(b.fine) > da && new Date(b.inizio) < a);

  const vai = (n) => { st.lunedi = aggiungiGiorni(st.lunedi, n); st.errore = null; ridisegna(); };
  const aggiorna = async () => {
    st.inCorso = true; ridisegna();
    try {
      const r = await sincronizza();
      st.occupati = {}; st.errore = null;
      avviso(r.modifiche.length ? `Recepite ${r.modifiche.length} modifiche fatte in Google.` : 'Calendario allineato: nessuna novità.');
    } catch (e) { avviso(e.message, 'errore'); }
    st.inCorso = false; ridisegna();
  };

  // Ritaglia un intervallo sul singolo giorno e lo esprime in minuti dall'inizio della griglia.
  const nelGiorno = (giorno, inizio, fine) => {
    const g0 = istanteDi(giorno).getTime(), g1 = istanteDi(aggiungiGiorni(giorno, 1)).getTime();
    const i = Math.max(new Date(inizio).getTime(), g0), f = Math.min(new Date(fine).getTime(), g1);
    if (f <= i) return null;
    const minuti = (t) => { const p = partiRoma(t); return giornoRoma(t) === giorno ? p.ora * 60 + p.minuto : 24 * 60; };
    return { da: minuti(i), a: minuti(f), i, f };
  };
  const stile = (r) => {
    const su = Math.max(r.da, PRIMA_ORA * 60), giu = Math.min(r.a, ULTIMA_ORA * 60);
    if (giu <= su) return null;
    return `top:${((su - PRIMA_ORA * 60) / 60) * ALTEZZA_ORA}px;height:${Math.max(((giu - su) / 60) * ALTEZZA_ORA, 14)}px`;
  };
  const elementoBlocco = (b, classe = '') => {
    const att = trova('attivita', b.attivita_id);
    const { progetto } = contesto(att);
    return h('button', {
      class: `evento alfred b-${b.stato} ${classe}`, style: `--colore:${colore(progetto)};`,
      title: `${att?.titolo || ''} · ${intervalloTesto(b.inizio, b.fine)}`,
      onclick: () => att && apriAttivita(att.id),
    }, h('strong', {}, att?.titolo || 'Attività'), h('small', {}, `${oraTesto(b.inizio)}–${oraTesto(b.fine)}${b.stato === 'da_scrivere' ? ' · non scritto' : b.stato === 'saltato' ? ' · saltato' : b.stato === 'svolto' ? ' · svolto' : ''}`));
  };

  const testa = h('header', { class: 'testata' },
    h('h1', {}, 'Calendario'),
    h('div', { class: 'azioni strette' },
      h('button', { onclick: () => vai(-7), 'aria-label': 'Settimana precedente' }, '◀'),
      h('button', { onclick: () => { st.lunedi = lunediDi(oggi); ridisegna(); } }, 'Oggi'),
      h('button', { onclick: () => vai(7), 'aria-label': 'Settimana successiva' }, '▶'),
      h('button', { class: 'primario', disabled: st.inCorso || !googleCollegato(), onclick: aggiorna }, st.inCorso ? 'Aggiorno…' : 'Aggiorna da Google')));

  const avvisi = [
    googleCollegato() ? null : h('p', { class: 'nota allerta' }, 'Google Calendar non è collegato: vedi solo i blocchi già noti ad Alfred. Collegalo da «Dati e collegamenti».'),
    st.errore ? h('p', { class: 'nota allerta' }, `Orari occupati non disponibili: ${st.errore} `, h('button', { class: 'piccolo', onclick: () => { st.errore = null; ridisegna(); } }, 'Riprova')) : null,
    h('p', { class: 'nota' }, `Settimana dal ${giornoTesto(giorni[0])} al ${giornoTesto(giorni[6])}. In grigio gli orari occupati negli altri calendari, senza titoli.`),
  ];

  if (eTelefono()) {
    return h('div', { class: 'pagina' }, testa, avvisi,
      h('div', { class: 'agenda' }, giorni.map((g) => {
        const voci = [
          ...blocchi.filter((b) => nelGiorno(g, b.inizio, b.fine)).map((b) => ({ t: new Date(b.inizio).getTime(), el: elementoBlocco(b, 'in-lista') })),
          ...occ.map((o) => ({ o, r: nelGiorno(g, o.inizio, o.fine) })).filter((x) => x.r).map(({ r }) => ({
            t: r.i, el: h('div', { class: 'evento occupato in-lista' }, h('strong', {}, 'Occupato'), h('small', {}, `${oraTesto(r.i)}–${oraTesto(r.f)}`)),
          })),
        ].sort((x, y) => x.t - y.t);
        return h('section', { class: `agenda-giorno ${g === oggi ? 'oggi' : ''}` },
          h('h3', {}, giornoTesto(g)), voci.length ? voci.map((v) => v.el) : h('p', { class: 'nota' }, 'Nessun impegno'));
      })));
  }

  const ore = Array.from({ length: ULTIMA_ORA - PRIMA_ORA }, (_, i) => PRIMA_ORA + i);
  return h('div', { class: 'pagina' }, testa, avvisi,
    h('div', { class: 'settimana' },
      h('div', { class: 'settimana-testa' }, h('span', {}), giorni.map((g) => h('span', { class: g === oggi ? 'oggi' : '' }, giornoTesto(g)))),
      h('div', { class: 'settimana-corpo', style: `height:${ore.length * ALTEZZA_ORA}px` },
        h('div', { class: 'ore' }, ore.map((o) => h('span', { style: `height:${ALTEZZA_ORA}px` }, `${String(o).padStart(2, '0')}:00`))),
        giorni.map((g) => h('div', { class: `giorno ${g === oggi ? 'oggi' : ''}` },
          occ.map((o) => nelGiorno(g, o.inizio, o.fine)).filter(Boolean).map((r) => {
            const s = stile(r);
            return s ? h('div', { class: 'evento occupato', style: s, title: `Occupato ${oraTesto(r.i)}–${oraTesto(r.f)}` }) : null;
          }),
          blocchi.map((b) => {
            const r = nelGiorno(g, b.inizio, b.fine);
            const s = r && stile(r);
            if (!s) return null;
            const el = elementoBlocco(b);
            el.setAttribute('style', `${el.getAttribute('style')}${s}`);
            return el;
          }))))));
}
