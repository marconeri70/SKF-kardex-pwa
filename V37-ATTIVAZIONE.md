# SKF Kardex v37 — separazione indice e componenti interni

## Stato
Preparazione backend, NON ancora attivata sul Worker Cloudflare. Nessuna migrazione eseguita automaticamente.

## Struttura
- `componenti`: SOLO indice generale (es. BB1-0026/BB1-63000).
- `gruppi_kardex`: nomi delle zone dentro ripiano/posizione (es. Zona 1 montaggio).
- `componenti_gruppo`: componenti interni a una zona, modificabili da operatore e amministratore.

## Attivazione sicura
1. Fare backup D1 e verificare il numero attuale di componenti.
2. Eseguire `V37-MIGRAZIONE.sql` nel database D1.
3. Verificare che la query finale riporti esattamente le tre zone del ripiano 2 con la posizione corretta.
4. Integrare `V37-WORKER-ROUTES.js` nel Worker attualmente pubblicato. Non sovrascrivere il Worker con il solo frammento.
5. Modificare la GET `/api/componenti` come indicato nel commento finale del frammento, preservando il formato JSON esistente.
6. Verificare `/api/componenti` (indice senza zone), `/api/gruppi-kardex` (zone), `/api/gruppi-kardex/:id/componenti` (contenuti).
7. Solo dopo la verifica, abilitare la nuova interfaccia frontend per la gestione dei gruppi.

## Sicurezza
Nessuna cancellazione automatica. Le tre zone originali rimangono in `componenti` e vengono nascoste dalla nuova GET solo dopo l'attivazione del Worker. La cancellazione di un gruppo non è permessa se contiene componenti. Le scritture richiedono una sessione autenticata.

## QR
Gli URL permanenti di catalogo generale e singoli ripiani non cambiano. I contenuti sono letti dal database aggiornato.
