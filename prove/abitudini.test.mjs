// Prove delle regole delle abitudini. Si eseguono con: npm run prove
import test from 'node:test';
import assert from 'node:assert/strict';
import { prevista, fatta, serie, andamentoMese, fatteNellaSettimana, frequenzaTesto, giornoIso, totaleFatte } from '../web/js/abitudini.js';

const base = { id: 'a', frequenza: 'giorni', giorni: [1, 2, 3, 4, 5, 6, 7], volte_settimana: 3, obiettivo: 'spunta', quantita: 1, inizio: '2026-11-02' };
const mappa = (giorni, valore = 1) => new Map(giorni.map((g) => [g, { giorno: g, valore }]));

test('il 12 novembre 2026 è un giovedì', () => assert.equal(giornoIso('2026-11-12'), 4));

test('prevista solo dall\'inizio e solo nei giorni scelti', () => {
  const ab = { ...base, giorni: [1, 3, 5] };
  assert.equal(prevista(ab, '2026-11-01'), false); // prima dell'inizio
  assert.equal(prevista(ab, '2026-11-02'), true);  // lunedì
  assert.equal(prevista(ab, '2026-11-03'), false); // martedì
});

test('a quantità è fatta solo quando la quantità è raggiunta', () => {
  const ab = { ...base, obiettivo: 'quantita', quantita: 8 };
  assert.equal(fatta(ab, { valore: 5 }), false);
  assert.equal(fatta(ab, { valore: 8 }), true);
  assert.equal(fatta(ab, undefined), false);
});

test('la serie non si interrompe se oggi non è ancora fatto, si interrompe per un giorno mancato', () => {
  const m = mappa(['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06']);
  assert.deepEqual(serie(base, m, '2026-11-07'), { attuale: 2, migliore: 2, unita: 'giorni' });
  assert.equal(serie(base, m, '2026-11-08').attuale, 0); // il 7 è passato senza registrazione
});

test('i giorni non previsti non interrompono la serie', () => {
  const ab = { ...base, giorni: [1, 3, 5] };
  const m = mappa(['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09']);
  assert.equal(serie(ab, m, '2026-11-10').attuale, 4);
});

test('volte a settimana: contano le settimane riuscite, quella in corso non interrompe', () => {
  const ab = { ...base, frequenza: 'volte_settimana', volte_settimana: 2 };
  const m = mappa(['2026-11-02', '2026-11-04', '2026-11-10']);
  assert.equal(fatteNellaSettimana(ab, m, '2026-11-02'), 2);
  assert.deepEqual(serie(ab, m, '2026-11-12'), { attuale: 1, migliore: 1, unita: 'settimane' });
  assert.equal(serie(ab, m, '2026-11-17').attuale, 0); // la settimana del 9 è finita con una sola volta
});

test('andamento del mese: fatte su previste fino a oggi; senza previste per le abitudini a volte', () => {
  const m = mappa(['2026-11-02', '2026-11-03']);
  assert.deepEqual(andamentoMese(base, m, '2026-11', '2026-11-05'), { fatte: 2, previste: 4 });
  assert.equal(andamentoMese({ ...base, frequenza: 'volte_settimana' }, m, '2026-11', '2026-11-05').previste, null);
  assert.equal(totaleFatte(base, m), 2);
});

test('descrizione della frequenza', () => {
  assert.equal(frequenzaTesto(base), 'ogni giorno');
  assert.equal(frequenzaTesto({ ...base, giorni: [1, 2, 3, 4, 5] }), 'dal lunedì al venerdì');
  assert.equal(frequenzaTesto({ ...base, giorni: [2, 4] }), 'mar, gio');
  assert.equal(frequenzaTesto({ ...base, frequenza: 'volte_settimana' }), '3 volte a settimana');
});
