// Scheda di un'attività, pianificazione di un blocco, conferma di fine blocco, registrazione del tempo.

import { h, apriFinestra, conferma, avviso, riga } from '../ui.js';
import {
  S, crea, modifica, elimina, annota, trova, contesto, blocchiDi, registrazioniDi,
  schedeDi, sottoschedeDi, attivitaDelProgetto,
} from '../archivio.js';
import { chiama, sincronizza, occupati, googleCollegato } from '../google.js';
import {
  STATI, STATI_BLOCCO, COLORI, pianificazione, minutiEffettivi, minutiBlocco,
  minutiNellaSettimana, blocchiFuturi,
} from '../stato.js';
import { proponiBlocchi, eLibero, dentroLeFasce, unisciOccupati } from '../proposta.js';
import {
  intervalloTesto, durataTesto, giornoRoma, giornoTesto, perCampo, daCampo, lunediDi,
} from '../fuso.js';

const ETICHETTE_PIANO = { assente: 'Da pianificare', parziale: 'Pianificata in parte', completa: 'Pianificata' };

export const colore = (progetto) => COLORI[progetto?.colore_google || 2][1];

/** Cartellino di un'attività, usato in schede, matrice ed elenco. */
export function cartellino(a, { conProgetto = false, trascinabile = false } = {}) {
  const { progetto, scheda } = contesto(a);
  if (a.tipo === 'appunto') {
    return h('button', { class: 'cartellino appunto', onclick: () => apriAttivita(a.id) },
      h('span', { class: 'cartellino-titolo' }, a.titolo),
      a.collegamento ? h('span', { class: 'targa' }, 'link') : null);
  }
  const piano = pianificazione(a, blocchiDi(a.id), registrazioniDi(a.id));
  const prossimo = blocchiFuturi(blocchiDi(a.id)).sort((x, y) => x.inizio.localeCompare(y.inizio))[0];
  const el = h('button', {
    class: `cartellino stato-${a.stato}`, style: `--colore:${colore(progetto)}`,
    draggable: trascinabile ? 'true' : null,
    onclick: () => apriAttivita(a.id),
  },
    h('span', { class: 'cartellino-titolo' }, a.titolo),
    h('span', { class: 'targhe' },
      conProgetto && progetto ? h('span', { class: 'targa progetto' }, `${progetto.nome} · ${scheda?.titolo || ''}`) : null,
      a.stato !== 'da_fare' ? h('span', { class: `targa s-${a.stato}` }, STATI[a.stato]) : null,
      a.importante ? h('span', { class: 'targa imp' }, 'Importante') : null,
      a.urgente ? h('span', { class: 'targa urg' }, 'Urgente') : null,
      a.durata_prevista_min ? h('span', { class: 'targa' }, durataTesto(a.durata_prevista_min)) : null,
      a.scadenza ? h('span', { class: 'targa' }, `entro ${giornoTesto(a.scadenza)}`) : null,
      ['completata', 'annullata'].includes(a.stato) ? null
        : prossimo ? h('span', { class: 'targa piano' }, intervalloTesto(prossimo.inizio, prossimo.fine))
          : h('span', { class: 'targa dapian' }, ETICHETTE_PIANO[piano])));
  if (trascinabile) {
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', a.id); el.classList.add('trascinato'); });
    el.addEventListener('dragend', () => el.classList.remove('trascinato'));
  }
  return el;
}

const treStati = (valore) => (valore === true ? 'si' : valore === false ? 'no' : '');
const daTreStati = (testo) => (testo === 'si' ? true : testo === 'no' ? false : null);

/** Apre la scheda completa di un'attività (o di un appunto della scheda fissa). */
export function apriAttivita(id) {
  const f = apriFinestra({
    titolo: 'Attività', larga: true,
    corpo: (finestra) => {
      const a = trova('attivita', id);
      if (!a) return h('p', {}, 'Questa voce non esiste più.');
      const { progetto, scheda } = contesto(a);
      const appunto = a.tipo === 'appunto';
      finestra.titolo(appunto ? 'Appunto' : `Attività · ${progetto?.nome || ''}`);

      const c = {
        titolo: h('input', { type: 'text', value: a.titolo, required: true }),
        risultato: h('textarea', { rows: 2, value: a.risultato_atteso }),
        note: h('textarea', { rows: appunto ? 8 : 5, value: a.note }),
        collegamento: h('input', { type: 'url', value: a.collegamento, placeholder: 'https://…' }),
        stato: h('select', {}, Object.entries(STATI).map(([k, v]) => h('option', { value: k, selected: a.stato === k }, v))),
        importante: scelta(treStati(a.importante)),
        urgente: scelta(treStati(a.urgente)),
        durata: h('input', { type: 'number', min: 5, step: 5, value: a.durata_prevista_min ?? '', placeholder: 'non indicata' }),
        scadenza: h('input', { type: 'date', value: a.scadenza ?? '' }),
        dove: h('select', {}, schedeDi(progetto.id).filter((s) => s.fissa === scheda.fissa).flatMap((s) =>
          sottoschedeDi(s.id).map((ss) => h('option', { value: ss.id, selected: ss.id === a.sottoscheda_id }, `${s.titolo} › ${ss.titolo}`)))),
      };

      const salva = async () => {
        const titolo = c.titolo.value.trim();
        if (!titolo) { avviso('Il titolo non può essere vuoto.', 'errore'); throw new Error('titolo'); }
        const campi = { titolo, note: c.note.value, collegamento: c.collegamento.value.trim(), sottoscheda_id: c.dove.value };
        if (!appunto) {
          const stato = c.stato.value;
          Object.assign(campi, {
            risultato_atteso: c.risultato.value, stato,
            importante: daTreStati(c.importante.value), urgente: daTreStati(c.urgente.value),
            durata_prevista_min: c.durata.value ? Math.round(+c.durata.value) : null,
            scadenza: c.scadenza.value || null,
            completata_il: stato === 'completata' ? (a.completata_il || new Date().toISOString()) : null,
          });
        }
        const cambiati = Object.fromEntries(Object.entries(campi).filter(([k, v]) => (a[k] ?? null) !== (v ?? null)));
        if (Object.keys(cambiati).length) await modifica('attivita', a.id, cambiati);
      };
      // Le azioni sui blocchi salvano prima i campi, così non si perde ciò che è stato scritto.
      const poi = (azione) => async () => { try { await salva(); } catch { return; } await azione(); finestra.ridisegna(); };

      const modulo = h('form', { class: 'modulo', onsubmit: async (e) => {
        e.preventDefault();
        try { await salva(); avviso('Salvato.'); finestra.chiudi(); } catch { /* errore già mostrato */ }
      } },
        riga('Titolo', c.titolo),
        appunto ? null : riga('Risultato atteso', c.risultato),
        riga(appunto ? 'Testo' : 'Note', c.note),
        riga('Collegamento', c.collegamento),
        a.collegamento ? h('a', { href: a.collegamento, target: '_blank', rel: 'noopener noreferrer', class: 'collegamento' }, 'Apri il collegamento ↗') : null,
        appunto ? null : h('div', { class: 'griglia-campi' },
          riga('Stato di esecuzione', c.stato),
          riga('Importante', c.importante),
          riga('Urgente', c.urgente),
          riga('Durata prevista (minuti)', c.durata),
          riga('Scadenza', c.scadenza)),
        riga('Posizione', c.dove),
        h('div', { class: 'azioni' },
          h('button', { type: 'button', class: 'pericolo-tenue', onclick: async () => {
            const scritti = blocchiDi(a.id).filter((b) => b.stato === 'in_calendario').length;
            const testo = scritti
              ? `Eliminare «${a.titolo}»? Ha ${scritti} blocco/i in calendario: toglili prima dal calendario, altrimenti resteranno in Google senza attività collegata.`
              : `Eliminare definitivamente «${a.titolo}» con i suoi tempi registrati?`;
            if (await conferma(testo, 'Elimina', true)) { await elimina('attivita', a.id); finestra.chiudi(); }
          } }, 'Elimina'),
          h('span', { class: 'spazio' }),
          h('button', { type: 'button', onclick: () => finestra.chiudi() }, 'Chiudi senza salvare'),
          h('button', { type: 'submit', class: 'primario' }, 'Salva')));

      if (appunto) return modulo;
      return h('div', { class: 'due-colonne' }, modulo, h('div', { class: 'laterale' },
        sezioneBlocchi(a, poi), sezioneTempo(a, poi)));
    },
  });
  return f;
}

function scelta(valore) {
  return h('select', {},
    h('option', { value: '', selected: valore === '' }, 'Da valutare'),
    h('option', { value: 'si', selected: valore === 'si' }, 'Sì'),
    h('option', { value: 'no', selected: valore === 'no' }, 'No'));
}

function sezioneBlocchi(a, poi) {
  const blocchi = blocchiDi(a.id).sort((x, y) => y.inizio.localeCompare(x.inizio));
  const piano = pianificazione(a, blocchi, registrazioniDi(a.id));
  const adesso = Date.now();
  return h('section', { class: 'riquadro' },
    h('h3', {}, 'Calendario'),
    h('p', { class: 'nota' }, `Pianificazione: ${ETICHETTE_PIANO[piano].toLowerCase()}`),
    h('ul', { class: 'elenco-blocchi' }, blocchi.map((b) => {
      const finito = new Date(b.fine).getTime() <= adesso;
      return h('li', { class: `blocco-riga b-${b.stato}` },
        h('div', {}, h('strong', {}, intervalloTesto(b.inizio, b.fine)),
          h('small', {}, b.stato === 'in_calendario' && finito ? 'Terminato, in attesa della tua conferma' : STATI_BLOCCO[b.stato])),
        h('div', { class: 'azioni strette' },
          b.stato === 'da_scrivere' ? h('button', { type: 'button', onclick: poi(() => scriviBlocco(b.id)) }, 'Riprova a scrivere') : null,
          b.stato === 'in_calendario' && finito ? h('button', { type: 'button', class: 'primario', onclick: poi(() => apriEsito(b.id)) }, 'Com\'è andata?') : null,
          b.stato === 'in_calendario' && !finito ? h('button', { type: 'button', onclick: poi(() => apriPianifica(a.id, b.id)) }, 'Sposta') : null,
          ['in_calendario', 'da_scrivere'].includes(b.stato) && !finito ? h('button', { type: 'button', onclick: poi(() => togliBlocco(b)) }, 'Togli') : null));
    })),
    blocchi.length ? null : h('p', { class: 'nota' }, 'Nessun blocco: l\'attività è in «Da pianificare».'),
    ['completata', 'annullata'].includes(a.stato) ? null
      : h('button', { type: 'button', class: 'primario', onclick: poi(() => apriPianifica(a.id)) }, 'Pianifica un blocco'));
}

function sezioneTempo(a, poi) {
  const reg = registrazioniDi(a.id);
  const effettivi = minutiEffettivi(reg);
  return h('section', { class: 'riquadro' },
    h('h3', {}, 'Tempo'),
    h('dl', { class: 'coppie' },
      h('dt', {}, 'Previsto'), h('dd', {}, a.durata_prevista_min ? durataTesto(a.durata_prevista_min) : 'non indicato'),
      h('dt', {}, 'Effettivo'), h('dd', {}, effettivi == null ? 'nessuna registrazione' : durataTesto(effettivi))),
    h('ul', { class: 'elenco-blocchi' }, reg.map((r) => h('li', { class: 'blocco-riga' },
      h('div', {}, h('strong', {}, `${giornoTesto(r.giorno)} · ${durataTesto(r.minuti)}`),
        h('small', {}, r.blocco_id ? 'confermato a fine blocco' : 'registrato a mano', r.nota ? ` · ${r.nota}` : '')),
      h('button', { type: 'button', class: 'icona', 'aria-label': 'Elimina registrazione', onclick: poi(async () => {
        if (await conferma(`Eliminare la registrazione di ${durataTesto(r.minuti)} del ${giornoTesto(r.giorno)}?`, 'Elimina', true)) {
          await elimina('registrazioni_tempo', r.id);
        }
      }) }, '✕')))),
    h('button', { type: 'button', onclick: poi(() => apriRegistraTempo(a.id)) }, 'Registra tempo a mano'));
}

/** Chiede a Google di scrivere un blocco già salvato nell'archivio. Ripetibile senza duplicati. */
export async function scriviBlocco(bloccoId) {
  try {
    const { blocco } = await chiama('crea_blocco', { blocco_id: bloccoId });
    const i = S.blocchi.findIndex((b) => b.id === bloccoId);
    if (i >= 0) S.blocchi[i] = { ...S.blocchi[i], ...blocco, attivita: undefined };
    avviso('Blocco scritto su «Alfred prova».');
    return true;
  } catch (e) {
    avviso(`${e.message} Il blocco resta segnato come «non ancora scritto»: puoi riprovare.`, 'errore');
    return false;
  }
}

async function togliBlocco(b) {
  if (!await conferma(`Togliere dal calendario il blocco ${intervalloTesto(b.inizio, b.fine)}? L'attività resta e torna in «Da pianificare» se non ha altri blocchi.`, 'Togli dal calendario', true)) return;
  try {
    await chiama('togli_blocco', { blocco_id: b.id });
    await sincronizzaSilenzioso();
    avviso('Blocco tolto dal calendario.');
  } catch (e) { avviso(e.message, 'errore'); }
}

async function sincronizzaSilenzioso() {
  try { await sincronizza(); } catch { const { caricaTutto } = await import('../archivio.js'); await caricaTutto().catch(() => {}); }
}

/**
 * Proposta di blocco. Mostra tre collocazioni libere e una scelta manuale.
 * Nulla viene scritto finché non si preme il pulsante di conferma.
 * Con `bloccoId` sposta un blocco esistente invece di crearne uno.
 */
export function apriPianifica(attivitaId, bloccoId = null) {
  return new Promise((fatto) => {
    const a = trova('attivita', attivitaId);
    const { progetto } = contesto(a);
    const esistente = bloccoId ? trova('blocchi', bloccoId) : null;
    const st = {
      durata: esistente ? minutiBlocco(esistente) : (a.durata_prevista_min || 60),
      occupatiAltri: null, errore: null, scelta: 0, manuale: '', inCorso: false, letti: null,
    };

    const miei = () => S.blocchi
      .filter((b) => ['in_calendario', 'da_scrivere'].includes(b.stato) && b.id !== bloccoId)
      .map((b) => ({ inizio: b.inizio, fine: b.fine }));
    const tuttiOccupati = () => unisciOccupati([...(st.occupatiAltri || []), ...miei()]);

    const f = apriFinestra({
      titolo: esistente ? 'Sposta il blocco' : 'Pianifica un blocco',
      allaChiusura: () => fatto(),
      corpo: (finestra) => {
        if (!googleCollegato()) {
          return h('div', {},
            h('p', {}, 'Google Calendar non è ancora collegato: senza collegamento Alfred non può leggere gli orari occupati né scrivere blocchi.'),
            h('div', { class: 'azioni' }, h('a', { class: 'bottone primario', href: '#/dati', onclick: () => finestra.chiudi() }, 'Vai a «Dati e collegamenti»')));
        }
        if (st.errore) {
          return h('div', {}, h('p', { class: 'errore-testo' }, st.errore),
            h('div', { class: 'azioni' }, h('button', { class: 'primario', onclick: carica }, 'Riprova')));
        }
        if (!st.occupatiAltri) return h('p', { class: 'nota' }, 'Leggo gli orari occupati dai tuoi calendari…');

        const proposte = proponiBlocchi({ durataMin: st.durata, occupati: tuttiOccupati() });
        if (!st.manuale) st.manuale = perCampo(proposte[0]?.inizio || new Date(Math.ceil(Date.now() / 900000) * 900000));
        if (st.scelta !== 'manuale' && st.scelta >= proposte.length) st.scelta = proposte.length ? 0 : 'manuale';

        const scelto = () => {
          if (st.scelta === 'manuale') {
            const inizio = daCampo(st.manuale);
            return { inizio, fine: new Date(inizio.getTime() + st.durata * 60000) };
          }
          return proposte[st.scelta];
        };
        const s = scelto();
        const note = [];
        if (s) {
          if (!eLibero(s.inizio, s.fine, tuttiOccupati())) note.push('Attenzione: si sovrappone a un orario occupato.');
          if (!dentroLeFasce(s.inizio, s.fine)) note.push('Fuori dalle fasce di lavoro abituali.');
          if (s.inizio.getTime() < Date.now()) note.push('L\'orario scelto è già passato.');
        }
        // Occhio al tempo: carico settimanale del progetto con il nuovo blocco.
        let carico = null;
        if (s && progetto) {
          const ids = new Set(attivitaDelProgetto(progetto.id).map((x) => x.id));
          const altri = S.blocchi.filter((b) => ids.has(b.attivita_id) && b.id !== bloccoId);
          const giorno = giornoRoma(s.inizio);
          const totale = minutiNellaSettimana(altri, giorno) + st.durata;
          const limite = progetto.limite_ore_settimana ? progetto.limite_ore_settimana * 60 : null;
          carico = h('p', { class: limite && totale > limite ? 'nota allerta' : 'nota' },
            `${progetto.nome}, settimana del ${giornoTesto(lunediDi(giorno))}: ${durataTesto(totale)} pianificate con questo blocco`,
            limite ? ` su ${durataTesto(limite)} di limite${totale > limite ? ' — limite superato' : ''}.` : '.');
        }

        const opzione = (valore, etichetta, extra) => h('label', { class: `opzione ${st.scelta === valore ? 'attiva' : ''}` },
          h('input', { type: 'radio', name: 'proposta', checked: st.scelta === valore, onchange: () => { st.scelta = valore; finestra.ridisegna(); } }),
          h('span', {}, etichetta), extra);

        return h('div', { class: 'modulo' },
          h('p', {}, h('strong', {}, a.titolo)),
          esistente ? h('p', { class: 'nota' }, `Ora: ${intervalloTesto(esistente.inizio, esistente.fine)}`) : null,
          riga('Durata del blocco (minuti)', h('input', {
            type: 'number', min: 5, step: 5, value: st.durata,
            onchange: (e) => { st.durata = Math.max(5, Math.round(+e.target.value || 60)); finestra.ridisegna(); },
          })),
          h('fieldset', { class: 'opzioni' },
            h('legend', {}, 'Proposte libere nei prossimi 14 giorni'),
            proposte.map((p, i) => opzione(i, intervalloTesto(p.inizio, p.fine))),
            proposte.length ? null : h('p', { class: 'nota' }, 'Nessuno spazio libero nelle fasce abituali: scegli tu un orario.'),
            opzione('manuale', 'Scelgo io: ', h('input', {
              type: 'datetime-local', step: 300, value: st.manuale,
              onfocus: () => { if (st.scelta !== 'manuale') { st.scelta = 'manuale'; } },
              onchange: (e) => { if (e.target.value) { st.manuale = e.target.value; st.scelta = 'manuale'; finestra.ridisegna(); } },
            }))),
          h('p', { class: 'nota' }, `Orari occupati letti da ${st.letti} calendari (solo orari, nessun titolo) e dai blocchi di Alfred.`),
          note.map((n) => h('p', { class: 'nota allerta' }, n)),
          carico,
          h('div', { class: 'azioni' },
            h('button', { onclick: () => finestra.chiudi() }, 'Annulla'),
            h('button', { class: 'primario', disabled: st.inCorso || !s, onclick: async () => {
              st.inCorso = true; finestra.ridisegna();
              const ok = esistente ? await spostaInGoogle(esistente, s) : await creaEScrivi(a, s);
              st.inCorso = false;
              if (ok) finestra.chiudi(); else finestra.ridisegna();
            } }, st.inCorso ? 'Scrivo…' : (esistente ? 'Conferma lo spostamento' : 'Conferma e scrivi su «Alfred prova»'))));
      },
    });

    async function carica() {
      st.errore = null; st.occupatiAltri = null; f?.ridisegna();
      try {
        const da = new Date(), fine = new Date(da.getTime() + 15 * 86400000);
        da.setMinutes(0, 0, 0);
        const r = await occupati(da, fine);
        st.occupatiAltri = r.occupati; st.letti = r.calendari_letti;
      } catch (e) { st.errore = e.message; }
      f.ridisegna();
    }
    if (googleCollegato()) carica();
  });
}

async function creaEScrivi(a, s) {
  let blocco;
  try {
    blocco = await crea('blocchi', { attivita_id: a.id, inizio: s.inizio.toISOString(), fine: s.fine.toISOString() });
  } catch (e) { avviso(e.message, 'errore'); return false; }
  await scriviBlocco(blocco.id);
  return true; // se Google non ha risposto, il blocco resta visibile come «non ancora scritto»
}

async function spostaInGoogle(b, s) {
  try {
    const r = await chiama('sposta_blocco', { blocco_id: b.id, inizio: s.inizio.toISOString(), fine: s.fine.toISOString() });
    if (r.conflitto) {
      await sincronizzaSilenzioso();
      avviso('Questo blocco è stato modificato nel frattempo in Google Calendar. Ho recepito la versione di Google e non ho sovrascritto nulla: controlla il nuovo orario e, se serve, sposta di nuovo.', 'errore');
      return false;
    }
    await sincronizzaSilenzioso();
    avviso('Blocco spostato.');
    return true;
  } catch (e) { avviso(e.message, 'errore'); return false; }
}

/** Conferma di fine blocco: la durata è proposta, non registrata finché non si conferma. */
export function apriEsito(bloccoId) {
  return new Promise((fatto) => {
    const b = trova('blocchi', bloccoId);
    const a = trova('attivita', b?.attivita_id);
    if (!b || !a) { fatto(); return; }
    const minuti = h('input', { type: 'number', min: 1, step: 1, value: minutiBlocco(b) });
    const completata = h('input', { type: 'checkbox' });
    const f = apriFinestra({
      titolo: 'Com\'è andata?',
      allaChiusura: () => fatto(),
      corpo: h('div', { class: 'modulo' },
        h('p', {}, h('strong', {}, a.titolo)),
        h('p', { class: 'nota' }, `Blocco terminato: ${intervalloTesto(b.inizio, b.fine)}. L'attività resta aperta finché non decidi tu.`),
        h('section', { class: 'riquadro' },
          h('h3', {}, 'Ci ho lavorato'),
          riga('Minuti effettivi', minuti, `Proposta: ${minutiBlocco(b)} minuti, la durata del blocco. Correggi se è andata diversamente.`),
          h('label', { class: 'spunta' }, completata, ' L\'attività è completata'),
          h('div', { class: 'azioni' }, h('button', { class: 'primario', onclick: async () => {
            const m = Math.round(+minuti.value);
            if (!(m > 0)) { avviso('Indica i minuti effettivi.', 'errore'); return; }
            try {
              await crea('registrazioni_tempo', { attivita_id: a.id, blocco_id: b.id, minuti: m, giorno: giornoRoma(b.inizio) });
              await modifica('blocchi', b.id, { stato: 'svolto' });
              if (completata.checked) await modifica('attivita', a.id, { stato: 'completata', completata_il: new Date().toISOString() });
              else if (a.stato === 'da_fare') await modifica('attivita', a.id, { stato: 'in_corso' });
              await annota('blocco_svolto', { attivita_id: a.id, blocco_id: b.id, dettaglio: { minuti: m, proposti: minutiBlocco(b), completata: completata.checked } });
              avviso(`Registrati ${durataTesto(m)}.`);
              f.chiudi();
            } catch (e) { avviso(e.message, 'errore'); }
          } }, 'Conferma il tempo'))),
        h('section', { class: 'riquadro' },
          h('h3', {}, 'L\'ho saltato'),
          h('p', { class: 'nota' }, 'Nessun tempo registrato. L\'attività torna in «Da pianificare»; il blocco resta nella cronologia.'),
          h('div', { class: 'azioni' }, h('button', { onclick: async () => {
            try {
              await modifica('blocchi', b.id, { stato: 'saltato' });
              await annota('blocco_saltato', { attivita_id: a.id, blocco_id: b.id, dettaglio: { inizio: b.inizio, fine: b.fine } });
              avviso('Segnato come saltato: l\'attività è in «Da pianificare».');
              f.chiudi();
            } catch (e) { avviso(e.message, 'errore'); }
          } }, 'Segna come saltato')))),
    });
  });
}

/** Registrazione manuale di tempo effettivo, senza blocco. */
export function apriRegistraTempo(attivitaId) {
  return new Promise((fatto) => {
    const minuti = h('input', { type: 'number', min: 1, step: 1, placeholder: 'minuti' });
    const giorno = h('input', { type: 'date', value: giornoRoma(new Date()) });
    const nota = h('input', { type: 'text' });
    const f = apriFinestra({
      titolo: 'Registra tempo',
      allaChiusura: () => fatto(),
      corpo: h('form', { class: 'modulo', onsubmit: async (e) => {
        e.preventDefault();
        const m = Math.round(+minuti.value);
        if (!(m > 0) || !giorno.value) { avviso('Indica minuti e giorno.', 'errore'); return; }
        try {
          await crea('registrazioni_tempo', { attivita_id: attivitaId, minuti: m, giorno: giorno.value, nota: nota.value.trim() });
          f.chiudi();
        } catch (err) { avviso(err.message, 'errore'); }
      } },
        riga('Minuti effettivi', minuti), riga('Giorno', giorno), riga('Nota (facoltativa)', nota),
        h('div', { class: 'azioni' },
          h('button', { type: 'button', onclick: () => f.chiudi() }, 'Annulla'),
          h('button', { type: 'submit', class: 'primario' }, 'Registra'))),
    });
  });
}
