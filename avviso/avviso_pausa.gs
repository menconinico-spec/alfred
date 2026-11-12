// Avviso di pausa per Alfred.
// Vive nell'account Google dell'utilizzatore (script.google.com), non in Supabase:
// così controllare non conta come attività e non falsa il conteggio dei 7 giorni.
//
// - La pagina di Alfred, ogni volta che legge l'archivio con successo, manda qui un segnale (doPost).
// - Ogni mattina `controlla` guarda da quanti giorni manca il segnale.
// - Al quinto giorno manda una sola email all'utilizzatore stesso. Al segnale successivo si riarma.

const GIORNI_AVVISO = 5;
const GIORNI_PAUSA = 7;
const OGGETTO = 'ATTENZIONE: promemoria scadenza';
const PAGINA = 'https://menconinico-spec.github.io/alfred/';

const memoria = () => PropertiesService.getScriptProperties();

/** Segnale dalla pagina: registra l'ora dell'ultimo accesso e riarma l'avviso. */
function doPost() {
  memoria().setProperties({ ultimoAccesso: new Date().toISOString(), avvisato: '' });
  return ContentService.createTextOutput('ok');
}

/** Aprendo l'indirizzo nel browser si vede lo stato, senza modificare nulla. */
function doGet() {
  const u = memoria().getProperty('ultimoAccesso');
  return ContentService.createTextOutput(u ? 'Avviso di pausa attivo. Ultimo accesso registrato: ' + u : 'Avviso di pausa attivo. Nessun accesso ancora registrato.');
}

/** Eseguito ogni mattina dall'attivatore. */
function controlla() {
  const m = memoria();
  const u = m.getProperty('ultimoAccesso');
  if (!u) return;
  const giorni = (Date.now() - new Date(u).getTime()) / 86400000;
  if (giorni < GIORNI_AVVISO || m.getProperty('avvisato')) return;
  spedisci(OGGETTO, new Date(u), false);
  m.setProperty('avvisato', new Date().toISOString());
}

function spedisci(oggetto, ultimo, prova) {
  const fuso = 'Europe/Rome';
  const scadenza = new Date(ultimo.getTime() + GIORNI_PAUSA * 86400000);
  const testo = [
    prova ? 'Questa è una PROVA dell\'avviso di pausa di Alfred. Non devi fare nulla.' : 'Alfred non viene aperto da ' + GIORNI_AVVISO + ' giorni.',
    '',
    'Ultimo accesso registrato: ' + Utilities.formatDate(ultimo, fuso, 'dd/MM/yyyy HH:mm'),
    'Dopo ' + GIORNI_PAUSA + ' giorni senza attività Supabase mette in pausa l\'archivio: intorno al ' + Utilities.formatDate(scadenza, fuso, 'dd/MM/yyyy HH:mm') + '.',
    '',
    'Per evitarlo basta aprire Alfred: ' + PAGINA,
    'Se l\'archivio è già in pausa, si riattiva dal pannello di Supabase (i dati non si perdono).',
  ].join('\n');
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), oggetto, testo);
}

/** Da eseguire una volta: crea il controllo quotidiano delle 8 e registra il momento di partenza. */
function installa() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'controlla').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('controlla').timeBased().everyDays(1).atHour(8).inTimezone('Europe/Rome').create();
  if (!memoria().getProperty('ultimoAccesso')) memoria().setProperty('ultimoAccesso', new Date().toISOString());
}

/** Da eseguire a mano per vedere arrivare un'email di prova. */
function prova() {
  spedisci(OGGETTO + ' (prova)', new Date(memoria().getProperty('ultimoAccesso') || Date.now()), true);
}

/** Per spegnere l'avviso: toglie il controllo quotidiano. */
function disinstalla() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
}
