// Prove delle regole di calcolo. Avvio: node --test prove/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fuso from '../web/js/fuso.js';
import { proponiBlocchi, eLibero, dentroLeFasce, unisciOccupati } from '../web/js/proposta.js';
import * as stato from '../web/js/stato.js';

test('fuso: ora solare e ora legale', () => {
  assert.equal(fuso.daRoma(2026, 11, 11, 10, 0).toISOString(), '2026-11-11T09:00:00.000Z');
  assert.equal(fuso.daRoma(2026, 7, 1, 10, 0).toISOString(), '2026-07-01T08:00:00.000Z');
  assert.equal(fuso.oraTesto('2026-07-01T08:00:00Z'), '10:00');
  assert.equal(fuso.giornoRoma('2026-11-11T23:30:00Z'), '2026-11-12');
});

test('fuso: i giorni del cambio d\'ora durano 23 e 25 ore', () => {
  const ore = (g) => (fuso.istanteDi(fuso.aggiungiGiorni(g, 1)) - fuso.istanteDi(g)) / 3600000;
  assert.equal(ore('2027-03-28'), 23);
  assert.equal(ore('2026-10-25'), 25);
  assert.equal(ore('2026-11-11'), 24);
});

test('fuso: andata e ritorno dal campo del modulo', () => {
  for (const t of ['2026-11-11T09:15', '2027-03-28T10:00', '2027-07-15T18:45']) {
    assert.equal(fuso.perCampo(fuso.daCampo(t)), t);
  }
  assert.equal(fuso.lunediDi('2026-11-15'), '2026-11-09');
  assert.equal(fuso.lunediDi('2026-11-09'), '2026-11-09');
});

test('proposta: evita gli orari occupati e resta nelle fasce', () => {
  // mercoledì 11 novembre 2026, ore 8:00 di Roma
  const adesso = fuso.daRoma(2026, 11, 11, 8, 0);
  const occupati = [
    { inizio: fuso.daRoma(2026, 11, 11, 9, 0), fine: fuso.daRoma(2026, 11, 11, 10, 30) },
    { inizio: fuso.daRoma(2026, 11, 11, 10, 15), fine: fuso.daRoma(2026, 11, 11, 11, 0) },
  ];
  const p = proponiBlocchi({ durataMin: 60, occupati, adesso });
  assert.equal(p.length, 3);
  assert.equal(fuso.perCampo(p[0].inizio), '2026-11-11T11:00');
  assert.equal(fuso.perCampo(p[1].inizio), '2026-11-12T09:00');
  for (const x of p) {
    assert.ok(eLibero(x.inizio, x.fine, occupati));
    assert.ok(dentroLeFasce(x.inizio, x.fine));
  }
});

test('proposta: non scavalca il pranzo, salta la domenica, non propone nel passato', () => {
  // mercoledì alle 12:40: 60 minuti non stanno prima delle 13:15, si va alle 14:30
  let p = proponiBlocchi({ durataMin: 60, adesso: fuso.daRoma(2026, 11, 11, 12, 40) });
  assert.equal(fuso.perCampo(p[0].inizio), '2026-11-11T14:30');
  // sabato alle 19:00: domenica esclusa, si va a lunedì
  p = proponiBlocchi({ durataMin: 30, adesso: fuso.daRoma(2026, 11, 14, 19, 0) });
  assert.equal(fuso.perCampo(p[0].inizio), '2026-11-16T09:00');
  // alle 9:07 la prima proposta è arrotondata al quarto d'ora successivo
  p = proponiBlocchi({ durataMin: 30, adesso: fuso.daRoma(2026, 11, 11, 9, 7) });
  assert.equal(fuso.perCampo(p[0].inizio), '2026-11-11T09:15');
});

test('proposta: giornata tutta occupata, nessuna proposta in quel giorno', () => {
  const occupati = [{ inizio: fuso.daRoma(2026, 11, 11, 0, 0), fine: fuso.daRoma(2026, 11, 12, 0, 0) }];
  const p = proponiBlocchi({ durataMin: 60, occupati, adesso: fuso.daRoma(2026, 11, 11, 8, 0), quante: 1 });
  assert.equal(fuso.giornoRoma(p[0].inizio), '2026-11-12');
  assert.equal(unisciOccupati([...occupati, ...occupati]).length, 1);
});

const att = (x = {}) => ({ id: 'a1', tipo: 'attivita', stato: 'da_fare', durata_prevista_min: 60, ...x });
const blocco = (inizio, minuti, s = 'in_calendario') => ({
  attivita_id: 'a1', stato: s, inizio: new Date(inizio).toISOString(),
  fine: new Date(new Date(inizio).getTime() + minuti * 60000).toISOString(),
});
const ORA = new Date('2026-11-11T12:00:00Z');

test('stato: una nuova attività è da pianificare', () => {
  assert.equal(stato.pianificazione(att(), [], [], ORA), 'assente');
  assert.ok(stato.eDaPianificare(att(), [], [], ORA));
  assert.ok(!stato.eDaPianificare(att({ stato: 'completata' }), [], [], ORA));
  assert.ok(!stato.eDaPianificare(att({ tipo: 'appunto' }), [], [], ORA));
});

test('stato: pianificazione parziale e completa', () => {
  assert.equal(stato.pianificazione(att(), [blocco('2026-11-12T09:00:00Z', 30)], [], ORA), 'parziale');
  assert.equal(stato.pianificazione(att(), [blocco('2026-11-12T09:00:00Z', 60)], [], ORA), 'completa');
  assert.equal(stato.pianificazione(att({ durata_prevista_min: null }), [blocco('2026-11-12T09:00:00Z', 30)], [], ORA), 'completa');
});

test('stato: la fine del blocco non completa; saltata torna in Da pianificare', () => {
  const finito = blocco('2026-11-11T09:00:00Z', 60);
  assert.equal(stato.blocchiDaConfermare([finito], ORA).length, 1);
  assert.ok(stato.eAperta(att()));
  const saltato = { ...finito, stato: 'saltato' };
  assert.equal(stato.blocchiDaConfermare([saltato], ORA).length, 0);
  assert.ok(stato.eDaPianificare(att(), [saltato], [], ORA));
});

test('tempo: previsto ed effettivo distinti, mai inventati', () => {
  const lista = [att(), att({ id: 'a2', durata_prevista_min: null })];
  let r = stato.riepilogoTempo(lista, [blocco('2026-11-11T09:00:00Z', 60, 'svolto')], []);
  assert.equal(r.previsti, 60);
  assert.equal(r.senzaDurata, 1);
  assert.equal(r.pianificati, 60);
  assert.equal(r.effettivi, null); // blocco svolto ma nessuna registrazione: nessun tempo effettivo
  r = stato.riepilogoTempo(lista, [], [{ attivita_id: 'a1', minuti: 45 }]);
  assert.equal(r.effettivi, 45);
  assert.equal(stato.riepilogoTempo([att({ durata_prevista_min: null })], [], []).previsti, null);
});

test('tempo: minuti pianificati nella settimana', () => {
  const b = [blocco('2026-11-09T08:00:00Z', 60), blocco('2026-11-15T20:00:00Z', 30), blocco('2026-11-16T08:00:00Z', 90),
    blocco('2026-11-10T08:00:00Z', 60, 'annullato')];
  assert.equal(stato.minutiNellaSettimana(b, '2026-11-11'), 90);
});
