#!/usr/bin/env python3
"""Legge i fogli «Flusso di cassa <anno>.xlsx», fa i conti e, se richiesto, copia i movimenti nell'archivio di Alfred.

I numeri li calcola questo programma, sempre allo stesso modo: chi scrive il rapporto li riporta, non li ricalcola.
Effettivi e previsti restano separati. Un dato che manca resta vuoto (null), mai zero.

Uso:
  python3 finanze/leggi_fogli.py --cartella "<cartella dei fogli>" --esito <file.json> [--invia] [--utente-prova] [--oggi AAAA-MM-GG]

  --invia         sostituisce nell'archivio i movimenti degli anni letti e aggiunge al risultato conti, ricorrenze,
                  debiti e obiettivi presi dall'archivio
  --utente-prova  lavora sull'utente di prova (per le prove automatiche) invece che sull'utilizzatore
"""
import argparse, datetime, json, os, re, sys, urllib.request, urllib.error
from decimal import Decimal, InvalidOperation

try:
    from openpyxl import load_workbook
except ImportError:
    sys.exit('Manca il lettore di fogli Excel (openpyxl). Si installa con: python3 -m pip install openpyxl')

MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
NOME_FILE = re.compile(r'^Flusso di cassa (\d{4})\.xlsx$', re.I)
COLONNE = {'data': 'data', 'descrizione': 'descrizione', 'categoria': 'categoria', 'entrata': 'entrata', 'uscita': 'uscita', 'conto': 'conto', 'stato': 'stato'}
EMAIL_PROVA = 'prova-automatica@alfred.invalid'
QUI = os.path.dirname(os.path.abspath(__file__))


def testo(v):
    return '' if v is None else str(v).strip()


def importo(v):
    """Restituisce (Decimal o None, errore o None). Accetta numeri e testi all'italiana («1.234,56 €»)."""
    if v is None or testo(v) == '':
        return None, None
    if isinstance(v, bool):
        return None, f'valore non numerico «{v}»'
    if isinstance(v, (int, float)):
        return Decimal(str(v)).quantize(Decimal('0.01')), None
    t = re.sub(r'[€\s]', '', str(v))
    if ',' in t:
        t = t.replace('.', '').replace(',', '.')
    try:
        return Decimal(t).quantize(Decimal('0.01')), None
    except InvalidOperation:
        return None, f'importo non leggibile «{v}»'


def giorno(v, anno, mese):
    """Restituisce (data ISO o None, errore o None)."""
    if v is None or testo(v) == '':
        return None, None
    if isinstance(v, datetime.datetime):
        return v.date().isoformat(), None
    if isinstance(v, datetime.date):
        return v.isoformat(), None
    m = re.match(r'^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?$', testo(v))
    if m:
        g, me, a = int(m.group(1)), int(m.group(2)), m.group(3)
        a = anno if a is None else (int(a) + 2000 if len(a) == 2 else int(a))
        try:
            return datetime.date(a, me, g).isoformat(), None
        except ValueError:
            pass
    return None, f'data non leggibile «{v}»'


def leggi_pagina(ws, ws_formule, anno, mese, nome_file):
    """Trova le gestioni (una riga di titolo seguita dalla riga «Data, Descrizione, …») e ne legge le righe."""
    movimenti, avvisi = [], []
    dove = lambda r: f'{nome_file}, pagina {ws.title}, riga {r}'
    righe = list(ws.iter_rows(values_only=True))
    gestione, mappa = None, None
    for i, valori in enumerate(righe, start=1):
        nomi = [testo(v).lower() for v in valori]
        if nomi and nomi[0] == 'data' and 'descrizione' in nomi:
            titolo = testo(righe[i - 2][0]) if i >= 2 else ''
            if not titolo:
                avvisi.append(f'{dove(i)}: tabella senza titolo della gestione, ignorata')
                gestione = None
                continue
            gestione = titolo
            mappa = {}
            for c, n in enumerate(nomi):
                for inizio, campo in COLONNE.items():
                    if n.startswith(inizio):
                        mappa[campo] = c
            mancanti = [c for c in ('entrata', 'uscita') if c not in mappa]
            if mancanti:
                avvisi.append(f'{dove(i)}: nella gestione «{gestione}» manca la colonna {", ".join(mancanti)}; gestione non letta')
                gestione = None
            continue
        if gestione is None:
            continue
        # La riga di titolo della gestione successiva non è un movimento.
        if i < len(righe) and testo(righe[i][0]).lower() == 'data':
            continue
        prendi = lambda campo: valori[mappa[campo]] if campo in mappa and mappa[campo] < len(valori) else None
        if all(testo(prendi(c)) == '' for c in COLONNE.values()):
            continue
        entrata, e1 = importo(prendi('entrata'))
        uscita, e2 = importo(prendi('uscita'))
        data, e3 = giorno(prendi('data'), anno, mese)
        for e in (e1, e2, e3):
            if e:
                avvisi.append(f'{dove(i)} ({gestione}): {e}')
        # Una formula scritta a mano e mai calcolata arriva vuota: va detto, non taciuto.
        for campo in ('entrata', 'uscita'):
            f = ws_formule.cell(row=i, column=mappa[campo] + 1).value
            if isinstance(f, str) and f.startswith('=') and prendi(campo) is None:
                avvisi.append(f'{dove(i)} ({gestione}): la cella {campo} contiene una formula senza risultato; apri e salva di nuovo il file')
        if entrata is None and uscita is None:
            avvisi.append(f'{dove(i)} ({gestione}): riga senza importo («{testo(prendi("descrizione"))[:40]}»), non contata')
            continue
        if entrata is not None and uscita is not None:
            avvisi.append(f'{dove(i)} ({gestione}): la riga ha sia entrata sia uscita; contate entrambe')
        for nome, v in (('entrata', entrata), ('uscita', uscita)):
            if v is not None and v < 0:
                avvisi.append(f'{dove(i)} ({gestione}): {nome} negativa ({v}); gli importi vanno scritti positivi')
        if data and (int(data[:4]) != anno or int(data[5:7]) != mese):
            avvisi.append(f'{dove(i)} ({gestione}): la data {data} non è del mese della pagina')
        stato = testo(prendi('stato'))
        if stato.lower() not in ('', 'previsto', 'incassato', 'pagato'):
            avvisi.append(f'{dove(i)} ({gestione}): stato «{stato}» non riconosciuto; contato come effettivo')
        movimenti.append({
            'anno': anno, 'mese': mese, 'gestione': gestione, 'riga': i, 'data': data,
            'descrizione': testo(prendi('descrizione')), 'categoria': testo(prendi('categoria')),
            'entrata': entrata, 'uscita': uscita, 'conto': testo(prendi('conto')), 'stato': stato,
            'previsto': stato.lower() == 'previsto',
        })
    return movimenti, avvisi


def leggi_cartella(cartella):
    movimenti, avvisi, file_letti, anni = [], [], [], []
    if not os.path.isdir(cartella):
        sys.exit(f'Non trovo la cartella dei fogli: {cartella}')
    for nome in sorted(os.listdir(cartella)):
        m = NOME_FILE.match(nome)
        if not m:
            continue
        anno = int(m.group(1))
        percorso = os.path.join(cartella, nome)
        try:
            valori = load_workbook(percorso, data_only=True)
            formule = load_workbook(percorso, data_only=False)
        except Exception as e:  # file aperto da un altro programma, rovinato, ecc.
            avvisi.append(f'{nome}: non sono riuscito ad aprirlo ({e}); i dati di quell\'anno nell\'archivio restano quelli della lettura precedente')
            continue
        file_letti.append(nome)
        anni.append(anno)
        trovati = 0
        for ws in valori.worksheets:
            nome_pagina = ws.title.strip().lower()
            if nome_pagina not in MESI:
                continue
            trovati += 1
            mov, avv = leggi_pagina(ws, formule[ws.title], anno, MESI.index(nome_pagina) + 1, nome)
            movimenti += mov
            avvisi += avv
        if trovati < 12:
            avvisi.append(f'{nome}: trovate {trovati} pagine con il nome di un mese su 12')
    # Un file più recente in formato Numbers accanto al foglio Excel vuol dire che le modifiche non sono nel file letto.
    for nome in os.listdir(cartella):
        if nome.lower().endswith('.numbers') and nome.lower().startswith('flusso di cassa 20'):
            avvisi.append(f'{nome}: è un file di Numbers e non viene letto. Va esportato in Excel con lo stesso nome del foglio (.xlsx).')
    if not file_letti:
        avvisi.append('Nessun file «Flusso di cassa <anno>.xlsx» letto nella cartella.')
    return movimenti, avvisi, file_letti, anni


# ---------- conti ----------

Z = Decimal('0')


def somma(righe, campo):
    return sum((r[campo] for r in righe if r[campo] is not None), Z)


def quadro(righe):
    eff = [r for r in righe if not r['previsto']]
    prev = [r for r in righe if r['previsto']]
    return {
        'entrate_effettive': somma(eff, 'entrata'), 'uscite_effettive': somma(eff, 'uscita'),
        'saldo_effettivo': somma(eff, 'entrata') - somma(eff, 'uscita'),
        'entrate_previste': somma(prev, 'entrata'), 'uscite_previste': somma(prev, 'uscita'), 'righe': len(righe),
    }


def percento(attuale, precedente):
    if precedente is None or precedente == 0 or attuale is None:
        return None
    return ((attuale - precedente) / precedente * 100).quantize(Decimal('0.1'))


def riepilogo(movimenti, oggi):
    gestioni = list(dict.fromkeys(m['gestione'] for m in movimenti))
    mesi = sorted({(m['anno'], m['mese']) for m in movimenti})
    per_mese = []
    prima = None
    for anno, mese in mesi:
        del_mese = [m for m in movimenti if (m['anno'], m['mese']) == (anno, mese)]
        q = quadro(del_mese)
        q.update({'mese': f'{anno}-{mese:02d}', 'concluso': f'{anno}-{mese:02d}' < oggi[:7]})
        q['crescita_entrate_percento'] = percento(q['entrate_effettive'], prima)
        q['per_gestione'] = {g: quadro([m for m in del_mese if m['gestione'] == g]) for g in gestioni if any(m['gestione'] == g for m in del_mese)}
        prima = q['entrate_effettive']
        per_mese.append(q)
    per_anno = {str(a): {'totale': quadro([m for m in movimenti if m['anno'] == a]),
                         'per_gestione': {g: quadro([m for m in movimenti if m['anno'] == a and m['gestione'] == g]) for g in gestioni}}
                for a in sorted({m['anno'] for m in movimenti})}
    scaduti = sorted([m for m in movimenti if m['previsto'] and m['data'] and m['data'] < oggi], key=lambda m: m['data'])
    categorie = {}
    for m in movimenti:
        if m['previsto'] or m['uscita'] is None:
            continue
        k = (str(m['anno']), m['gestione'], m['categoria'] or '(senza categoria)')
        categorie[k] = categorie.get(k, Z) + m['uscita']
    return {
        'gestioni': gestioni, 'per_mese': per_mese, 'per_anno': per_anno,
        'previsti_con_data_passata': scaduti,
        'uscite_effettive_per_categoria': [{'anno': a, 'gestione': g, 'categoria': c, 'uscite': v}
                                           for (a, g, c), v in sorted(categorie.items(), key=lambda x: -x[1])],
    }


def media_entrate(movimenti, gestioni, oggi, n=3):
    scelti = [m for m in movimenti if not gestioni or m['gestione'] in gestioni]
    mesi = sorted({f"{m['anno']}-{m['mese']:02d}" for m in scelti if f"{m['anno']}-{m['mese']:02d}" < oggi[:7]})[-n:]
    if not mesi:
        return None, []
    tot = sum((m['entrata'] for m in scelti if not m['previsto'] and m['entrata'] is not None and f"{m['anno']}-{m['mese']:02d}" in mesi), Z)
    return (tot / len(mesi)).quantize(Decimal('0.01')), mesi


def quadro_archivio(arch, movimenti, oggi):
    """Conti sui dati che stanno nell'archivio: impegni fissi, debiti, obiettivi."""
    D = lambda v: None if v is None else Decimal(str(v))
    ricorrenze = [r for r in arch['fin_ricorrenze'] if not r['archiviata']]
    uscite = [r for r in ricorrenze if r['verso'] == 'uscita']
    quota = lambda r: D(r['importo']) / 12 if r['cadenza'] == 'annuale' else D(r['importo'])
    aperti = [d for d in arch['fin_debiti'] if not d['estinto']]
    rate = sum((D(d['rata']) for d in aperti if d['rata'] is not None), Z)
    ricorrenti = sum((quota(r) for r in uscite), Z).quantize(Decimal('0.01'))
    residui = [D(d['residuo']) for d in aperti if d['residuo'] is not None]
    obiettivi = []
    for o in arch['fin_obiettivi']:
        voce = {'nome': o['nome'], 'tipo': o['tipo'], 'importo': D(o['importo']), 'gestioni': o['gestioni'], 'entro': o['entro'], 'nota': o['nota']}
        if o['tipo'] == 'entrate_mensili':
            media, mesi = media_entrate(movimenti, o['gestioni'], oggi)
            voce.update({'media_ultimi_mesi_conclusi': media, 'mesi_considerati': mesi,
                         'manca': None if media is None else max(Z, D(o['importo']) - media)})
        else:
            r = D(o['raggiunto'])
            voce.update({'raggiunto': r, 'manca': None if r is None else max(Z, D(o['importo']) - r)})
        obiettivi.append(voce)
    imp = (arch['fin_impostazioni'] or [None])[0]
    return {
        'impegni_fissi_al_mese': {'ricorrenti': ricorrenti, 'rate_dei_debiti': rate, 'totale': ricorrenti + rate,
                                  'debiti_senza_rata_indicata': len([d for d in aperti if d['rata'] is None])},
        'debiti': {'aperti': len(aperti), 'residuo_totale_noto': sum(residui, Z) if residui else None,
                   'senza_residuo_indicato': len(aperti) - len(residui), 'senza_tasso_indicato': len([d for d in aperti if d['tasso'] is None])},
        'obiettivi': obiettivi,
        'accantonamento_percento_indicato': None if not imp else imp['accantonamento_percento'],
        'tappe': {} if not imp else imp['tappe'],
    }


# ---------- archivio ----------

def segreti():
    percorso = os.path.join(QUI, '..', '.env.segreti')
    with open(percorso, encoding='utf-8') as f:
        return {r[:r.index('=')].strip(): r[r.index('=') + 1:].strip() for r in f if '=' in r and not r.lstrip().startswith('#')}


class Archivio:
    def __init__(self, utente_prova):
        s = segreti()
        self.base = s['SUPABASE_URL'].rstrip('/')
        self.testa = {'apikey': s['SUPABASE_CHIAVE_SERVIZIO'], 'Authorization': 'Bearer ' + s['SUPABASE_CHIAVE_SERVIZIO'],
                      'Content-Type': 'application/json', 'Prefer': 'return=representation'}
        utenti = self.chiedi('/auth/v1/admin/users?per_page=200')['users']
        scelti = [u for u in utenti if (u.get('email') == EMAIL_PROVA) == utente_prova]
        if len(scelti) != 1:
            sys.exit(f'Mi aspettavo un solo utente {"di prova" if utente_prova else "reale"}, ne trovo {len(scelti)}: mi fermo senza scrivere nulla.')
        self.utente = scelti[0]['id']

    def chiedi(self, percorso, metodo='GET', corpo=None):
        dati = None if corpo is None else json.dumps(corpo, default=str).encode()
        r = urllib.request.Request(self.base + percorso, data=dati, method=metodo, headers=self.testa)
        try:
            with urllib.request.urlopen(r, timeout=30) as risposta:
                t = risposta.read().decode()
                return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            sys.exit(f'L\'archivio ha risposto con un errore ({e.code}): {e.read().decode()[:300]}')
        except urllib.error.URLError as e:
            sys.exit(f'Archivio non raggiungibile: {e.reason}. Nessuna modifica completata.')

    def tabella(self, nome, ordine='creato_il'):
        return self.chiedi(f'/rest/v1/{nome}?proprietario=eq.{self.utente}&select=*&order={ordine}')

    def sostituisci_movimenti(self, movimenti, anni, file_letti, avvisi, letto_il):
        """Scrive i movimenti nuovi sotto una nuova lettura, poi toglie quelli vecchi degli stessi anni."""
        lettura = self.chiedi('/rest/v1/fin_letture', 'POST', {
            'proprietario': self.utente, 'letto_il': letto_il, 'file': file_letti, 'anni': anni, 'righe': len(movimenti), 'avvisi': avvisi})[0]
        righe = [{**m, 'proprietario': self.utente, 'lettura_id': lettura['id']} for m in movimenti]
        for i in range(0, len(righe), 500):
            self.chiedi('/rest/v1/fin_movimenti', 'POST', righe[i:i + 500])
        if anni:
            self.chiedi(f'/rest/v1/fin_movimenti?proprietario=eq.{self.utente}&anno=in.({",".join(map(str, anni))})&lettura_id=neq.{lettura["id"]}', 'DELETE')
        # Delle letture passate resta la traccia solo delle ultime venti.
        vecchie = self.chiedi(f'/rest/v1/fin_letture?proprietario=eq.{self.utente}&select=id&order=letto_il.desc&offset=20')
        for v in vecchie:
            resta = self.chiedi(f'/rest/v1/fin_movimenti?lettura_id=eq.{v["id"]}&select=id&limit=1')
            if not resta:
                self.chiedi(f'/rest/v1/fin_letture?id=eq.{v["id"]}', 'DELETE')
        return lettura['id']


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--cartella', required=True)
    p.add_argument('--esito', required=True)
    p.add_argument('--invia', action='store_true')
    p.add_argument('--utente-prova', action='store_true')
    p.add_argument('--oggi', default=datetime.date.today().isoformat())
    a = p.parse_args()

    movimenti, avvisi, file_letti, anni = leggi_cartella(a.cartella)
    letto_il = datetime.datetime.now(datetime.timezone.utc).isoformat()
    esito = {'letto_il': letto_il, 'oggi': a.oggi, 'cartella': a.cartella, 'file_letti': file_letti, 'righe_lette': len(movimenti),
             'avvisi': avvisi, 'riepilogo': riepilogo(movimenti, a.oggi), 'archivio': None, 'inviato': False}
    if a.invia:
        arch = Archivio(a.utente_prova)
        arch.sostituisci_movimenti(movimenti, anni, file_letti, avvisi, letto_il)
        dati = {t: arch.tabella(t, 'posizione' if t != 'fin_impostazioni' else 'creato_il')
                for t in ('fin_conti', 'fin_ricorrenze', 'fin_debiti', 'fin_obiettivi', 'fin_impostazioni')}
        for righe in dati.values():
            for r in righe:
                for campo in ('id', 'proprietario', 'creato_il', 'aggiornato_il', 'posizione'):
                    r.pop(campo, None)
        esito['archivio'] = {'conti': dati['fin_conti'], 'ricorrenze': dati['fin_ricorrenze'], 'debiti': dati['fin_debiti'],
                             'conti_fatti': quadro_archivio(dati, movimenti, a.oggi)}
        esito['inviato'] = True
    esito['movimenti'] = movimenti
    with open(a.esito, 'w', encoding='utf-8') as f:
        json.dump(esito, f, ensure_ascii=False, indent=1, default=lambda v: float(v) if isinstance(v, Decimal) else str(v))
    fine = "Movimenti copiati nell'archivio di Alfred." if a.invia else 'Archivio non toccato.'
    print(f'File letti: {", ".join(file_letti) or "nessuno"}. Righe con importo: {len(movimenti)}. Avvisi: {len(avvisi)}. {fine} Risultato in: {a.esito}')


if __name__ == '__main__':
    main()
