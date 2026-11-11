// Piccoli attrezzi per costruire la pagina: elementi, finestre, avvisi, testi modificabili.

/** Crea un elemento. Gli attributi che iniziano con "on" diventano ascoltatori di eventi. */
export function h(tag, attributi = {}, ...figli) {
  const el = document.createElement(tag);
  for (const [chiave, valore] of Object.entries(attributi || {})) {
    if (valore == null || valore === false) continue;
    if (chiave.startsWith('on')) el.addEventListener(chiave.slice(2), valore);
    else if (chiave === 'class') el.className = valore;
    else if (chiave === 'value') el.value = valore;
    else if (chiave === 'checked' || chiave === 'disabled' || chiave === 'selected') el[chiave] = !!valore;
    else el.setAttribute(chiave, valore === true ? '' : valore);
  }
  aggiungi(el, figli);
  return el;
}

function aggiungi(el, figli) {
  for (const f of figli.flat(Infinity)) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
}

/** Avviso breve in basso. tipo: 'ok' | 'errore' | 'nota' */
export function avviso(testo, tipo = 'ok') {
  let zona = document.getElementById('avvisi');
  if (!zona) {
    zona = h('div', { id: 'avvisi', role: 'status', 'aria-live': 'polite' });
    document.body.append(zona);
  }
  const el = h('div', { class: `avviso ${tipo}` }, testo);
  // Dentro una finestra aperta gli avvisi vanno in cima alla finestra, altrimenti resterebbero coperti.
  const aperta = [...document.querySelectorAll('dialog[open]')].pop();
  (aperta || zona).append(el);
  setTimeout(() => el.remove(), tipo === 'errore' ? 9000 : 4000);
}

/**
 * Apre una finestra. `corpo` è un elemento oppure una funzione che lo costruisce
 * (in quel caso `finestra.ridisegna()` la ricostruisce con i dati aggiornati).
 */
export function apriFinestra({ titolo, corpo, larga = false, allaChiusura }) {
  const contenuto = h('div', { class: 'finestra-corpo' });
  const dialog = h('dialog', { class: larga ? 'finestra larga' : 'finestra' },
    h('header', { class: 'finestra-testa' },
      h('h2', {}, titolo),
      h('button', { class: 'icona', 'aria-label': 'Chiudi', onclick: () => dialog.close() }, '✕')),
    contenuto);
  const finestra = {
    chiudi: () => dialog.close(),
    ridisegna: () => contenuto.replaceChildren(typeof corpo === 'function' ? corpo(finestra) : corpo),
    titolo: (t) => { dialog.querySelector('h2').textContent = t; },
  };
  dialog.addEventListener('close', () => { dialog.remove(); allaChiusura?.(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  document.body.append(dialog);
  finestra.ridisegna();
  dialog.showModal();
  return finestra;
}

/** Chiede conferma. Restituisce una promessa con vero o falso. */
export function conferma(testo, etichettaSi = 'Conferma', pericolo = false) {
  return new Promise((risolvi) => {
    let esito = false;
    const f = apriFinestra({
      titolo: 'Conferma',
      corpo: h('div', {},
        h('p', {}, testo),
        h('div', { class: 'azioni' },
          h('button', { onclick: () => f.chiudi() }, 'Annulla'),
          h('button', { class: pericolo ? 'pericolo' : 'primario', onclick: () => { esito = true; f.chiudi(); } }, etichettaSi))),
      allaChiusura: () => risolvi(esito),
    });
  });
}

/**
 * Testo che si modifica con un clic. `salva(nuovoTesto)` viene chiamata solo se il testo cambia.
 */
export function modificabile(testo, salva, { multilinea = false, segnaposto = 'Clicca per scrivere', classe = '', obbligatorio = false } = {}) {
  const el = h(multilinea ? 'div' : 'span', {
    class: `modificabile ${classe} ${testo ? '' : 'vuoto'}`, tabindex: '0', role: 'button',
    title: 'Clicca per modificare',
  }, testo || segnaposto);
  const apri = () => {
    const campo = multilinea
      ? h('textarea', { class: `campo-diretto ${classe}`, rows: Math.max(3, (testo || '').split('\n').length + 1) })
      : h('input', { class: `campo-diretto ${classe}`, type: 'text' });
    campo.value = testo || '';
    let chiuso = false;
    const chiudi = async (registra) => {
      if (chiuso) return;
      chiuso = true;
      const nuovo = campo.value.trim();
      if (registra && nuovo !== (testo || '') && (nuovo || !obbligatorio)) {
        try { await salva(nuovo); return; } catch { /* l'errore è già mostrato in alto */ }
      }
      if (campo.isConnected) campo.replaceWith(el);
    };
    campo.addEventListener('blur', () => chiudi(true));
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); chiudi(false); }
      if (e.key === 'Enter' && (!multilinea || e.metaKey || e.ctrlKey)) { e.preventDefault(); campo.blur(); }
    });
    el.replaceWith(campo);
    campo.focus();
    if (!multilinea) campo.select();
  };
  el.addEventListener('click', (e) => { e.stopPropagation(); apri(); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apri(); } });
  return el;
}

/** Riga di modulo: etichetta sopra, campo sotto. */
export function riga(etichetta, campo, aiuto) {
  return h('label', { class: 'riga' }, h('span', { class: 'etichetta' }, etichetta), campo,
    aiuto ? h('small', {}, aiuto) : null);
}

export const eTelefono = () => window.matchMedia('(max-width: 760px)').matches;
