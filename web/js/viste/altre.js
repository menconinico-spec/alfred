// Elenco delle attività, gestione del tempo, dati e collegamenti.

import { h, avviso, conferma, apriFinestra } from '../ui.js';
import {
  S, sb, contesto, attivitaDelProgetto, schedeDi, sottoschedeDi,
  esporta, anteprimaRipristino, ripristina,
} from '../archivio.js';
import { sincronizza, googleCollegato } from '../google.js';
import { CONFIG } from '../../config.js';
import { STATI, eAperta, riepilogoTempo, minutiNellaSettimana } from '../stato.js';
import { durataTesto, giornoRoma, giornoTesto, lunediDi, dataOraTesto, intervalloTesto } from '../fuso.js';
import { cartellino, colore } from './attivita.js';

// ---------- elenco attività ----------

const filtro = { stato: 'aperte', progetto: '' };

export function vistaElenco(ridisegna) {
  let voci = S.attivita.filter((a) => a.tipo === 'attivita');
  if (filtro.stato === 'aperte') voci = voci.filter(eAperta);
  else if (filtro.stato !== 'tutte') voci = voci.filter((a) => a.stato === filtro.stato);
  if (filtro.progetto) voci = voci.filter((a) => contesto(a).progetto?.id === filtro.progetto);
  voci.sort((a, b) => (a.scadenza || '9999').localeCompare(b.scadenza || '9999') || a.creato_il.localeCompare(b.creato_il));

  const scegli = (campo) => (e) => { filtro[campo] = e.target.value; ridisegna(); };
  return h('div', { class: 'pagina' },
    h('header', { class: 'testata' }, h('h1', {}, 'Attività'),
      h('div', { class: 'azioni strette' },
        h('select', { 'aria-label': 'Filtra per stato', onchange: scegli('stato') },
          h('option', { value: 'aperte', selected: filtro.stato === 'aperte' }, 'Aperte'),
          Object.entries(STATI).map(([k, v]) => h('option', { value: k, selected: filtro.stato === k }, v)),
          h('option', { value: 'tutte', selected: filtro.stato === 'tutte' }, 'Tutte')),
        h('select', { 'aria-label': 'Filtra per progetto', onchange: scegli('progetto') },
          h('option', { value: '' }, 'Tutti i progetti'),
          S.progetti.map((p) => h('option', { value: p.id, selected: filtro.progetto === p.id }, p.nome))))),
    h('p', { class: 'nota' }, `${voci.length} attività, ordinate per scadenza. Le nuove attività si aggiungono dentro le schede dei progetti.`),
    h('div', { class: 'elenco' }, voci.map((a) => cartellino(a, { conProgetto: true }))));
}

// ---------- gestione del tempo ----------

const ore = (minuti, vuoto) => (minuti == null ? vuoto : durataTesto(minuti));

export function vistaTempo() {
  const oggi = giornoRoma(new Date());
  return h('div', { class: 'pagina' },
    h('header', { class: 'testata' }, h('h1', {}, 'Gestione del tempo')),
    h('p', { class: 'nota' }, 'Previsto: somma delle durate che hai indicato. Pianificato: blocchi in calendario. Effettivo: solo tempi che hai confermato tu. Dove manca un dato trovi scritto che manca, non uno zero.'),
    S.progetti.map((p) => {
      const tutte = attivitaDelProgetto(p.id);
      const ids = new Set(tutte.map((a) => a.id));
      const blocchi = S.blocchi.filter((b) => ids.has(b.attivita_id));
      const tot = riepilogoTempo(tutte, blocchi, S.registrazioni_tempo);
      const settimana = minutiNellaSettimana(blocchi, oggi);
      const limite = p.limite_ore_settimana ? p.limite_ore_settimana * 60 : null;
      const effSettimana = S.registrazioni_tempo
        .filter((r) => ids.has(r.attivita_id) && lunediDi(r.giorno) === lunediDi(oggi)).reduce((s, r) => s + r.minuti, 0);
      return h('section', { class: 'riquadro tempo-progetto', style: `--colore:${colore(p)}` },
        h('h2', {}, h('span', { class: 'pallino' }), p.nome),
        h('div', { class: 'cifre' },
          cifra('Previsto', ore(tot.previsti, 'non indicato'), tot.senzaDurata ? `${tot.senzaDurata} attività senza durata prevista` : null),
          cifra('Pianificato', durataTesto(tot.pianificati)),
          cifra('Effettivo', ore(tot.effettivi, 'nessuna registrazione'))),
        h('h3', {}, `Questa settimana (dal ${giornoTesto(lunediDi(oggi))})`),
        limite ? h('div', {},
          h('div', { class: 'barra', role: 'img', 'aria-label': `${durataTesto(settimana)} pianificate su ${durataTesto(limite)}` },
            h('span', { class: settimana > limite ? 'oltre' : '', style: `width:${Math.min(100, (settimana / limite) * 100)}%` })),
          h('p', { class: settimana > limite ? 'nota allerta' : 'nota' },
            `${durataTesto(settimana)} pianificate su ${durataTesto(limite)} di limite settimanale${settimana > limite ? ' — limite superato' : ''}. Effettive confermate: ${effSettimana ? durataTesto(effSettimana) : 'nessuna'}.`))
          : h('p', { class: 'nota' }, `${durataTesto(settimana)} pianificate. Effettive confermate: ${effSettimana ? durataTesto(effSettimana) : 'nessuna'}.`),
        h('h3', {}, 'Per scheda'),
        h('div', { class: 'tabella-scorri' }, h('table', {},
          h('thead', {}, h('tr', {}, ['Scheda', 'Attività', 'Previsto', 'Pianificato', 'Effettivo'].map((t) => h('th', {}, t)))),
          h('tbody', {}, schedeDi(p.id).filter((s) => !s.fissa).map((s) => {
            const sotto = new Set(sottoschedeDi(s.id).map((x) => x.id));
            const r = riepilogoTempo(tutte.filter((a) => sotto.has(a.sottoscheda_id)), blocchi, S.registrazioni_tempo);
            return h('tr', {}, h('td', {}, s.titolo), h('td', {}, r.attivita),
              h('td', {}, ore(r.previsti, '—'), r.senzaDurata ? h('small', {}, ` (${r.senzaDurata} senza durata)`) : null),
              h('td', {}, durataTesto(r.pianificati)), h('td', {}, ore(r.effettivi, '—')));
          })))));
    }));
}

const cifra = (etichetta, valore, nota) => h('div', { class: 'cifra' }, h('small', {}, etichetta), h('strong', {}, valore), nota ? h('small', {}, nota) : null);

// ---------- dati e collegamenti ----------

const TESTI_CRONOLOGIA = {
  calendario_creato: () => 'Creato il calendario «Alfred prova»',
  blocco_scritto: (d) => `Blocco scritto su Google: ${intervalloTesto(d.inizio, d.fine)}`,
  blocco_spostato_da_alfred: (d) => `Blocco spostato da Alfred: da ${intervalloTesto(d.da_inizio, d.da_fine)} a ${intervalloTesto(d.a_inizio, d.a_fine)}`,
  blocco_tolto_da_alfred: (d) => `Blocco tolto dal calendario: ${intervalloTesto(d.inizio, d.fine)}`,
  spostato_in_google: (d) => `«${d.titolo}» spostato in Google: da ${intervalloTesto(d.da_inizio, d.da_fine)} a ${intervalloTesto(d.a_inizio, d.a_fine)}`,
  rimosso_in_google: (d) => `«${d.titolo}» rimosso in Google (era ${intervalloTesto(d.inizio, d.fine)}): l'attività torna in «Da pianificare»`,
  giornata_intera_in_google: (d) => `«${d.titolo}» è stato trasformato in Google in un evento di giornata intera: Alfred non ha cambiato nulla`,
  blocco_svolto: (d) => `Tempo confermato: ${durataTesto(d.minuti)} (proposti ${durataTesto(d.proposti)})${d.completata ? ', attività completata' : ''}`,
  blocco_saltato: (d) => `Blocco saltato: ${intervalloTesto(d.inizio, d.fine)}`,
  ripristino: (d) => `Ripristinata la copia del ${dataOraTesto(d.copia_del)}`,
  esportazione: () => 'Esportata una copia dei dati',
};

export const testoCronologia = (c) => {
  try { return (TESTI_CRONOLOGIA[c.tipo] || (() => c.tipo))(c.dettaglio || {}); } catch { return c.tipo; }
};

export function collegaGoogle() {
  return sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: location.origin + location.pathname,
      scopes: CONFIG.permessiGoogle,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
}

export function vistaDati(ridisegna) {
  const ultimaCopia = localStorage.getItem('alfred-ultima-copia');
  const giorniCopia = ultimaCopia ? Math.floor((Date.now() - new Date(ultimaCopia).getTime()) / 86400000) : null;

  const scarica = async () => {
    try {
      const copia = await esporta();
      const url = URL.createObjectURL(new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' }));
      const nome = `alfred-copia-${giornoRoma(new Date())}.json`;
      h('a', { href: url, download: nome }).click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      localStorage.setItem('alfred-ultima-copia', copia.esportato_il);
      avviso(`Copia scaricata: ${nome}`);
      ridisegna();
    } catch (e) { avviso(e.message, 'errore'); }
  };

  const scegliFile = h('input', { type: 'file', accept: 'application/json,.json', class: 'nascosto', onchange: async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let copia, anteprima;
    try { copia = JSON.parse(await file.text()); anteprima = anteprimaRipristino(copia); } catch (err) {
      avviso(`Il file non è leggibile come copia di Alfred: ${err.message}`, 'errore'); return;
    }
    const f = apriFinestra({
      titolo: 'Anteprima del ripristino',
      corpo: h('div', {},
        h('p', {}, `Copia del ${dataOraTesto(copia.esportato_il)}.`),
        h('div', { class: 'tabella-scorri' }, h('table', {},
          h('thead', {}, h('tr', {}, ['Dati', 'Nella copia', 'Da aggiungere', 'Già presenti'].map((t) => h('th', {}, t)))),
          h('tbody', {}, anteprima.map((r) => h('tr', {}, h('td', {}, r.tabella.replace('_', ' ')), h('td', {}, r.totale), h('td', {}, r.nuove), h('td', {}, r.giaPresenti)))))),
        h('p', { class: 'nota' }, 'Le righe mancanti vengono aggiunte. Quelle già presenti tornano ai valori della copia. Ciò che hai creato dopo la copia resta. Google Calendar non viene toccato.'),
        h('div', { class: 'azioni' },
          h('button', { onclick: () => f.chiudi() }, 'Annulla'),
          h('button', { class: 'primario', onclick: async () => {
            try { await ripristina(copia); avviso('Ripristino completato.'); f.chiudi(); } catch (err) { avviso(err.message, 'errore'); }
          } }, 'Ripristina'))),
    });
  } });

  return h('div', { class: 'pagina' },
    h('header', { class: 'testata' }, h('h1', {}, 'Dati e collegamenti')),

    h('section', { class: 'riquadro' },
      h('h2', {}, 'Google Calendar'),
      googleCollegato()
        ? h('div', {},
          h('p', {}, `Collegato. Alfred scrive solo sul calendario «${S.sinc.calendario_nome}»; degli altri legge soltanto gli orari occupati.`),
          h('dl', { class: 'coppie' },
            h('dt', {}, 'Ultimo allineamento riuscito'), h('dd', {}, S.sinc.ultimo_riuscito ? dataOraTesto(S.sinc.ultimo_riuscito) : 'mai'),
            S.sinc.ultimo_errore ? [h('dt', {}, 'Ultimo errore'), h('dd', { class: 'errore-testo' }, `${S.sinc.ultimo_errore} (${dataOraTesto(S.sinc.ultimo_errore_il)})`)] : null),
          h('div', { class: 'azioni sinistra' },
            h('button', { class: 'primario', onclick: async () => {
              try {
                const r = await sincronizza();
                avviso(r.modifiche.length ? `Recepite ${r.modifiche.length} modifiche fatte in Google.` : 'Allineato: nessuna novità.');
              } catch (e) { avviso(e.message, 'errore'); }
            } }, 'Aggiorna da Google'),
            h('button', { onclick: collegaGoogle }, 'Ricollega Google')))
        : h('div', {},
          h('p', {}, 'Non collegato. Collegando Google, Alfred chiede tre permessi: vedere l\'elenco dei calendari, vedere gli orari occupati, gestire solo i calendari creati da Alfred.'),
          h('div', { class: 'azioni sinistra' }, h('button', { class: 'primario', onclick: collegaGoogle }, 'Collega Google Calendar')))),

    h('section', { class: 'riquadro' },
      h('h2', {}, 'Copia di sicurezza'),
      h('p', { class: giorniCopia == null || giorniCopia >= 7 ? 'nota allerta' : 'nota' },
        giorniCopia == null ? 'Da questo dispositivo non è ancora stata scaricata nessuna copia.'
          : `Ultima copia scaricata da questo dispositivo: ${giorniCopia === 0 ? 'oggi' : `${giorniCopia} giorni fa`}.`),
      h('p', { class: 'nota' }, 'La copia è un file di testo leggibile con tutti i tuoi dati di Alfred. Conservala in un posto sicuro.'),
      h('div', { class: 'azioni sinistra' },
        h('button', { class: 'primario', onclick: scarica }, 'Esporta i dati'),
        h('button', { onclick: () => scegliFile.click() }, 'Ripristina da una copia…'), scegliFile)),

    h('section', { class: 'riquadro' },
      h('h2', {}, 'Cronologia recente'),
      S.cronologia.length ? h('ul', { class: 'cronologia' }, S.cronologia.slice(0, 40).map((c) =>
        h('li', {}, h('small', {}, dataOraTesto(c.quando)), ' ', testoCronologia(c)))) : h('p', { class: 'nota' }, 'Ancora nessuna voce.')),

    h('section', { class: 'riquadro' },
      h('h2', {}, 'Accesso'),
      h('div', { class: 'azioni sinistra' }, h('button', { onclick: async () => {
        if (await conferma('Uscire da Alfred su questo dispositivo?', 'Esci')) { await sb.auth.signOut(); location.reload(); }
      } }, 'Esci'))));
}
