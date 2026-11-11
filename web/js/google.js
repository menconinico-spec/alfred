// Chiamate alla funzione riservata che parla con Google Calendar.
// La pagina non contatta mai Google direttamente e non possiede le sue chiavi.

import { CONFIG } from '../config.js';
import { sb, S, notifica, caricaTutto } from './archivio.js';

export const googleCollegato = () => !!S.sinc?.calendario_id;

export async function chiama(azione, parametri = {}) {
  const { data: { session } } = await sb.auth.getSession();
  let risposta;
  try {
    risposta = await fetch(`${CONFIG.url}/functions/v1/calendario`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token || ''}`,
        apikey: CONFIG.chiavePubblica,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ azione, ...parametri }),
    });
  } catch {
    return fallisci('Rete non disponibile: Google Calendar non è stato raggiunto. Nessuna modifica al calendario.', 'rete');
  }
  const dati = await risposta.json().catch(() => ({}));
  if (!risposta.ok) return fallisci(dati.errore || `Errore della funzione calendario (${risposta.status})`, dati.codice || 'ignoto');
  S.erroreGoogle = null;
  return dati;
}

function fallisci(messaggio, codice) {
  S.erroreGoogle = messaggio;
  notifica();
  const e = new Error(messaggio);
  e.codice = codice;
  throw e;
}

/** Recepisce le novità del calendario di prova e rilegge l'archivio. Restituisce l'elenco delle modifiche. */
export async function sincronizza() {
  const esito = await chiama('sincronizza');
  await caricaTutto();
  return esito;
}

const memoriaOccupati = new Map();

/** Orari occupati negli altri calendari (solo intervalli). Tenuti in memoria per due minuti. */
export async function occupati(da, a) {
  const chiave = `${da.toISOString()}|${a.toISOString()}`;
  const nota = memoriaOccupati.get(chiave);
  if (nota && Date.now() - nota.quando < 120000) return nota.dati;
  const dati = await chiama('occupato', { da: da.toISOString(), a: a.toISOString() });
  memoriaOccupati.set(chiave, { quando: Date.now(), dati });
  return dati;
}
