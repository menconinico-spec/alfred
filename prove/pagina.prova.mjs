// Prove della pagina che non richiedono Google: prove 1, 5, 6, 7, 9, 10, 11 dell'incarico.
// Avvio: (dalla cartella Alfred) npm run pagina   poi, in un'altra finestra:   node prove/pagina.prova.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  sessioneDiProva, eliminaUtenteDiProva, archivioCome, apriBrowser, apriPagina, clicca, pausa, testo, foto,
  esito, tutteRiuscite, MAC, IPHONE, RISULTATI, URL_SB, segreti,
} from './attrezzi.mjs';

const browser = await apriBrowser();
let sessione;
try {
  // ---------- 10a: accesso obbligatorio ----------
  {
    const { pagina } = await apriPagina(browser);
    const t = await testo(pagina, 'body');
    const r = await fetch(`${URL_SB}/rest/v1/attivita?select=id`, { headers: { apikey: segreti.SUPABASE_CHIAVE_PUBBLICA } });
    await foto(pagina, '10-accesso-obbligatorio');
    esito('10a', 'Senza accesso si vede solo la schermata di ingresso e l\'archivio rifiuta la lettura',
      t.includes('Accedi con Google') && !t.includes('Age+') && r.status === 401,
      `pagina: «${t.replace(/\s+/g, ' ').trim().slice(0, 70)}»; archivio senza accesso: risposta ${r.status}`);
    await pagina.close();
  }

  sessione = await sessioneDiProva();
  const db = archivioCome(sessione);

  // ---------- 1: creare, modificare, collegare, ritrovare dopo il riavvio ----------
  let { pagina, errori } = await apriPagina(browser, { sessione });
  await pagina.waitForSelector('.bacheca').catch(async (e) => { console.log('DIAGNOSI avvio:', (await testo(pagina, 'body')).slice(0, 400).replace(/\n/g, ' / ')); throw e; });
  await clicca(pagina, 'button', '+ Aggiungi scheda');
  await pagina.type('.bacheca .nuova-voce input', 'Lancio webinar (prova)');
  await pagina.keyboard.press('Enter');
  await pagina.waitForFunction(() => document.body.innerText.includes('Lancio webinar (prova)') && document.querySelectorAll('.scheda-base:not(.fissa) .sotto-riga').length === 3);
  await foto(pagina, '01a-progetto-mac');
  await clicca(pagina, '.scheda-base:not(.fissa) .scheda-corpo', 'Apri');
  await pagina.waitForSelector('.colonne');
  await clicca(pagina, '.colonna:first-child button', '+ Aggiungi attività');
  await pagina.type('.colonna:first-child .nuova-voce input', 'Scrivere la scaletta (prova)');
  await pagina.keyboard.press('Enter');
  await pagina.waitForSelector('.cartellino');
  await clicca(pagina, '.cartellino', 'Scrivere la scaletta');
  await pagina.waitForSelector('dialog[open] form');
  // modifica: titolo, durata prevista, importanza e urgenza distinte
  await pagina.$eval('dialog[open] input[type=text]', (e) => { e.value = 'Scrivere la scaletta del webinar (prova)'; });
  await pagina.$eval('dialog[open] input[type=number]', (e) => { e.value = '90'; });
  const scelte = await pagina.$$('dialog[open] .griglia-campi select');
  await scelte[1].select('si'); // importante
  await scelte[2].select('no'); // urgente
  await foto(pagina, '01b-scheda-attivita-mac');
  await clicca(pagina, 'button', 'Salva', 'dialog[open]');
  await pagina.waitForFunction(() => !document.querySelector('dialog[open]'));
  await foto(pagina, '01c-scheda-aperta-mac');
  // riavvio: pagina chiusa e riaperta da zero, lettura diretta dall'archivio
  await pagina.close();
  ({ pagina, errori } = await apriPagina(browser, { sessione, percorso: '#/attivita' }));
  await pagina.waitForSelector('.elenco .cartellino');
  const dopoRiavvio = await testo(pagina);
  const righe = await db('attivita?select=titolo,durata_prevista_min,importante,urgente,stato,sottoschede(titolo,schede(titolo,progetti(nome)))');
  const a0 = righe[0];
  esito('1', 'Attività creata, modificata, collegata a una scheda di Age+ e ritrovata dopo il riavvio',
    dopoRiavvio.includes('Scrivere la scaletta del webinar (prova)') && a0.durata_prevista_min === 90 && a0.importante === true && a0.urgente === false
      && a0.sottoschede.schede.progetti.nome === 'Age+' && a0.sottoschede.schede.titolo === 'Lancio webinar (prova)',
    `archivio: «${a0.titolo}», ${a0.durata_prevista_min} min, importante=${a0.importante}, urgente=${a0.urgente}, in ${a0.sottoschede.schede.progetti.nome} › ${a0.sottoschede.schede.titolo} › ${a0.sottoschede.titolo}; visibile nella pagina riaperta`);

  // nuova attività = subito in «Da pianificare»
  await pagina.goto(pagina.url().replace(/#.*/, '#/matrice'));
  await pagina.waitForSelector('.matrice');
  const matrice0 = await pagina.$eval('.da-pianificare', (e) => e.innerText);
  const inQuadrante = await pagina.$eval('.q2', (e) => e.innerText);
  await foto(pagina, '01d-matrice-mac');
  esito('1b', 'L\'attività entra da sola in «Da pianificare» e nel riquadro giusto della matrice',
    matrice0.includes('Scrivere la scaletta del webinar') && inQuadrante.includes('Scrivere la scaletta del webinar'),
    `«Da pianificare»: ${matrice0.split('\n')[0]}; riquadro «Importante, non urgente» contiene l'attività`);

  // ---------- 5: a fine blocco l'attività resta aperta; durata proposta correggibile ----------
  // Il blocco viene inserito direttamente nell'archivio come se fosse stato scritto e fosse terminato
  // (la scrittura vera su Google è provata a parte, con l'account di Nico).
  const att = (await db('attivita?select=id'))[0];
  const ieri = Date.now() - 26 * 3600000;
  const [b1] = await db('blocchi', 'POST', { attivita_id: att.id, inizio: new Date(ieri).toISOString(), fine: new Date(ieri + 3600000).toISOString(), stato: 'in_calendario', google_evento_id: 'finto1' });
  await pagina.reload({ waitUntil: 'networkidle0' });
  await pagina.waitForSelector('.fascia.conferma');
  const statoPrima = (await db(`attivita?id=eq.${att.id}&select=stato`))[0].stato;
  const tempoPrima = await db('registrazioni_tempo?select=id');
  await clicca(pagina, '.fascia.conferma button', 'Scrivere la scaletta');
  await pagina.waitForSelector('dialog[open] input[type=number]');
  const proposta = await pagina.$eval('dialog[open] input[type=number]', (e) => e.value);
  await foto(pagina, '05-fine-blocco-mac');
  await pagina.$eval('dialog[open] input[type=number]', (e) => { e.value = '45'; });
  await clicca(pagina, 'button', 'Conferma il tempo', 'dialog[open]');
  await pagina.waitForFunction(() => !document.querySelector('dialog[open]'));
  const reg = await db('registrazioni_tempo?select=minuti,blocco_id');
  const statoDopo = (await db(`attivita?id=eq.${att.id}&select=stato,completata_il`))[0];
  esito('5', 'A blocco terminato l\'attività resta aperta finché non si conferma; la durata proposta si corregge',
    statoPrima === 'da_fare' && tempoPrima.length === 0 && proposta === '60' && reg.length === 1 && reg[0].minuti === 45
      && statoDopo.stato === 'in_corso' && statoDopo.completata_il === null,
    `prima della conferma: stato «${statoPrima}», ${tempoPrima.length} tempi registrati; proposta ${proposta} min corretta a 45; dopo: registrati ${reg[0]?.minuti} min, stato «${statoDopo.stato}», non completata`);

  // ---------- 6: attività saltata → «Da pianificare», nulla cancellato ----------
  const [b2] = await db('blocchi', 'POST', { attivita_id: att.id, inizio: new Date(ieri + 7200000).toISOString(), fine: new Date(ieri + 9000000).toISOString(), stato: 'in_calendario', google_evento_id: 'finto2' });
  await pagina.reload({ waitUntil: 'networkidle0' });
  await clicca(pagina, '.fascia.conferma button', 'Scrivere la scaletta');
  await clicca(pagina, 'button', 'Segna come saltato', 'dialog[open]');
  await pagina.waitForFunction(() => !document.querySelector('dialog[open]'));
  const blocchiDopo = await db('blocchi?select=id,stato&order=inizio');
  const attDopo = await db('attivita?select=id,stato');
  const lista = await pagina.$eval('.da-pianificare', (e) => e.innerText);
  esito('6', 'Un\'attività saltata entra in «Da pianificare» senza cancellare nulla',
    lista.includes('Scrivere la scaletta del webinar') && blocchiDopo.length === 2 && blocchiDopo[1].stato === 'saltato'
      && blocchiDopo[0].stato === 'svolto' && attDopo.length === 1 && (await db('registrazioni_tempo?select=id')).length === 1,
    `blocchi nell'archivio: ${blocchiDopo.map((b) => b.stato).join(', ')}; attività ancora presente (stato «${attDopo[0].stato}»); tempo registrato intatto; visibile in «${lista.split('\n')[0]}»`);

  // ---------- 7: tempo previsto ed effettivo distinti, mai inventati ----------
  await clicca(pagina, '.laterale-barra a', 'Gestione del tempo');
  await pagina.waitForSelector('.tempo-progetto');
  // seconda attività senza durata e senza registrazioni: non deve comparire nessun numero inventato
  const sotto = (await db('sottoschede?select=id,titolo,schede!inner(fissa)&schede.fissa=eq.false&order=posizione'))[0];
  await db('attivita', 'POST', { sottoscheda_id: sotto.id, titolo: 'Preparare le diapositive (prova)' });
  await pagina.reload({ waitUntil: 'networkidle0' });
  await pagina.waitForSelector('.tempo-progetto');
  const cifre = await pagina.$$eval('.cifra', (els) => els.map((e) => e.innerText.replace(/\n/g, ' ')));
  await foto(pagina, '07-tempo-mac');
  esito('7', 'Tempo previsto ed effettivo distinti; il blocco saltato non genera tempo; dove manca il dato è scritto che manca',
    cifre[0].includes('1 h 30 min') && cifre[0].includes('1 attività senza durata') && cifre[1].includes('1 h') && cifre[2].includes('45 min'),
    cifre.join(' | '));

  // ---------- 9: errori di rete visibili; ultimo aggiornamento riuscito visibile ----------
  await pagina.goto(pagina.url().replace(/#.*/, '#/attivita'));
  await pagina.waitForSelector('.elenco .cartellino');
  const ultimo = await pagina.$eval('.ultimo', (e) => e.innerText);
  await pagina.setOfflineMode(true);
  await clicca(pagina, '.cartellino', 'Preparare le diapositive');
  await pagina.$eval('dialog[open] input[type=text]', (e) => { e.value = 'Titolo scritto senza rete (prova)'; });
  await clicca(pagina, 'button', 'Salva', 'dialog[open]');
  await new Promise((r) => setTimeout(r, 1500));
  const fascia = await pagina.$eval('.fascia.errore', (e) => e.innerText).catch(() => '');
  const ancoraAperta = !!(await pagina.$('dialog[open]'));
  await pagina.evaluate(() => document.querySelector('dialog[open]')?.close());
  await foto(pagina, '09-errore-di-rete-mac');
  await pagina.setOfflineMode(false);
  const nonSalvato = (await db('attivita?select=titolo')).every((r) => !r.titolo.includes('senza rete'));
  // Tornata la rete la pagina si riallinea anche da sola: «Riprova» va premuto solo se l'avviso c'è ancora.
  await clicca(pagina, '.fascia.errore button', 'Riprova').catch(() => {});
  await pagina.waitForFunction(() => !document.querySelector('.fascia.errore'), { timeout: 10000 });
  esito('9', 'Errore di rete visibile, modifica non data per salvata, ultimo aggiornamento riuscito visibile',
    /Archivio: ultimo aggiornamento riuscito oggi alle \d\d:\d\d/.test(ultimo) && /rete/i.test(fascia) && ancoraAperta && nonSalvato,
    `in pagina: «${ultimo.split('\n')[0]}»; senza rete compare: «${fascia.split('\n')[0].slice(0, 90)}»; la finestra resta aperta e l'archivio non contiene la modifica; con «Riprova» l'avviso sparisce`);

  // ---------- 11: esportazione leggibile e ripristino ----------
  const copia = await pagina.evaluate(async () => (await import('./js/archivio.js')).esporta());
  const fileCopia = join(RISULTATI, '11-copia-di-prova.json');
  writeFileSync(fileCopia, JSON.stringify(copia, null, 2));
  const conteggi = Object.fromEntries(Object.entries(copia.tabelle).map(([k, v]) => [k, v.length]));
  // danno simulato: si elimina la scheda di prova (con attività, blocchi e tempi a cascata) e si cambia un titolo
  const scheda = (await db('schede?fissa=eq.false&select=id'))[0];
  await db(`schede?id=eq.${scheda.id}`, 'DELETE');
  const dopoDanno = { attivita: (await db('attivita?select=id')).length, blocchi: (await db('blocchi?select=id')).length, tempi: (await db('registrazioni_tempo?select=id')).length };
  await pagina.reload({ waitUntil: 'networkidle0' });
  await pagina.goto(pagina.url().replace(/#.*/, '#/dati'));
  await pagina.waitForSelector('input[type=file]');
  await (await pagina.$('input[type=file]')).uploadFile(fileCopia);
  await pagina.waitForSelector('dialog[open] table');
  const anteprima = await pagina.$eval('dialog[open] table', (e) => e.innerText.replace(/\t/g, ' ').replace(/\n/g, ' | '));
  await foto(pagina, '11-anteprima-ripristino-mac');
  await clicca(pagina, 'button', 'Ripristina', 'dialog[open]');
  await pagina.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 20000 });
  const dopo = { attivita: await db('attivita?select=titolo,durata_prevista_min&order=creato_il'), blocchi: (await db('blocchi?select=id')).length, tempi: await db('registrazioni_tempo?select=minuti') };
  esito('11', 'Esportazione in formato leggibile e ripristino provato dopo una cancellazione',
    dopoDanno.attivita === 0 && dopo.attivita.length === conteggi.attivita && dopo.blocchi === conteggi.blocchi && dopo.tempi[0]?.minuti === 45
      && dopo.attivita[0].durata_prevista_min === 90 && copia.tabelle.google_credenziali === undefined,
    `copia (testo JSON) con ${JSON.stringify(conteggi)}; dopo la cancellazione: ${JSON.stringify(dopoDanno)}; anteprima: ${anteprima.slice(0, 160)}…; dopo il ripristino: ${dopo.attivita.length} attività, ${dopo.blocchi} blocchi, tempo ${dopo.tempi[0]?.minuti} min`);

  // ---------- 12: pagina del progetto modificabile ----------
  await pagina.goto(pagina.url().replace(/#.*/, '#/progetto'));
  await pagina.waitForSelector('.bacheca');
  await clicca(pagina, '.bacheca button', '+ Aggiungi nota');
  await pagina.type('.bacheca .nuova-voce input', 'Appunti liberi (prova)');
  await pagina.keyboard.press('Enter'); await pausa(pagina, 400);
  // Trascina l'angolo della nota: da 3 a 6 colonne e a 300 punti di altezza
  const misura = () => pagina.evaluate(() => {
    const b = [...document.querySelectorAll('.bacheca .blocco')].find((x) => x.textContent.includes('Appunti liberi (prova)'));
    const r = b.getBoundingClientRect();
    return { x: r.left, y: r.top, l: r.width, a: r.height, tela: b.parentElement.clientWidth };
  });
  const m0 = await misura();
  await pagina.mouse.move(m0.x + m0.l - 6, m0.y + m0.a - 6);
  await pagina.mouse.down();
  await pagina.mouse.move(m0.x + m0.tela / 2 - 10, m0.y + 300, { steps: 8 });
  await pagina.mouse.up(); await pausa(pagina, 500);
  const salvata = (await db('schede?titolo=eq.Appunti%20liberi%20(prova)&select=tipo,larghezza,altezza'))[0];
  await pagina.reload({ waitUntil: 'networkidle0' }); await pagina.waitForSelector('.bacheca');
  const m1 = await misura();
  // Riquadro fisso (Mission) ridimensionato: la misura va nel progetto
  const mis = await pagina.evaluate(() => { const r = document.querySelector('.direzione .blocco').getBoundingClientRect(); return { x: r.left, y: r.top, l: r.width, a: r.height }; });
  await pagina.mouse.move(mis.x + mis.l - 6, mis.y + mis.a - 6);
  await pagina.mouse.down();
  await pagina.mouse.move(mis.x + mis.l / 2, mis.y + 200, { steps: 6 });
  await pagina.mouse.up(); await pausa(pagina, 500);
  const disp = (await db('progetti?nome=eq.Age%2B&select=disposizione'))[0].disposizione;
  await foto(pagina, '12-pagina-modificata');
  // Nuovo progetto dalla barra laterale
  await clicca(pagina, '.laterale-barra button', '+ Nuovo progetto');
  await pagina.type('dialog[open] input[type=text]', 'Progetto di prova');
  await clicca(pagina, 'dialog[open] button', 'Crea il progetto');
  await pagina.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 20000 }); await pausa(pagina, 400);
  const progetti = await db('progetti?select=nome,colore_google,schede(titolo,fissa,sottoschede(titolo))&order=posizione');
  const nuovoP = progetti.find((x) => x.nome === 'Progetto di prova');
  const tel12 = await apriPagina(browser, { sessione, schermo: IPHONE });
  await tel12.pagina.waitForSelector('.bacheca');
  const telSborda = await tel12.pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await tel12.contesto.close();
  esito('12', 'Pagina del progetto modificabile: blocchi ridimensionabili, note libere, nuovi progetti',
    salvata?.tipo === 'nota' && salvata.larghezza === 6 && salvata.altezza === 300 && Math.abs(m1.a - 300) < 3 && m1.l > m0.l * 1.8
      && disp.mission?.larghezza === 3 && disp.mission?.altezza === 200
      && nuovoP && nuovoP.schede.length === 1 && nuovoP.schede[0].fissa && nuovoP.schede[0].sottoschede.length === 3 && nuovoP.colore_google !== 2 && !telSborda,
    `nota creata e trascinata: nell'archivio larghezza ${salvata?.larghezza}/12, altezza ${salvata?.altezza}; dopo il riavvio è larga ${Math.round(m1.l)} punti (prima ${Math.round(m0.l)}) e alta ${Math.round(m1.a)}; ` +
    `riquadro Mission: ${JSON.stringify(disp.mission)}; nuovo progetto «${nuovoP?.nome}» con scheda fissa e ${nuovoP?.schede[0]?.sottoschede.length} schede interne, colore diverso da Age+; su iPhone la pagina non esce dallo schermo: ${!telSborda}`);

  // ---------- 13: abitudini ----------
  await pagina.goto(pagina.url().replace(/#.*/, '#/abitudini')); await pausa(pagina, 300);
  await clicca(pagina, 'button', '+ Nuova abitudine');
  await pagina.type('dialog[open] input[type=text]', 'Lettura (prova)');
  await clicca(pagina, 'dialog[open] button', 'Crea l\'abitudine');
  await pagina.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 20000 }); await pausa(pagina, 300);
  const abId = (await db('abitudini?select=id'))[0].id;
  // Come se fosse iniziata tre giorni fa, con ieri e l'altro ieri già fatti
  const g = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  await db(`abitudini?id=eq.${abId}`, 'PATCH', { inizio: g(-3) });
  await db('abitudini_registrazioni', 'POST', [{ abitudine_id: abId, giorno: g(-2), valore: 1 }, { abitudine_id: abId, giorno: g(-1), valore: 1 }]);
  await pagina.reload({ waitUntil: 'networkidle0' }); await pausa(pagina, 300);
  const primaSpunta = await testo(pagina, 'main');
  const registrazioniPrima = (await db(`abitudini_registrazioni?giorno=eq.${g(0)}&select=id`)).length;
  await pagina.click('.abitudine .spunta'); await pausa(pagina, 400);
  const dopoSpunta = await testo(pagina, 'main');
  const registrazioniDopo = await db(`abitudini_registrazioni?giorno=eq.${g(0)}&select=valore`);
  await foto(pagina, '13-abitudini');
  await clicca(pagina, '.abitudine-nome', 'Lettura (prova)');
  const schedaAb = await testo(pagina, 'dialog[open]');
  await foto(pagina, '13-abitudine-scheda');
  await pagina.click('dialog[open] .finestra-testa button'); await pausa(pagina, 200);
  await pagina.click('.abitudine .spunta'); await pausa(pagina, 400);
  const dopoTolta = (await db(`abitudini_registrazioni?giorno=eq.${g(0)}&select=id`)).length;
  const tel13 = await apriPagina(browser, { sessione, schermo: IPHONE, percorso: '#/abitudini' });
  await pausa(tel13.pagina, 300);
  const tel13Sborda = await tel13.pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await foto(tel13.pagina, '13-abitudini-iphone');
  await tel13.contesto.close();
  esito('13', 'Abitudini: creazione, spunta del giorno, serie, calendario del mese; nessun dato inventato',
    /0 su 1 fatte/.test(primaSpunta) && /serie di 2 giorni/.test(primaSpunta) && registrazioniPrima === 0
      && /1 su 1 fatte/.test(dopoSpunta) && /serie di 3 giorni/.test(dopoSpunta) && registrazioniDopo.length === 1
      && /Serie attuale\s*3 giorni/.test(schedaAb) && /Totale volte\s*3/.test(schedaAb) && dopoTolta === 0 && !tel13Sborda,
    `prima della spunta: «${primaSpunta.match(/Oggi: [^.]*\./)?.[0]}», ${primaSpunta.match(/serie di \d+ giorni/)?.[0]}, registrazioni di oggi nell'archivio: ${registrazioniPrima}; ` +
    `dopo: «${dopoSpunta.match(/Oggi: [^.]*\./)?.[0]}», ${dopoSpunta.match(/serie di \d+ giorni/)?.[0]}, registrazioni: ${registrazioniDopo.length}; ` +
    `scheda: ${schedaAb.match(/Serie attuale\s*\d+ giorni/)?.[0].replace(/\s+/g, ' ')}, ${schedaAb.match(/Totale volte\s*\d+/)?.[0].replace(/\s+/g, ' ')}; tolta la spunta, le registrazioni di oggi tornano ${dopoTolta} (nessuno zero scritto); su iPhone non esce dallo schermo: ${!tel13Sborda}`);

  // ---------- 14: finanze ----------
  // Un foglio finto viene letto dal programma e copiato nell'archivio dell'utente di prova.
  const cartellaFogli = join(RISULTATI, 'fogli');
  mkdirSync(cartellaFogli, { recursive: true });
  const radiceAlfred = join(RISULTATI, '..', '..');
  const leggi = () => execFileSync('python3', [join(radiceAlfred, 'finanze', 'leggi_fogli.py'), '--cartella', cartellaFogli,
    '--esito', join(cartellaFogli, 'esito.json'), '--invia', '--utente-prova'], { encoding: 'utf8' });
  execFileSync('python3', [join(radiceAlfred, 'prove', 'foglio_finto.py'), cartellaFogli, '2026']);
  leggi();
  await db('fin_obiettivi', 'POST', { nome: 'Entrate Alfa (prova)', tipo: 'entrate_mensili', importo: 1500, gestioni: ['Alfa (prova)'], entro: '2027-12-31' });
  const vai = async (p, percorso) => { await p.goto(p.url().replace(/#.*/, '') + percorso); await p.reload({ waitUntil: 'networkidle0' }); await pausa(p, 300); };
  await vai(pagina, '#/finanze');
  const panoramica = (await testo(pagina, 'main')).replace(/\s+/g, ' ');
  await foto(pagina, '14-finanze-panoramica');
  const aggiungi = async (percorso, pulsante, campi) => {
    await vai(pagina, percorso);
    await clicca(pagina, 'button', pulsante);
    await pagina.waitForSelector('dialog[open] form');
    for (const [nome, valore] of Object.entries(campi)) await pagina.type(`dialog[open] input[name=${nome}]`, valore);
    await clicca(pagina, 'button', 'Aggiungi', 'dialog[open]');
    await pagina.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 20000 }); await pausa(pagina, 300);
    return (await testo(pagina, 'main')).replace(/\s+/g, ' ');
  };
  const paginaDebiti = await aggiungi('#/finanze/debiti', '+ Debito', { nome: 'Finanziamento finto (prova)', rata: '210,10' });
  await foto(pagina, '14-finanze-debiti');
  const paginaRicorrenti = await aggiungi('#/finanze/ricorrenti', '+ Ricorrente', { nome: 'Telefono finto (prova)', importo: '9,90' });
  const paginaConti = await aggiungi('#/finanze/conti', '+ Conto', { nome: 'Conto finto (prova)' });
  const debitoArchivio = (await db('fin_debiti?select=residuo,rata,tasso'))[0];
  const contoArchivio = (await db('fin_conti?select=saldo'))[0];
  await vai(pagina, '#/finanze/percorso');
  await pagina.select('.tappa select', 'fatta'); await pausa(pagina, 400);
  const paginaPercorso = (await testo(pagina, 'main')).replace(/\s+/g, ' ');
  await foto(pagina, '14-finanze-percorso');
  const tappeArchivio = (await db('fin_impostazioni?select=tappe'))[0]?.tappe;
  leggi(); // seconda lettura degli stessi fogli: non deve creare doppioni
  const righeDopo = (await db('fin_movimenti?select=id')).length;
  const lettureDopo = (await db('fin_letture?select=righe,avvisi&order=letto_il.desc'));
  await vai(pagina, '#/finanze');
  const panoramicaDopo = (await testo(pagina, 'main')).replace(/\s+/g, ' ');
  const tel14 = await apriPagina(browser, { sessione, schermo: IPHONE, percorso: '#/finanze' });
  await pausa(tel14.pagina, 300);
  const sborda14 = [await tel14.pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)];
  await foto(tel14.pagina, '14-finanze-iphone');
  await tel14.pagina.goto(tel14.pagina.url().replace(/#.*/, '#/finanze/percorso')); await pausa(tel14.pagina, 300);
  sborda14.push(await tel14.pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1));
  await tel14.contesto.close();
  const cerca = (t, re) => t.match(re)?.[0] ?? 'NON TROVATO';
  esito('14', 'Finanze: fogli letti senza doppioni, effettivo distinto dal previsto, dati mancanti lasciati vuoti, conti, ricorrenti, debiti, percorso',
    /Entrate effettive 1\.350,75 €/.test(panoramica) && /Uscite effettive 40,00 €/.test(panoramica) && /entrate 500,00 €, uscite 15,00 €/.test(panoramica)
      && /Febbraio 450,45 € 0,00 € 450,45 € \+50%/.test(panoramica) && /Previsti con data passata \(2\)/.test(panoramica)
      && /ultimi 3 mesi conclusi: 450,25 € \(30%\)/.test(panoramica) && /4 avvisi/.test(panoramica) && /Aprile nessuna riga/.test(panoramica)
      && /residuo non indicato/.test(paginaDebiti) && /Residuo totale non indicato/.test(paginaDebiti) && /Rate al mese 210,10 €/.test(paginaDebiti)
      && debitoArchivio.residuo === null && debitoArchivio.tasso === null && Number(debitoArchivio.rata) === 210.1
      && /Uscite ricorrenti: 9,90 € al mese/.test(paginaRicorrenti) && /saldo non indicato/.test(paginaConti) && contoArchivio.saldo === null
      && /1 su 6 fatte/.test(paginaPercorso) && tappeArchivio?.controllo === 'fatta'
      && righeDopo === 7 && lettureDopo.length === 2 && /Totale 220,00 €/.test(panoramicaDopo) && /Entrate effettive 1\.350,75 €/.test(panoramicaDopo)
      && !sborda14.some(Boolean),
    `panoramica: «${cerca(panoramica, /Entrate effettive [\d.,]+ €/)}», «${cerca(panoramica, /Uscite effettive [\d.,]+ €/)}», previsto a parte «${cerca(panoramica, /entrate [\d.,]+ €, uscite [\d.,]+ €/)}», «${cerca(panoramica, /Febbraio [^A-Z]*%/)}», «${cerca(panoramica, /Previsti con data passata \(\d+\)/)}», obiettivo «${cerca(panoramica, /ultimi 3 mesi conclusi: [\d.,]+ € \(\d+%\)/)}», ${cerca(panoramica, /\d+ avvisi/)}, «${cerca(panoramica, /Aprile nessuna riga/)}»; ` +
    `debito creato con la sola rata: pagina «${cerca(paginaDebiti, /Residuo totale [^R]*/).trim()}», archivio residuo=${debitoArchivio.residuo} tasso=${debitoArchivio.tasso} rata=${debitoArchivio.rata}; ricorrenti «${cerca(paginaRicorrenti, /Uscite ricorrenti: [\d.,]+ € al mese/)}»; conto «saldo non indicato»: ${/saldo non indicato/.test(paginaConti)}, archivio saldo=${contoArchivio.saldo}; ` +
    `percorso «${cerca(paginaPercorso, /\d su 6 fatte/)}», archivio tappe=${JSON.stringify(tappeArchivio)}; dopo la seconda lettura: ${righeDopo} movimenti (attesi 7), ${lettureDopo.length} letture, impegni fissi «${cerca(panoramicaDopo, /Totale [\d.,]+ €/)}»; su iPhone esce dallo schermo: ${sborda14.some(Boolean)}`);

  // ---------- 10b: disposizione Mac e iPhone ----------
  const larghezze = async (p) => p.evaluate(() => ({
    barra: getComputedStyle(document.querySelector('.laterale-barra')).position,
    barraTelefono: getComputedStyle(document.querySelector('.barra-telefono')).display,
    sborda: document.documentElement.scrollWidth > window.innerWidth + 1,
    colonneBacheca: getComputedStyle(document.querySelector('.bacheca') || document.body).gridTemplateColumns.split(' ').length,
  }));
  await pagina.goto(pagina.url().replace(/#.*/, '#/progetto'));
  await pagina.waitForSelector('.bacheca');
  const mac = await larghezze(pagina);
  await foto(pagina, '10-progetto-mac');
  await pagina.goto(pagina.url().replace(/#.*/, '#/calendario')); await pausa(pagina, 400); await foto(pagina, '10-calendario-mac');
  const tel = await apriPagina(browser, { sessione, schermo: IPHONE });
  await tel.pagina.waitForSelector('.bacheca');
  const iphone = await larghezze(tel.pagina);
  await foto(tel.pagina, '10-progetto-iphone');
  for (const [percorso, nome] of [['#/matrice', 'matrice'], ['#/calendario', 'calendario'], ['#/tempo', 'tempo'], ['#/dati', 'dati']]) {
    await tel.pagina.goto(tel.pagina.url().replace(/#.*/, '') + percorso); await pausa(tel.pagina, 400);
    iphone[`sborda_${nome}`] = await tel.pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await foto(tel.pagina, `10-${nome}-iphone`);
  }
  await clicca(tel.pagina, '.barra-telefono button', 'Menu'); await foto(tel.pagina, '10-menu-iphone');
  await tel.pagina.goto(tel.pagina.url().replace(/#.*/, '#/attivita')); await pausa(tel.pagina, 300);
  await clicca(tel.pagina, '.cartellino', 'Scrivere la scaletta'); await foto(tel.pagina, '10-attivita-iphone');
  const sbordaTel = Object.entries(iphone).filter(([k, v]) => k.startsWith('sborda') && v).map(([k]) => k);
  esito('10b', 'Disposizione distinta e usabile su Mac e su iPhone',
    mac.barra !== 'fixed' && mac.barraTelefono === 'none' && mac.colonneBacheca === 12 && !mac.sborda
      && iphone.barra === 'fixed' && iphone.barraTelefono !== 'none' && iphone.colonneBacheca === 1 && sbordaTel.length === 0,
    `Mac 1440×900: barra laterale fissa a sinistra, tela a ${mac.colonneBacheca} colonne; iPhone 393×852: barra in basso, menu a scomparsa, una colonna, nessuna pagina esce dallo schermo${sbordaTel.length ? ` TRANNE ${sbordaTel}` : ''}. Immagini in prove/risultati/`);

  const tutti = [...errori, ...tel.errori];
  esito('—', 'Nessun errore di programma durante le prove', tutti.length === 0, tutti.length ? tutti.slice(0, 5).join(' ‖ ') : 'nessun errore registrato dal browser');
} catch (e) {
  esito('!', 'Le prove si sono interrotte', false, e.stack.split('\n').slice(0, 4).join(' / '));
} finally {
  await browser.close();
  // L'utente di prova e tutti i suoi dati fittizi vengono eliminati.
  await eliminaUtenteDiProva().catch((e) => console.log('pulizia non riuscita:', e.message));
}
process.exit(tutteRiuscite() ? 0 : 1);
