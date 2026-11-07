# SKF Kardex v33 — completamento backend (Cloudflare Worker + D1)

La UI v33 è già predisposta. NON è possibile abilitare la gestione posizioni senza aggiornare il Worker pubblicato: il sorgente del Worker non è presente in questo repository.

## Backup
Prima di ogni migrazione salvare il bookmark Time Travel e verificare il contenuto di componenti.

## Schema D1 (non distruttivo)
Eseguire nella Console D1:
```sql
CREATE TABLE IF NOT EXISTS posizioni (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL COLLATE NOCASE UNIQUE,
  ordinamento INTEGER NOT NULL DEFAULT 100,
  creato_il TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO posizioni (nome, ordinamento) VALUES
 ('Sinistra',10),('Centrale',20),('Destra',30),('Da definire',999);
```

**Attenzione:** la tabella componenti esistente ha un CHECK che consente solo quattro posizioni. Occorre una migrazione verificata sullo schema REALE (colonne, indici, trigger, foreign key) prima di rimuovere il CHECK. Non eseguire un DROP/RENAME copiato da un altro schema. Nessun componente deve essere eliminato o duplicato.

## Contratto API richiesto
- GET /api/posizioni -> {"posizioni":[{"nome":"Sinistra"},...]} pubblico
- POST /api/posizioni {"nome":"Nuova"} -> solo admin
- PATCH /api/posizioni/:nome {"nome":"Nuovo nome"} -> solo admin
- DELETE /api/posizioni/:nome -> solo admin

Il Worker deve:
- Validare nomi (1-60 caratteri), normalizzare spazi, impedire duplicati senza distinzione maiuscole/minuscole.
- Impedire la modifica/rimozione della posizione speciale "Da definire".
- Autenticare e autorizzare lato server tutte le mutazioni.
- Rinomina: transazione atomica per aggiornare sia posizioni.nome sia tutte le righe componenti.posizione interessate.
- Eliminazione: rifiutare se esiste anche un solo componente associato (HTTP 409); mai cancellare i componenti.
- POST/PATCH componente: validare la posizione rispetto alla tabella posizioni, non a un elenco hardcoded.
- Non consentire che la UI o il QR alterino dati in assenza di autorizzazione.
- Configurare CORS e preflight per PATCH/DELETE.
- Dopo la migrazione testare un'aggiunta, una rinomina con componenti associati, un'eliminazione bloccata e la visualizzazione QR.

La UI v33 rileva se GET /api/posizioni è disponibile; se manca, lascia disabilitati i comandi di gestione e mantiene i valori standard. Il QR conserva lo stesso indirizzo.
