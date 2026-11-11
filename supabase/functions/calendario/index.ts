// Funzione riservata "calendario": unico punto in cui Alfred parla con Google Calendar.
//
// Garanzie:
// - scrive soltanto nel calendario che ha creato lei stessa ("Alfred prova"),
//   il cui identificativo è custodito nell'archivio e non arriva mai dalla pagina;
// - degli altri calendari legge solo gli orari occupati (nessun titolo, nessun dettaglio);
// - ogni blocco ha un identificativo fisso, quindi ripetere un'operazione non crea duplicati;
// - la chiave di rinnovo di Google resta nell'archivio, in una tabella che la pagina non può leggere.

const URL_ARCHIVIO = Deno.env.get("SUPABASE_URL")!;
const CHIAVE_SERVIZIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHIAVE_PUBBLICA = Deno.env.get("SUPABASE_ANON_KEY")!;
const GOOGLE_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_SEGRETO = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

const NOME_CALENDARIO = "Alfred prova";
const FUSO = "Europe/Rome";
const GOOGLE = "https://www.googleapis.com/calendar/v3";

const INTESTAZIONI = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

class Errore extends Error {
  constructor(public codice: string, messaggio: string, public stato = 400) {
    super(messaggio);
  }
}

const rispondi = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: INTESTAZIONI });

// ---------- archivio (con chiave di servizio: ogni richiesta filtra per proprietario) ----------

async function archivio(percorso: string, metodo = "GET", corpo?: unknown, preferenza = "return=representation") {
  const r = await fetch(`${URL_ARCHIVIO}/rest/v1/${percorso}`, {
    method: metodo,
    headers: {
      apikey: CHIAVE_SERVIZIO,
      Authorization: `Bearer ${CHIAVE_SERVIZIO}`,
      "Content-Type": "application/json",
      Prefer: preferenza,
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!r.ok) throw new Errore("archivio", `Archivio non raggiungibile (${r.status})`, 502);
  const testo = await r.text();
  return testo ? JSON.parse(testo) : null;
}

async function utenteDa(richiesta: Request): Promise<string> {
  const gettone = (richiesta.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!gettone) throw new Errore("accesso", "Accesso richiesto", 401);
  const r = await fetch(`${URL_ARCHIVIO}/auth/v1/user`, {
    headers: { apikey: CHIAVE_PUBBLICA, Authorization: `Bearer ${gettone}` },
  });
  if (!r.ok) throw new Errore("accesso", "Accesso non valido o scaduto", 401);
  const u = await r.json();
  if (!u?.id) throw new Errore("accesso", "Accesso non valido", 401);
  return u.id as string;
}

const cronaca = (uid: string, tipo: string, blocco: { id?: string; attivita_id?: string } | null, dettaglio = {}) =>
  archivio("cronologia", "POST", {
    proprietario: uid, tipo, blocco_id: blocco?.id ?? null, attivita_id: blocco?.attivita_id ?? null, dettaglio,
  }, "return=minimal");

// ---------- Google ----------

let permessiConcessi: string[] = [];

async function gettoneGoogle(uid: string): Promise<string> {
  if (!GOOGLE_ID || !GOOGLE_SEGRETO) {
    throw new Errore("google_non_configurato", "Le credenziali di Google non sono ancora state inserite", 503);
  }
  const righe = await archivio(`google_credenziali?proprietario=eq.${uid}&select=chiave_rinnovo`);
  if (!righe?.length) throw new Errore("google_scollegato", "Google Calendar non è collegato", 409);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_ID, client_secret: GOOGLE_SEGRETO,
      refresh_token: righe[0].chiave_rinnovo, grant_type: "refresh_token",
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (j.error === "invalid_grant") {
      throw new Errore("google_scollegato", "L'autorizzazione di Google è scaduta o è stata revocata: va ricollegato", 409);
    }
    throw new Errore("google", `Google non ha rinnovato l'accesso (${r.status})`, 502);
  }
  // Permessi effettivamente concessi da Google: servono a dimostrare che cosa Alfred può e non può fare.
  permessiConcessi = String(j.scope ?? "").split(" ").filter(Boolean)
    .map((x) => x.replace("https://www.googleapis.com/auth/", ""));
  return j.access_token as string;
}

async function google(gettone: string, metodo: string, percorso: string, corpo?: unknown, intestazioni: Record<string, string> = {}) {
  const r = await fetch(percorso.startsWith("http") ? percorso : `${GOOGLE}${percorso}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${gettone}`, "Content-Type": "application/json", ...intestazioni },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const testo = await r.text();
  let dati: any = null;
  try { dati = testo ? JSON.parse(testo) : null; } catch { /* risposta senza contenuto leggibile */ }
  return { stato: r.status, ok: r.ok, dati };
}

function esigi(r: { stato: number; ok: boolean; dati: any }, cosa: string) {
  if (r.ok) return r.dati;
  if (r.stato === 403) {
    throw new Errore("google_permesso", `Google ha rifiutato: ${cosa} (permesso mancante)`, 502);
  }
  throw new Errore("google", `Google non ha completato: ${cosa} (${r.stato})`, 502);
}

async function elencoCalendari(gettone: string) {
  const tutti: any[] = [];
  let pagina = "";
  do {
    const r = esigi(
      await google(gettone, "GET", `/users/me/calendarList?maxResults=250${pagina ? `&pageToken=${pagina}` : ""}`),
      "lettura dell'elenco dei calendari",
    );
    tutti.push(...(r.items ?? []));
    pagina = r.nextPageToken ?? "";
  } while (pagina);
  return tutti;
}

/** Restituisce l'identificativo del calendario di prova, creandolo se non esiste. */
async function calendarioDiProva(uid: string, gettone: string): Promise<string> {
  const righe = await archivio(`sincronizzazione?proprietario=eq.${uid}&select=calendario_id`);
  const noto = righe?.[0]?.calendario_id as string | undefined;
  if (noto) {
    const r = await google(gettone, "GET", `/calendars/${encodeURIComponent(noto)}`);
    if (r.ok) return noto;
    if (r.stato !== 404) esigi(r, "controllo del calendario di prova");
  }
  // Un calendario con lo stesso nome creato in precedenza da Alfred viene riusato.
  const esistente = (await elencoCalendari(gettone)).find(
    (c) => c.summary === NOME_CALENDARIO && c.accessRole === "owner" && !c.primary,
  );
  let id = esistente?.id as string | undefined;
  if (!id) {
    const nuovo = esigi(
      await google(gettone, "POST", "/calendars", {
        summary: NOME_CALENDARIO, timeZone: FUSO,
        description: "Calendario di prova creato da Alfred. Alfred scrive solo qui.",
      }),
      "creazione del calendario di prova",
    );
    id = nuovo.id;
    await cronaca(uid, "calendario_creato", null, { nome: NOME_CALENDARIO });
  }
  await archivio("sincronizzazione?on_conflict=proprietario", "POST", {
    proprietario: uid, calendario_id: id, calendario_nome: NOME_CALENDARIO, token_sync: null,
  }, "resolution=merge-duplicates,return=minimal");
  return id!;
}

const segnaRiuscito = (uid: string, altro: Record<string, unknown> = {}) =>
  archivio(`sincronizzazione?proprietario=eq.${uid}`, "PATCH", {
    ultimo_riuscito: new Date().toISOString(), ...altro,
  }, "return=minimal");

async function bloccoDi(uid: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id ?? "")) throw new Errore("richiesta", "Blocco non indicato");
  const righe = await archivio(
    `blocchi?id=eq.${id}&proprietario=eq.${uid}` +
      "&select=*,attivita(titolo,sottoschede(schede(progetti(nome,colore_google))))",
  );
  if (!righe?.length) throw new Errore("richiesta", "Blocco non trovato", 404);
  return righe[0];
}

const aggiornaBlocco = async (uid: string, id: string, campi: Record<string, unknown>) =>
  (await archivio(`blocchi?id=eq.${id}&proprietario=eq.${uid}`, "PATCH", campi))[0];

// ---------- azioni ----------

async function collega(uid: string, p: any) {
  if (typeof p.chiave_rinnovo === "string" && p.chiave_rinnovo.length > 10) {
    await archivio("google_credenziali?on_conflict=proprietario", "POST", {
      proprietario: uid, chiave_rinnovo: p.chiave_rinnovo, aggiornato_il: new Date().toISOString(),
    }, "resolution=merge-duplicates,return=minimal");
  }
  const gettone = await gettoneGoogle(uid);
  await calendarioDiProva(uid, gettone);
  await segnaRiuscito(uid, { ultimo_errore: null, ultimo_errore_il: null });
  return { collegato: true, calendario: NOME_CALENDARIO, permessi: permessiConcessi };
}

async function occupato(uid: string, p: any) {
  const da = new Date(p.da), a = new Date(p.a);
  if (isNaN(+da) || isNaN(+a) || a <= da || +a - +da > 62 * 86400000) {
    throw new Errore("richiesta", "Periodo non valido");
  }
  const gettone = await gettoneGoogle(uid);
  const prova = await calendarioDiProva(uid, gettone);
  // Tutti i calendari tranne quello di prova: i blocchi di Alfred li conosce già la pagina.
  const ids = (await elencoCalendari(gettone)).map((c) => c.id as string).filter((id) => id !== prova);
  const occupati: { inizio: string; fine: string }[] = [];
  let nonLetti = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const r = esigi(
      await google(gettone, "POST", "/freeBusy", {
        timeMin: da.toISOString(), timeMax: a.toISOString(), timeZone: FUSO,
        items: ids.slice(i, i + 50).map((id) => ({ id })),
      }),
      "lettura degli orari occupati",
    );
    for (const c of Object.values(r.calendars ?? {}) as any[]) {
      if (c.errors?.length) nonLetti++;
      for (const o of c.busy ?? []) occupati.push({ inizio: o.start, fine: o.end });
    }
  }
  await segnaRiuscito(uid);
  // Solo intervalli: nessun titolo, nessun nome di calendario.
  return { occupati, calendari_letti: ids.length - nonLetti, calendari_non_letti: nonLetti };
}

/**
 * Dice quali calendari non restituiscono gli orari occupati, con nome e motivo.
 * Legge i nomi dei calendari (autorizzato dall'utilizzatore l'11 novembre 2026), mai gli eventi.
 */
async function calendariNonLetti(uid: string) {
  const gettone = await gettoneGoogle(uid);
  const prova = await calendarioDiProva(uid, gettone);
  const elenco = (await elencoCalendari(gettone)).filter((c) => c.id !== prova);
  const adesso = new Date();
  const r = esigi(
    await google(gettone, "POST", "/freeBusy", {
      timeMin: adesso.toISOString(), timeMax: new Date(+adesso + 86400000).toISOString(), timeZone: FUSO,
      items: elenco.map((c) => ({ id: c.id })),
    }),
    "lettura degli orari occupati",
  );
  const nonLetti = elenco
    .filter((c) => r.calendars?.[c.id]?.errors?.length || !r.calendars?.[c.id])
    .map((c) => ({
      nome: c.summaryOverride ?? c.summary ?? "(senza nome)",
      accesso: c.accessRole,
      motivo: r.calendars?.[c.id]?.errors?.[0]?.reason ?? "nessuna risposta",
    }));
  return { calendari: elenco.length, non_letti: nonLetti };
}

async function creaBlocco(uid: string, p: any) {
  const b = await bloccoDi(uid, p.blocco_id);
  if (b.stato !== "da_scrivere") return { blocco: b, gia_scritto: true };
  const gettone = await gettoneGoogle(uid);
  const cal = await calendarioDiProva(uid, gettone);
  const progetto = b.attivita?.sottoschede?.schede?.progetti;
  const idEvento = b.id.replaceAll("-", ""); // identificativo fisso: una seconda richiesta non duplica
  const base = `/calendars/${encodeURIComponent(cal)}/events`;
  let r = await google(gettone, "POST", base, {
    id: idEvento,
    summary: b.attivita?.titolo ?? "Blocco Alfred",
    description: `Blocco creato da Alfred${progetto?.nome ? ` · progetto ${progetto.nome}` : ""}`,
    start: { dateTime: b.inizio, timeZone: FUSO },
    end: { dateTime: b.fine, timeZone: FUSO },
    colorId: String(progetto?.colore_google ?? 2),
    reminders: { useDefault: false, overrides: [] },
  });
  let giaPresente = false;
  if (r.stato === 409) {
    giaPresente = true;
    r = await google(gettone, "GET", `${base}/${idEvento}`);
  }
  const ev = esigi(r, "scrittura del blocco");
  const blocco = await aggiornaBlocco(uid, b.id, {
    stato: "in_calendario", google_evento_id: ev.id, google_etag: ev.etag,
    inizio: ev.start?.dateTime ?? b.inizio, fine: ev.end?.dateTime ?? b.fine,
    allineato_il: new Date().toISOString(),
  });
  await cronaca(uid, "blocco_scritto", b, { inizio: blocco.inizio, fine: blocco.fine, gia_presente: giaPresente });
  await segnaRiuscito(uid);
  return { blocco, gia_scritto: giaPresente };
}

async function spostaBlocco(uid: string, p: any) {
  const b = await bloccoDi(uid, p.blocco_id);
  const inizio = new Date(p.inizio), fine = new Date(p.fine);
  if (isNaN(+inizio) || isNaN(+fine) || fine <= inizio) throw new Errore("richiesta", "Orario non valido");
  if (b.stato !== "in_calendario" || !b.google_evento_id) {
    throw new Errore("richiesta", "Si può spostare solo un blocco presente in calendario");
  }
  const gettone = await gettoneGoogle(uid);
  const cal = await calendarioDiProva(uid, gettone);
  const r = await google(
    gettone, "PATCH", `/calendars/${encodeURIComponent(cal)}/events/${b.google_evento_id}`,
    { start: { dateTime: inizio.toISOString(), timeZone: FUSO }, end: { dateTime: fine.toISOString(), timeZone: FUSO } },
    b.google_etag ? { "If-Match": b.google_etag } : {},
  );
  // 412: nel frattempo il blocco è stato modificato in Google. Non si sovrascrive: decide Nico dopo l'allineamento.
  if (r.stato === 412) return { conflitto: true };
  const ev = esigi(r, "spostamento del blocco");
  const blocco = await aggiornaBlocco(uid, b.id, {
    inizio: ev.start.dateTime, fine: ev.end.dateTime, google_etag: ev.etag, allineato_il: new Date().toISOString(),
  });
  await cronaca(uid, "blocco_spostato_da_alfred", b, {
    da_inizio: b.inizio, da_fine: b.fine, a_inizio: blocco.inizio, a_fine: blocco.fine,
  });
  await segnaRiuscito(uid);
  return { blocco };
}

async function togliBlocco(uid: string, p: any) {
  const b = await bloccoDi(uid, p.blocco_id);
  if (b.stato === "da_scrivere") {
    return { blocco: await aggiornaBlocco(uid, b.id, { stato: "annullato" }) };
  }
  if (b.stato !== "in_calendario" || !b.google_evento_id) {
    throw new Errore("richiesta", "Si può togliere solo un blocco presente in calendario");
  }
  const gettone = await gettoneGoogle(uid);
  const cal = await calendarioDiProva(uid, gettone);
  const r = await google(gettone, "DELETE", `/calendars/${encodeURIComponent(cal)}/events/${b.google_evento_id}`);
  if (!r.ok && r.stato !== 404 && r.stato !== 410) esigi(r, "rimozione del blocco");
  const blocco = await aggiornaBlocco(uid, b.id, { stato: "annullato", allineato_il: new Date().toISOString() });
  await cronaca(uid, "blocco_tolto_da_alfred", b, { inizio: b.inizio, fine: b.fine });
  await segnaRiuscito(uid);
  return { blocco };
}

async function sincronizza(uid: string) {
  const gettone = await gettoneGoogle(uid);
  const cal = await calendarioDiProva(uid, gettone);
  const righe = await archivio(`sincronizzazione?proprietario=eq.${uid}&select=token_sync`);
  let segno = righe?.[0]?.token_sync as string | null;

  const eventi: any[] = [];
  let nuovoSegno = "";
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    eventi.length = 0;
    let pagina = "", scaduto = false;
    do {
      const q = new URLSearchParams({ maxResults: "250", showDeleted: "true" });
      if (segno) q.set("syncToken", segno);
      if (pagina) q.set("pageToken", pagina);
      const r = await google(gettone, "GET", `/calendars/${encodeURIComponent(cal)}/events?${q}`);
      if (r.stato === 410) { scaduto = true; break; } // segno scaduto: si rilegge tutto
      const d = esigi(r, "lettura delle novità del calendario di prova");
      eventi.push(...(d.items ?? []));
      pagina = d.nextPageToken ?? "";
      nuovoSegno = d.nextSyncToken ?? nuovoSegno;
    } while (pagina);
    if (!scaduto) break;
    segno = null;
  }

  const modifiche: any[] = [];
  let estranei = 0;
  if (eventi.length) {
    const ids = eventi.map((e) => `"${e.id}"`).join(",");
    const blocchi = await archivio(
      `blocchi?proprietario=eq.${uid}&google_evento_id=in.(${ids})&select=*,attivita(titolo)`,
    );
    const perEvento = new Map(blocchi.map((b: any) => [b.google_evento_id, b]));
    for (const ev of eventi) {
      const b: any = perEvento.get(ev.id);
      if (!b) { if (ev.status !== "cancelled") estranei++; continue; }
      if (b.stato !== "in_calendario") continue; // esito già registrato: la storia non si riscrive
      const titolo = b.attivita?.titolo ?? "";
      if (ev.status === "cancelled") {
        await aggiornaBlocco(uid, b.id, { stato: "rimosso_in_google", allineato_il: new Date().toISOString() });
        await cronaca(uid, "rimosso_in_google", b, { titolo, inizio: b.inizio, fine: b.fine });
        modifiche.push({ tipo: "rimosso_in_google", blocco_id: b.id, titolo, inizio: b.inizio, fine: b.fine });
        continue;
      }
      if (!ev.start?.dateTime || !ev.end?.dateTime) {
        // Trasformato in evento di giornata intera: Alfred non lo interpreta, lo segnala soltanto.
        if (b.google_etag !== ev.etag) {
          await aggiornaBlocco(uid, b.id, { google_etag: ev.etag });
          await cronaca(uid, "giornata_intera_in_google", b, { titolo });
          modifiche.push({ tipo: "giornata_intera_in_google", blocco_id: b.id, titolo });
        }
        continue;
      }
      const spostato = +new Date(ev.start.dateTime) !== +new Date(b.inizio) ||
        +new Date(ev.end.dateTime) !== +new Date(b.fine);
      if (spostato) {
        await aggiornaBlocco(uid, b.id, {
          inizio: ev.start.dateTime, fine: ev.end.dateTime, google_etag: ev.etag,
          allineato_il: new Date().toISOString(),
        });
        const d = { titolo, da_inizio: b.inizio, da_fine: b.fine, a_inizio: ev.start.dateTime, a_fine: ev.end.dateTime };
        await cronaca(uid, "spostato_in_google", b, d);
        modifiche.push({ tipo: "spostato_in_google", blocco_id: b.id, ...d });
      } else if (b.google_etag !== ev.etag) {
        await aggiornaBlocco(uid, b.id, { google_etag: ev.etag, allineato_il: new Date().toISOString() });
      }
    }
  }
  await segnaRiuscito(uid, {
    ...(nuovoSegno ? { token_sync: nuovoSegno } : {}), ultimo_errore: null, ultimo_errore_il: null,
  });
  return { modifiche, eventi_letti: eventi.length, eventi_non_di_alfred: estranei };
}

const AZIONI: Record<string, (uid: string, p: any) => Promise<unknown>> = {
  collega, occupato, crea_blocco: creaBlocco, sposta_blocco: spostaBlocco,
  togli_blocco: togliBlocco, sincronizza, calendari_non_letti: calendariNonLetti,
};

Deno.serve(async (richiesta) => {
  if (richiesta.method === "OPTIONS") return new Response("ok", { headers: INTESTAZIONI });
  let uid = "";
  try {
    if (richiesta.method !== "POST") throw new Errore("richiesta", "Metodo non ammesso", 405);
    uid = await utenteDa(richiesta);
    const p = await richiesta.json().catch(() => ({}));
    const azione = AZIONI[p?.azione];
    if (!azione) throw new Errore("richiesta", "Azione sconosciuta");
    return rispondi(await azione(uid, p));
  } catch (e) {
    const err = e instanceof Errore ? e : new Errore("interno", "Errore imprevisto della funzione", 500);
    if (!(e instanceof Errore)) console.error(e);
    if (uid && err.codice.startsWith("google")) {
      await archivio(`sincronizzazione?proprietario=eq.${uid}`, "PATCH", {
        ultimo_errore: err.message, ultimo_errore_il: new Date().toISOString(),
      }, "return=minimal").catch(() => {});
    }
    return rispondi({ errore: err.message, codice: err.codice }, err.stato);
  }
});
