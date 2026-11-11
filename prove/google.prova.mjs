// Prove con Google Calendar reale (punti 2, 3, 4 e 8 dell'incarico).
// Usano l'utente reale, perché Google è collegato a lui, ma solo dati fittizi e solo il calendario «Alfred prova».
//
//   node prove/google.prova.mjs fase1   prepara un'attività fittizia, prova proposta, conferma e duplicati
//   (l'utilizzatore sposta a mano il blocco in Google Calendar)
//   node prove/google.prova.mjs fase2   prova lo spostamento recepito, poi toglie tutto ciò che la prova ha creato
//   node prove/google.prova.mjs pulisci toglie ciò che la prova ha creato, senza provare nulla
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  RISULTATI, sessioneUtilizzatore, chiudiSessione, funzioneCome, archivioCome, archivioDiServizio,
  apriBrowser, apriPagina, clicca, pausa, testo, foto, esito, tutteRiuscite, MAC,
} from './attrezzi.mjs';
import { proponiBlocchi, eLibero, dentroLeFasce } from '../web/js/proposta.js';
import { intervalloTesto } from '../web/js/fuso.js';

const FASE = process.argv[2];
const APPUNTI = join(RISULTATI, 'google-stato.json');
const TITOLO = 'PROVA fittizia: blocco di calendario';
const SCHEDA = 'PROVA automatica (dati fittizi)';

const sessione = await sessioneUtilizzatore();
const arch = archivioCome(sessione);
const fn = funzioneCome(sessione);
const uid = sessione.user.id;

async function pulisci() {
  const schede = await arch(`schede?titolo=eq.${encodeURIComponent(SCHEDA)}&select=id,sottoschede(attivita(id,blocchi(id,stato)))`);
  for (const s of schede) {
    for (const a of s.sottoschede.flatMap((x) => x.attivita)) {
      for (const b of a.blocchi) {
        if (['in_calendario', 'da_scrivere'].includes(b.stato)) await fn('togli_blocco', { blocco_id: b.id });
      }
      await arch(`cronologia?attivita_id=eq.${a.id}`, 'DELETE');
    }
    await arch(`schede?id=eq.${s.id}`, 'DELETE');
  }
  if (existsSync(APPUNTI)) rmSync(APPUNTI);
  return schede.length;
}

/** Rilegge da capo il calendario di prova e dice quanti eventi vivi contiene. */
async function eventiNelCalendarioDiProva() {
  await archivioDiServizio(`sincronizzazione?proprietario=eq.${uid}`, 'PATCH', { token_sync: null });
  const r = await fn('sincronizza');
  const mieiVivi = (await arch('blocchi?stato=eq.in_calendario&select=id')).length;
  return { letti: r.eventi_letti, estranei: r.eventi_non_di_alfred, modifiche: r.modifiche.length, blocchiVivi: mieiVivi };
}

try {
  if (FASE === 'pulisci') {
    console.log(`Tolte ${await pulisci()} schede di prova.`);
  } else if (FASE === 'fase1') {
    await pulisci();

    // Permessi realmente concessi da Google
    const c = await fn('collega');
    const larghi = c.permessi.filter((p) => ['calendar', 'calendar.events', 'calendar.events.owned', 'calendar.readonly', 'calendar.events.readonly'].includes(p));
    const sinc = (await arch('sincronizzazione?select=calendario_id,calendario_nome'))[0];
    esito('3a', 'Google ha concesso solo i permessi ristretti', larghi.length === 0 && c.permessi.includes('calendar.app.created'),
      `permessi concessi: ${c.permessi.filter((p) => p.startsWith('calendar')).join(', ')}; nessun permesso che legge o scrive eventi di altri calendari. Calendario di scrittura: «${sinc.calendario_nome}», secondario (${sinc.calendario_id.endsWith('@group.calendar.google.com') ? 'non è il calendario principale' : 'ATTENZIONE'})`);

    const iniziale = await eventiNelCalendarioDiProva();

    // Dati fittizi
    const progetto = (await arch('progetti?nome=eq.Age%2B&select=id'))[0];
    const scheda = (await arch('schede', 'POST', { progetto_id: progetto.id, titolo: SCHEDA, posizione: 9999 }))[0];
    const sotto = (await arch('sottoschede', 'POST', { scheda_id: scheda.id, titolo: 'Da fare', posizione: 1 }))[0];
    const att = (await arch('attivita', 'POST', { sottoscheda_id: sotto.id, titolo: TITOLO, durata_prevista_min: 60, posizione: 1 }))[0];

    // 2. Proposta e orari occupati
    const da = new Date(); da.setMinutes(0, 0, 0);
    const occ = await fn('occupato', { da: da.toISOString(), a: new Date(da.getTime() + 15 * 86400000).toISOString() });
    const chiavi = new Set(occ.occupati.flatMap((o) => Object.keys(o)));
    const proposte = proponiBlocchi({ durataMin: 60, occupati: occ.occupati });
    const senza = proponiBlocchi({ durataMin: 60, occupati: [] });
    const libere = proposte.every((p) => eLibero(p.inizio, p.fine, occ.occupati) && dentroLeFasce(p.inizio, p.fine));
    const scartate = senza.filter((p) => !eLibero(p.inizio, p.fine, occ.occupati)).length;

    const browser = await apriBrowser();
    const { pagina, errori } = await apriPagina(browser, { sessione, schermo: MAC, percorso: '#/matrice' });
    await clicca(pagina, 'button', 'Pianifica');
    await pagina.waitForSelector('fieldset.opzioni', { timeout: 30000 });
    const mostrate = await pagina.$$eval('fieldset.opzioni label.opzione span', (e) => e.map((x) => x.textContent.trim()).filter((t) => !t.startsWith('Scelgo io')));
    const attese = proposte.map((p) => intervalloTesto(p.inizio, p.fine));
    await foto(pagina, 'google-2-proposta');
    esito('2', 'La proposta di blocco rispetta gli orari occupati',
      libere && proposte.length > 0 && JSON.stringify(mostrate) === JSON.stringify(attese) && [...chiavi].every((k) => ['inizio', 'fine'].includes(k)),
      `letti ${occ.occupati.length} intervalli occupati da ${occ.calendari_letti} calendari (non letti: ${occ.calendari_non_letti}); la funzione restituisce solo inizio e fine, nessun titolo. ` +
      `Proposte mostrate dalla pagina: ${mostrate.join(' | ')}. Nessuna si sovrappone a un intervallo occupato. ` +
      `Senza tener conto degli occupati, ${scartate} delle ${senza.length} proposte sarebbero cadute su un impegno.`);

    // 3. Niente scrittura prima della conferma
    await clicca(pagina, 'button', 'Annulla');
    const dopoAnnulla = await eventiNelCalendarioDiProva();
    const blocchiDopoAnnulla = (await arch(`blocchi?attivita_id=eq.${att.id}&select=id`)).length;
    await clicca(pagina, 'button', 'Pianifica');
    await pagina.waitForSelector('fieldset.opzioni', { timeout: 30000 });
    await clicca(pagina, 'button', 'Conferma e scrivi');
    await pagina.waitForFunction(() => !document.querySelector('fieldset.opzioni'), { timeout: 30000 });
    await pausa(pagina, 500);
    const blocchi = await arch(`blocchi?attivita_id=eq.${att.id}&select=*`);
    const b = blocchi[0];
    const dopoConferma = await eventiNelCalendarioDiProva();
    await pagina.goto(pagina.url().replace(/#.*/, '#/calendario'), { waitUntil: 'networkidle0' });
    await pagina.reload({ waitUntil: 'networkidle0' });
    await foto(pagina, 'google-3-calendario');
    esito('3', 'Il blocco viene scritto solo dopo la conferma e solo su «Alfred prova»',
      blocchiDopoAnnulla === 0 && dopoAnnulla.letti === iniziale.letti && blocchi.length === 1 && b?.stato === 'in_calendario' &&
      b.google_evento_id === b.id.replaceAll('-', '') && dopoConferma.letti === iniziale.letti + 1 && dopoConferma.estranei === iniziale.estranei,
      `eventi in «Alfred prova» all'inizio: ${iniziale.letti}; dopo aver aperto la proposta e premuto «Annulla»: ${dopoAnnulla.letti}, blocchi nell'archivio ${blocchiDopoAnnulla}; ` +
      `dopo «Conferma e scrivi»: ${dopoConferma.letti}, blocco «${b?.stato}» ${b ? intervalloTesto(new Date(b.inizio), new Date(b.fine)) : ''}`);

    // 4. Ripetere non duplica
    await arch(`blocchi?id=eq.${b.id}`, 'PATCH', { stato: 'da_scrivere' }); // come se la prima risposta di Google fosse andata persa
    const seconda = await fn('crea_blocco', { blocco_id: b.id });
    const terza = await fn('crea_blocco', { blocco_id: b.id });
    await pagina.goto(pagina.url().replace(/#.*/, '#/calendario'), { waitUntil: 'networkidle0' });
    await clicca(pagina, 'button', 'Aggiorna da Google');
    await clicca(pagina, 'button', 'Aggiorna da Google');
    const s1 = await fn('sincronizza'), s2 = await fn('sincronizza');
    const dopoRipetizioni = await eventiNelCalendarioDiProva();
    const blocchiFinali = await arch(`blocchi?attivita_id=eq.${att.id}&select=id,stato`);
    esito('4', 'Ripetere scrittura e sincronizzazione non crea duplicati',
      seconda.gia_scritto === true && terza.gia_scritto === true && blocchiFinali.length === 1 && blocchiFinali[0].stato === 'in_calendario' &&
      dopoRipetizioni.letti === dopoConferma.letti && s1.modifiche.length === 0 && s2.modifiche.length === 0,
      `stessa scrittura ripetuta due volte: Google risponde «già presente» (${seconda.gia_scritto}, ${terza.gia_scritto}); «Aggiorna da Google» premuto due volte più due allineamenti diretti: 0 modifiche; ` +
      `rilettura completa del calendario: ${dopoRipetizioni.letti} eventi (prima ${dopoConferma.letti}); blocchi nell'archivio: ${blocchiFinali.length}`);

    if (errori.length) console.log('Errori di pagina:', errori);
    await browser.close();
    writeFileSync(APPUNTI, JSON.stringify({ attivita: att.id, blocco: b.id, inizio: b.inizio, fine: b.fine }));
    console.log(`\nBlocco lasciato in «Alfred prova» per la prova 8: «${TITOLO}», ${intervalloTesto(new Date(b.inizio), new Date(b.fine))}`);
  } else if (FASE === 'fase2') {
    const app = JSON.parse(readFileSync(APPUNTI, 'utf8'));
    const prima = (await arch(`blocchi?id=eq.${app.blocco}&select=*`))[0];

    // Alfred non sa ancora dello spostamento: un suo spostamento non deve sovrascrivere quello fatto in Google
    const altrove = new Date(new Date(prima.inizio).getTime() + 7 * 86400000);
    const tentativo = await fn('sposta_blocco', { blocco_id: app.blocco, inizio: altrove.toISOString(), fine: new Date(altrove.getTime() + 3600000).toISOString() });
    const dopoTentativo = (await arch(`blocchi?id=eq.${app.blocco}&select=*`))[0];

    const browser = await apriBrowser();
    const { pagina, errori } = await apriPagina(browser, { sessione, schermo: MAC, percorso: '#/calendario' });
    await pausa(pagina, 800);
    const dopo = (await arch(`blocchi?id=eq.${app.blocco}&select=*`))[0];
    const cronaca = await arch(`cronologia?blocco_id=eq.${app.blocco}&tipo=eq.spostato_in_google&select=dettaglio,visto`);
    const fascia = await testo(pagina, 'body');
    await foto(pagina, 'google-8-spostato');
    const ancora = await fn('sincronizza');
    const tutti = await arch(`blocchi?attivita_id=eq.${app.attivita}&select=id,stato`);
    const conta = await eventiNelCalendarioDiProva();
    const spostato = +new Date(dopo.inizio) !== +new Date(app.inizio) || +new Date(dopo.fine) !== +new Date(app.fine);
    esito('8', 'Uno spostamento fatto in Google viene recepito senza duplicati',
      spostato && tentativo.conflitto === true && +new Date(dopoTentativo.inizio) === +new Date(app.inizio) &&
      cronaca.length === 1 && tutti.length === 1 && tutti[0].stato === 'in_calendario' && ancora.modifiche.length === 0 && /spostat/i.test(fascia),
      `prima: ${intervalloTesto(new Date(app.inizio), new Date(app.fine))}; dopo l'allineamento: ${intervalloTesto(new Date(dopo.inizio), new Date(dopo.fine))}. ` +
      `Un tentativo di spostamento da Alfred fatto prima dell'allineamento è stato rifiutato come conflitto (${tentativo.conflitto === true}) e non ha sovrascritto Google. ` +
      `Cronologia: ${cronaca.length} voce «spostato in Google»; avviso visibile in pagina: ${/spostat/i.test(fascia)}; secondo allineamento: ${ancora.modifiche.length} modifiche; ` +
      `blocchi dell'attività: ${tutti.length}; eventi nel calendario: ${conta.letti}`);
    if (errori.length) console.log('Errori di pagina:', errori);
    await browser.close();

    await pulisci();
    const fine = await eventiNelCalendarioDiProva();
    console.log(`\nPulizia: schede di prova rimaste ${(await arch(`schede?titolo=eq.${encodeURIComponent(SCHEDA)}&select=id`)).length}, eventi vivi in «Alfred prova» riconosciuti come blocchi attivi: ${fine.blocchiVivi}`);
  } else {
    console.log('Indicare: fase1, fase2 oppure pulisci');
  }
} finally {
  await chiudiSessione(sessione);
}
process.exit(tutteRiuscite() ? 0 : 1);
