// Prove delle regole delle finanze. Si eseguono con: npm run prove
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sommePerMese, totale, crescita, mesePrima, mediaEntrate, previstiScaduti, ricorreNel, quotaMensile,
  impegniMensili, totaleDebiti, ordiniDiEstinzione, statoObiettivo, leggiImporto, euro, gestioniDi,
} from '../web/js/finanze.js';

const mov = (anno, mese, gestione, campi) => ({ anno, mese, gestione, entrata: null, uscita: null, previsto: false, data: null, ...campi });
const M = [
  mov(2026, 1, 'Alfa', { entrata: 100.1 }),
  mov(2026, 1, 'Alfa', { entrata: 200.2 }),
  mov(2026, 1, 'Alfa', { entrata: 500, previsto: true, data: '2026-01-20' }),
  mov(2026, 1, 'Beta', { uscita: 40 }),
  mov(2026, 2, 'Alfa', { entrata: 450.45 }),
  mov(2026, 2, 'Beta', { uscita: 15, previsto: true, data: '2026-02-28' }),
  mov(2026, 3, 'Alfa', { entrata: 600 }),
];

test('effettivi e previsti restano separati; i centesimi non si sporcano', () => {
  const s = sommePerMese(M);
  assert.deepEqual(s.get('2026-01'), { entrate: 300.3, uscite: 40, entratePreviste: 500, uscitePreviste: 0, righe: 4 });
  assert.deepEqual(s.get('2026-02'), { entrate: 450.45, uscite: 0, entratePreviste: 0, uscitePreviste: 15, righe: 2 });
});

test('filtro per gestione e totale dell\'anno', () => {
  assert.equal(sommePerMese(M, ['Beta']).get('2026-01').uscite, 40);
  assert.equal(sommePerMese(M, ['Beta']).get('2026-01').entrate, 0);
  assert.equal(sommePerMese(M, ['Beta']).has('2026-03'), false);
  const t = totale(sommePerMese(M), (k) => k.startsWith('2026'));
  assert.equal(t.entrate, 1350.75);
  assert.equal(t.entratePreviste, 500);
  assert.deepEqual(gestioniDi(M), ['Alfa', 'Beta']);
});

test('crescita: nulla senza termine di confronto', () => {
  assert.equal(crescita(450.45, 300.3), 50);
  assert.equal(crescita(100, 0), null);
  assert.equal(crescita(100, null), null);
  assert.equal(crescita(80, 100), -20);
  assert.equal(mesePrima('2026-01'), '2025-12');
});

test('media delle entrate: solo mesi conclusi e con righe; nulla se mancano', () => {
  const m = mediaEntrate(M, [], '2026-03');
  assert.deepEqual(m, { media: 375.38, mesi: ['2026-01', '2026-02'] });
  assert.equal(mediaEntrate(M, [], '2026-01'), null);
  assert.equal(mediaEntrate(M, ['Gamma'], '2026-12'), null);
});

test('previsti con data passata', () => {
  assert.deepEqual(previstiScaduti(M, '2026-02-10').map((m) => m.data), ['2026-01-20']);
  assert.equal(previstiScaduti(M, '2026-03-01').length, 2);
});

test('ricorrenze: mensili, annuali, inizio e fine', () => {
  const mensile = { cadenza: 'mensile', importo: 9.9, inizio: '2026-03-01', fine: '2026-06-30' };
  assert.equal(ricorreNel(mensile, '2026-02'), false);
  assert.equal(ricorreNel(mensile, '2026-03'), true);
  assert.equal(ricorreNel(mensile, '2026-07'), false);
  const annuale = { cadenza: 'annuale', mese: 5, importo: 120 };
  assert.equal(ricorreNel(annuale, '2026-05'), true);
  assert.equal(ricorreNel(annuale, '2026-06'), false);
  assert.equal(ricorreNel({ ...annuale, archiviata: true }, '2026-05'), false);
  assert.equal(quotaMensile(annuale), 10);
});

test('impegni fissi: ricorrenti più rate; le rate mancanti si dichiarano', () => {
  const r = [
    { verso: 'uscita', cadenza: 'mensile', importo: 9.9 }, { verso: 'uscita', cadenza: 'annuale', mese: 1, importo: 120 },
    { verso: 'entrata', cadenza: 'mensile', importo: 999 }, { verso: 'uscita', cadenza: 'mensile', importo: 50, archiviata: true },
  ];
  const d = [{ rata: 210.1 }, { rata: 120.5 }, { rata: null }, { rata: 300, estinto: true }];
  assert.deepEqual(impegniMensili(r, d), { ricorrenti: 19.9, rate: 330.6, totale: 350.5, rateMancanti: 1 });
});

test('debiti: totale solo sui residui noti; nessuno zero inventato', () => {
  assert.deepEqual(totaleDebiti([{ residuo: null }, { residuo: null }]), { aperti: 2, residuiMancanti: 2, residuo: null });
  assert.deepEqual(totaleDebiti([{ residuo: 1000.5 }, { residuo: null }, { residuo: 9, estinto: true }]), { aperti: 2, residuiMancanti: 1, residuo: 1000.5 });
  const o = ordiniDiEstinzione([{ nome: 'a', residuo: 5000, tasso: 3 }, { nome: 'b', residuo: 800, tasso: 9 }, { nome: 'c', residuo: null, tasso: null }]);
  assert.deepEqual(o.dalPiuPiccolo.map((d) => d.nome), ['b', 'a']);
  assert.deepEqual(o.dalPiuCaro.map((d) => d.nome), ['b', 'a']);
  assert.deepEqual(o.senzaResiduo.map((d) => d.nome), ['c']);
  assert.deepEqual(o.senzaTasso.map((d) => d.nome), ['c']);
});

test('obiettivo sulle entrate mensili', () => {
  const ob = { tipo: 'entrate_mensili', importo: 1500, gestioni: ['Alfa'], entro: '2027-12-31' };
  const s = statoObiettivo(ob, M, '2026-04');
  assert.equal(s.attuale, 450.25); // (300,30 + 450,45 + 600) / 3
  assert.equal(s.manca, 1049.75);
  assert.equal(s.percento, 30);
  assert.equal(s.mesiRestanti, 20);
  assert.equal(statoObiettivo({ ...ob, gestioni: ['Gamma'] }, M, '2026-04').attuale, null);
  assert.deepEqual(statoObiettivo({ tipo: 'importo', importo: 1000, raggiunto: null }, M, '2026-04').attuale, null);
  assert.equal(statoObiettivo({ tipo: 'importo', importo: 1000, raggiunto: 250 }, M, '2026-04').percento, 25);
});

test('importi scritti all\'italiana', () => {
  assert.equal(leggiImporto('1.234,56'), 1234.56);
  assert.equal(leggiImporto('210,10 €'), 210.1);
  assert.equal(leggiImporto('1234.5'), 1234.5);
  assert.equal(leggiImporto(''), null);
  assert.equal(leggiImporto('abc'), null);
  assert.equal(euro(null), 'non indicato');
  assert.equal(euro(1234.5), '1.234,50 €');
});
