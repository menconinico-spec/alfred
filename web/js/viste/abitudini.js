// Tracker delle abitudini: striscia della settimana, spunte del giorno, serie e calendario del mese.

import { h, apriFinestra, conferma, avviso, riga } from '../ui.js';
import { S, crea, modifica, elimina, togli, trova, prossimaPosizione, alCambio } from '../archivio.js';
import { giornoRoma, aggiungiGiorni, lunediDi, giornoTesto } from '../fuso.js';
import {
  MOMENTI, GIORNI, giornoIso, perGiorno, prevista, fatta, fatteNellaSettimana, serie, andamentoMese, totaleFatte, frequenzaTesto,
} from '../abitudini.js';

let giornoScelto = null; // resta scelto mentre si naviga nella pagina

const numero = (v) => String(Number(v)).replace('.', ',');
const meseTesto = (mese) => new Date(`${mese}-15T12:00:00Z`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Registra il valore di un giorno. Zero o meno toglie la registrazione: nessun dato, non uno zero. */
async function registra(ab, giorno, valore) {
  const esistente = S.abitudini_registrazioni.find((r) => r.abitudine_id === ab.id && r.giorno === giorno);
  try {
    if (valore <= 0) { if (esistente) await togli('abitudini_registrazioni', esistente.id); }
    else if (esistente) await modifica('abitudini_registrazioni', esistente.id, { valore });
    else await crea('abitudini_registrazioni', { abitudine_id: ab.id, giorno, valore });
  } catch (e) { avviso(e.message, 'errore'); }
}

export function vistaAbitudini() {
  const oggi = giornoRoma(new Date());
  if (!giornoScelto) giornoScelto = oggi;
  const giorno = giornoScelto, futuro = giorno > oggi;
  const lunedi = lunediDi(giorno);
  const attive = S.abitudini.filter((a) => !a.archiviata);
  const archiviate = S.abitudini.filter((a) => a.archiviata);
  const mappe = new Map(S.abitudini.map((a) => [a.id, perGiorno(S.abitudini_registrazioni, a.id)]));

  const delGiorno = (g) => attive.filter((a) => prevista(a, g));
  const conto = (g) => { const p = delGiorno(g); return { fatte: p.filter((a) => fatta(a, mappe.get(a.id).get(g))).length, totale: p.length }; };
  const previste = delGiorno(giorno);
  const altre = attive.filter((a) => !previste.includes(a));
  const c = conto(giorno);

  const striscia = h('div', { class: 'striscia-settimana' },
    h('button', { class: 'icona', 'aria-label': 'Settimana precedente', onclick: () => scegli(aggiungiGiorni(giorno, -7)) }, '◀'),
    GIORNI.map(([n, nome]) => {
      const g = aggiungiGiorni(lunedi, n - 1), k = conto(g);
      const pieno = k.totale && g <= oggi ? Math.round((k.fatte / k.totale) * 100) : 0;
      return h('button', {
        class: `giorno-striscia ${g === giorno ? 'scelto' : ''} ${g === oggi ? 'oggi' : ''} ${g > oggi ? 'futuro' : ''}`,
        style: `--pieno:${pieno}%`, 'aria-label': `${giornoTesto(g)}: ${k.fatte} su ${k.totale}`, onclick: () => scegli(g),
      }, h('small', {}, nome), h('strong', {}, Number(g.slice(8))));
    }),
    h('button', { class: 'icona', 'aria-label': 'Settimana successiva', onclick: () => scegli(aggiungiGiorni(giorno, 7)) }, '▶'),
    giorno === oggi ? null : h('button', { class: 'piccolo', onclick: () => scegli(oggi) }, 'Oggi'));

  const rigaAbitudine = (ab) => {
    const m = mappe.get(ab.id), reg = m.get(giorno), ok = fatta(ab, reg), s = serie(ab, m, oggi);
    const valore = reg ? Number(reg.valore) : 0;
    const passo = Number(ab.quantita) >= 10 ? Math.max(1, Math.round(Number(ab.quantita) / 10)) : 1;
    const comando = ab.obiettivo === 'quantita'
      ? h('div', { class: 'quantita' },
        h('button', { class: 'icona', disabled: futuro || valore <= 0, 'aria-label': 'Togli', onclick: () => registra(ab, giorno, Math.max(0, valore - passo)) }, '−'),
        h('button', { class: `quantita-valore ${ok ? 'fatta' : ''}`, disabled: futuro, title: 'Scrivi la quantità', onclick: () => {
          const t = prompt(`${ab.nome}: quantità di ${giornoTesto(giorno)}${ab.unita ? ` (${ab.unita})` : ''}`, numero(valore));
          if (t == null) return;
          const v = Number(t.replace(',', '.'));
          if (Number.isFinite(v) && v >= 0) registra(ab, giorno, v); else avviso('Scrivi un numero.', 'errore');
        } }, `${numero(valore)} / ${numero(ab.quantita)}${ab.unita ? ` ${ab.unita}` : ''}`),
        h('button', { class: 'icona', disabled: futuro, 'aria-label': 'Aggiungi', onclick: () => registra(ab, giorno, valore + passo) }, '+'))
      : h('button', {
        class: `spunta ${ok ? 'fatta' : ''}`, disabled: futuro, role: 'checkbox', 'aria-checked': ok ? 'true' : 'false',
        'aria-label': ok ? `Togli la spunta a ${ab.nome}` : `Segna ${ab.nome} come fatta`, onclick: () => registra(ab, giorno, ok ? 0 : 1),
      }, ok ? '✓' : '');
    return h('div', { class: `abitudine ${ok ? 'fatta' : ''}` },
      comando,
      h('button', { class: 'abitudine-nome', onclick: () => apriAbitudine(ab.id) },
        h('span', {}, ab.segno ? `${ab.segno} ` : '', ab.nome),
        h('small', {}, frequenzaTesto(ab),
          ab.frequenza === 'volte_settimana' ? ` · questa settimana ${fatteNellaSettimana(ab, m, lunedi)} su ${ab.volte_settimana}` : '',
          s.attuale ? ` · serie di ${s.attuale} ${s.unita}` : '')));
  };

  return h('div', { class: 'pagina abitudini' },
    h('header', { class: 'testata' }, h('h1', {}, 'Abitudini'),
      h('button', { class: 'primario', onclick: () => apriModulo(null) }, '+ Nuova abitudine')),
    striscia,
    h('p', { class: 'nota' }, futuro ? `${giornoTesto(giorno)}: giorno futuro, non si può ancora registrare.`
      : (c.totale ? `${giorno === oggi ? 'Oggi' : giornoTesto(giorno)}: ${c.fatte} su ${c.totale} fatte.` : `${giorno === oggi ? 'Oggi' : giornoTesto(giorno)}: nessuna abitudine prevista.`)),
    attive.length ? null : h('section', { class: 'riquadro' }, h('p', {}, 'Non hai ancora abitudini. Creane una con «+ Nuova abitudine»: scegli i giorni, oppure quante volte a settimana, e se basta una spunta o serve una quantità.')),
    MOMENTI.map(([chiave, titolo]) => {
      const voci = previste.filter((a) => a.momento === chiave);
      return voci.length ? h('section', { class: 'riquadro' }, h('h2', {}, titolo), voci.map(rigaAbitudine)) : null;
    }),
    altre.length ? h('section', { class: 'riquadro tenue' }, h('h2', {}, 'Non previste in questo giorno'),
      h('div', { class: 'fila' }, altre.map((ab) => h('button', { class: 'piccolo', onclick: () => apriAbitudine(ab.id) }, ab.segno ? `${ab.segno} ` : '', ab.nome, ` · ${frequenzaTesto(ab)}`)))) : null,
    archiviate.length ? h('section', { class: 'riquadro tenue' }, h('h2', {}, `Archiviate (${archiviate.length})`),
      h('div', { class: 'fila' }, archiviate.map((ab) => h('button', { class: 'piccolo', onclick: () => apriAbitudine(ab.id) }, ab.segno ? `${ab.segno} ` : '', ab.nome)))) : null);
}

function scegli(g) { giornoScelto = g; window.dispatchEvent(new HashChangeEvent('hashchange')); }

/** Scheda di un'abitudine: numeri, calendario del mese, modifica. */
export function apriAbitudine(id) {
  const oggi = giornoRoma(new Date());
  let mese = (giornoScelto || oggi).slice(0, 7);
  const sposta = (n) => {
    const [a, m] = mese.split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 1 + n, 1));
    mese = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    f.ridisegna();
  };
  const f = apriFinestra({
    titolo: 'Abitudine', larga: true,
    allaChiusura: () => smetti(),
    corpo: (finestra) => {
      const ab = trova('abitudini', id);
      if (!ab) return h('p', { class: 'nota' }, 'Abitudine non trovata.');
      finestra.titolo(`${ab.segno ? `${ab.segno} ` : ''}${ab.nome}`);
      const m = perGiorno(S.abitudini_registrazioni, ab.id), s = serie(ab, m, oggi), and = andamentoMese(ab, m, mese, oggi);
      const primo = `${mese}-01`, vuoti = giornoIso(primo) - 1;
      const giorni = [];
      for (let g = primo; g.startsWith(mese); g = aggiungiGiorni(g, 1)) giorni.push(g);
      return h('div', { class: 'modulo' },
        h('p', { class: 'nota' }, `${frequenzaTesto(ab)}${ab.obiettivo === 'quantita' ? ` · obiettivo ${numero(ab.quantita)} ${ab.unita}` : ''} · dal ${giornoTesto(ab.inizio)}${ab.archiviata ? ' · archiviata' : ''}`),
        ab.nota ? h('p', {}, ab.nota) : null,
        h('div', { class: 'cifre' },
          h('div', { class: 'cifra' }, h('small', {}, 'Serie attuale'), h('strong', {}, `${s.attuale} ${s.unita}`)),
          h('div', { class: 'cifra' }, h('small', {}, 'Serie migliore'), h('strong', {}, `${s.migliore} ${s.unita}`)),
          h('div', { class: 'cifra' }, h('small', {}, 'Totale volte'), h('strong', {}, totaleFatte(ab, m)))),
        h('div', { class: 'mese-testa' },
          h('button', { class: 'icona', 'aria-label': 'Mese precedente', onclick: () => sposta(-1) }, '◀'),
          h('strong', {}, meseTesto(mese)),
          h('button', { class: 'icona', 'aria-label': 'Mese successivo', onclick: () => sposta(1) }, '▶'),
          h('span', { class: 'spazio' }),
          h('span', { class: 'nota' }, and.previste == null ? `${and.fatte} volte nel mese`
            : (and.previste ? `${and.fatte} su ${and.previste} (${Math.round((and.fatte / and.previste) * 100)}%)` : 'nessun giorno previsto finora'))),
        h('div', { class: 'mese' },
          GIORNI.map(([, nome]) => h('small', {}, nome)),
          Array.from({ length: vuoti }, () => h('span', {})),
          giorni.map((g) => {
            const reg = m.get(g), ok = fatta(ab, reg), prev = prevista(ab, g), fut = g > oggi;
            const stato = ok ? 'fatta' : (reg ? 'parziale' : (fut || !prev ? 'neutro' : (g === oggi ? 'neutro' : 'mancata')));
            return h('button', {
              class: `giorno-mese ${stato} ${g === oggi ? 'oggi' : ''}`, disabled: fut || g < ab.inizio,
              'aria-label': `${giornoTesto(g)}: ${ok ? 'fatta' : 'non fatta'}`,
              title: ab.obiettivo === 'quantita' && reg ? `${numero(reg.valore)} ${ab.unita}` : '',
              onclick: () => registra(ab, g, ok ? 0 : Number(ab.obiettivo === 'quantita' ? ab.quantita : 1)),
            }, Number(g.slice(8)));
          })),
        h('p', { class: 'nota' }, 'Verde: fatta. Bordo rosso: prevista e non registrata. Un clic su un giorno passato aggiunge o toglie la registrazione.'),
        h('div', { class: 'azioni' },
          h('button', { class: 'pericolo-tenue', onclick: async () => {
            if (await conferma(`Eliminare «${ab.nome}» con tutta la sua storia (${m.size} registrazioni)? Non si può annullare. Se vuoi solo smettere di vederla, archiviala.`, 'Elimina', true)) {
              try { await elimina('abitudini', ab.id); finestra.chiudi(); } catch (e) { avviso(e.message, 'errore'); }
            }
          } }, 'Elimina'),
          h('span', { class: 'spazio' }),
          h('button', { onclick: () => modifica('abitudini', ab.id, { archiviata: !ab.archiviata }).catch((e) => avviso(e.message, 'errore')) }, ab.archiviata ? 'Riattiva' : 'Archivia'),
          h('button', { class: 'primario', onclick: () => apriModulo(ab) }, 'Modifica')));
    },
  });
  const smetti = alCambio(() => f.ridisegna());
}

/** Modulo per creare o modificare un'abitudine. */
function apriModulo(ab) {
  const oggi = giornoRoma(new Date());
  const st = {
    frequenza: ab?.frequenza ?? 'giorni', giorni: new Set(ab?.giorni ?? [1, 2, 3, 4, 5, 6, 7]), obiettivo: ab?.obiettivo ?? 'spunta',
  };
  const c = {
    nome: h('input', { type: 'text', required: true, value: ab?.nome ?? '', placeholder: 'Per esempio: Lettura' }),
    segno: h('input', { type: 'text', maxlength: 4, value: ab?.segno ?? '', placeholder: '📖', class: 'corto' }),
    momento: h('select', {}, MOMENTI.map(([k, t]) => h('option', { value: k, selected: (ab?.momento ?? 'qualsiasi') === k }, t))),
    volte: h('input', { type: 'number', min: 1, max: 7, step: 1, value: ab?.volte_settimana ?? 3, class: 'corto' }),
    quantita: h('input', { type: 'number', min: 0, step: 'any', value: ab ? Number(ab.quantita) : 1, class: 'corto' }),
    unita: h('input', { type: 'text', value: ab?.unita ?? '', placeholder: 'minuti, pagine, bicchieri…' }),
    inizio: h('input', { type: 'date', value: ab?.inizio ?? oggi, required: true }),
    nota: h('textarea', { rows: 2, placeholder: 'Facoltativa: perché la fai, come la fai' }),
  };
  c.nota.value = ab?.nota ?? '';
  const f = apriFinestra({
    titolo: ab ? 'Modifica abitudine' : 'Nuova abitudine',
    corpo: (finestra) => h('form', { class: 'modulo', onsubmit: async (e) => {
      e.preventDefault();
      const nome = c.nome.value.trim();
      if (!nome) return;
      if (st.frequenza === 'giorni' && !st.giorni.size) { avviso('Scegli almeno un giorno.', 'errore'); return; }
      const campi = {
        nome, segno: c.segno.value.trim(), momento: c.momento.value, frequenza: st.frequenza,
        giorni: [...st.giorni].sort(), volte_settimana: Math.min(7, Math.max(1, Math.round(+c.volte.value || 1))),
        obiettivo: st.obiettivo, quantita: st.obiettivo === 'quantita' ? Math.max(0.01, +c.quantita.value || 1) : 1,
        unita: st.obiettivo === 'quantita' ? c.unita.value.trim() : '', inizio: c.inizio.value || oggi, nota: c.nota.value.trim(),
      };
      try {
        if (ab) await modifica('abitudini', ab.id, campi);
        else await crea('abitudini', { ...campi, posizione: prossimaPosizione(S.abitudini) });
        finestra.chiudi();
      } catch (err) { avviso(err.message, 'errore'); }
    } },
      h('div', { class: 'griglia-campi' }, riga('Nome', c.nome), riga('Simbolo (facoltativo)', c.segno)),
      h('fieldset', { class: 'opzioni' }, h('legend', {}, 'Quando'),
        h('label', { class: 'opzione' }, h('input', { type: 'radio', name: 'freq', checked: st.frequenza === 'giorni', onchange: () => { st.frequenza = 'giorni'; finestra.ridisegna(); } }), h('span', {}, 'In giorni precisi')),
        st.frequenza === 'giorni' ? h('div', { class: 'fila giorni-scelta' }, GIORNI.map(([n, nome]) => h('label', { class: `pastiglia ${st.giorni.has(n) ? 'attiva' : ''}` },
          h('input', { type: 'checkbox', checked: st.giorni.has(n), onchange: (e) => { e.target.checked ? st.giorni.add(n) : st.giorni.delete(n); finestra.ridisegna(); } }), nome))) : null,
        h('label', { class: 'opzione' }, h('input', { type: 'radio', name: 'freq', checked: st.frequenza === 'volte_settimana', onchange: () => { st.frequenza = 'volte_settimana'; finestra.ridisegna(); } }), h('span', {}, 'Un certo numero di volte a settimana, nei giorni che capitano')),
        st.frequenza === 'volte_settimana' ? riga('Volte a settimana', c.volte) : null),
      h('fieldset', { class: 'opzioni' }, h('legend', {}, 'Come si considera fatta'),
        h('label', { class: 'opzione' }, h('input', { type: 'radio', name: 'ob', checked: st.obiettivo === 'spunta', onchange: () => { st.obiettivo = 'spunta'; finestra.ridisegna(); } }), h('span', {}, 'Con una spunta')),
        h('label', { class: 'opzione' }, h('input', { type: 'radio', name: 'ob', checked: st.obiettivo === 'quantita', onchange: () => { st.obiettivo = 'quantita'; finestra.ridisegna(); } }), h('span', {}, 'Quando raggiungo una quantità')),
        st.obiettivo === 'quantita' ? h('div', { class: 'griglia-campi' }, riga('Quantità al giorno', c.quantita), riga('Unità', c.unita)) : null),
      h('div', { class: 'griglia-campi' }, riga('Momento della giornata', c.momento), riga('A partire dal', c.inizio)),
      riga('Nota', c.nota),
      h('div', { class: 'azioni' },
        h('button', { type: 'button', onclick: () => finestra.chiudi() }, 'Annulla'),
        h('button', { type: 'submit', class: 'primario' }, ab ? 'Salva' : 'Crea l\'abitudine'))),
  });
  setTimeout(() => c.nome.focus(), 50);
  return f;
}
