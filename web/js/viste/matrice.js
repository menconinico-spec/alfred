// Matrice di Eisenhower (importanza e urgenza distinte) con la lista «Da pianificare».

import { h, avviso } from '../ui.js';
import { S, modifica, blocchiDi, registrazioniDi, trova } from '../archivio.js';
import { eAperta, eDaPianificare } from '../stato.js';
import { cartellino, apriPianifica } from './attivita.js';

const QUADRANTI = [
  [true, true, 'Importante e urgente', 'Fare subito'],
  [true, false, 'Importante, non urgente', 'Pianificare'],
  [false, true, 'Urgente, non importante', 'Delegare o ridurre'],
  [false, false, 'Né importante né urgente', 'Eliminare o rimandare'],
];

export function listaDaPianificare() {
  return S.attivita.filter((a) => eDaPianificare(a, blocchiDi(a.id), registrazioniDi(a.id)));
}

export function vistaMatrice() {
  const aperte = S.attivita.filter(eAperta);
  const daPianificare = listaDaPianificare();
  const daValutare = aperte.filter((a) => a.importante == null || a.urgente == null);

  const bersaglio = (el, campi) => {
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('bersaglio'); });
    el.addEventListener('dragleave', () => el.classList.remove('bersaglio'));
    el.addEventListener('drop', async (e) => {
      e.preventDefault(); el.classList.remove('bersaglio');
      const a = trova('attivita', e.dataTransfer.getData('text/plain'));
      if (!a) return;
      try { await modifica('attivita', a.id, campi); } catch (err) { avviso(err.message, 'errore'); }
    });
    return el;
  };

  return h('div', { class: 'pagina' },
    h('header', { class: 'testata' }, h('h1', {}, 'Matrice')),
    h('div', { class: 'matrice-disposizione' },
      h('section', { class: 'riquadro da-pianificare' },
        h('h2', {}, `Da pianificare (${daPianificare.length})`),
        h('p', { class: 'nota' }, 'Attività aperte senza un blocco futuro: nuove, saltate o rimaste senza collocazione.'),
        daPianificare.length ? null : h('p', { class: 'nota' }, 'Niente da pianificare.'),
        daPianificare.map((a) => h('div', { class: 'con-azione' },
          cartellino(a, { conProgetto: true, trascinabile: true }),
          h('button', { class: 'primario piccolo', onclick: () => apriPianifica(a.id) }, 'Pianifica')))),
      h('div', { class: 'matrice-destra' },
        daValutare.length ? h('section', { class: 'riquadro' },
          h('h2', {}, `Da valutare (${daValutare.length})`),
          h('p', { class: 'nota' }, 'Importanza o urgenza non ancora indicate. Apri l\'attività oppure, da Mac, trascinala in un riquadro.'),
          h('div', { class: 'fila' }, daValutare.map((a) => cartellino(a, { conProgetto: true, trascinabile: true })))) : null,
        h('div', { class: 'matrice' }, QUADRANTI.map(([imp, urg, titolo, consiglio], i) =>
          bersaglio(h('section', { class: `quadrante q${i + 1}` },
            h('h2', {}, titolo), h('p', { class: 'nota' }, consiglio),
            aperte.filter((a) => a.importante === imp && a.urgente === urg)
              .map((a) => cartellino(a, { conProgetto: true, trascinabile: true }))), { importante: imp, urgente: urg }))))));
}
