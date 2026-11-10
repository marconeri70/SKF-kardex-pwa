-- SKF Kardex v37: strutture separate. Eseguire SOLO dopo backup D1.
-- Non modifica né cancella righe della tabella componenti, posizioni o QR.
CREATE TABLE IF NOT EXISTS gruppi_kardex (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 ripiano TEXT NOT NULL,
 posizione TEXT NOT NULL,
 nome TEXT NOT NULL,
 legacy_componente_id INTEGER UNIQUE,
 creato_il TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 aggiornato_il TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(ripiano,posizione,nome)
);
CREATE INDEX IF NOT EXISTS idx_gruppi_kardex_ripiano ON gruppi_kardex(ripiano,posizione);
CREATE TABLE IF NOT EXISTS componenti_gruppo (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 gruppo_id INTEGER NOT NULL REFERENCES gruppi_kardex(id) ON DELETE RESTRICT,
 tipo TEXT NOT NULL CHECK(length(trim(tipo)) BETWEEN 1 AND 150),
 creato_il TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 aggiornato_il TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_componenti_gruppo_gruppo ON componenti_gruppo(gruppo_id);
-- Migrazione non distruttiva dei tre nomi già presenti nel ripiano 2.
INSERT OR IGNORE INTO gruppi_kardex(ripiano,posizione,nome,legacy_componente_id)
SELECT ripiano,posizione,tipo,id FROM componenti
WHERE ripiano='2' AND tipo IN ('Zona 1 montaggio','Zona 2 montaggio','Zona 3 montaggio');
-- Verificare le associazioni PRIMA di abilitare il Worker v37.
SELECT g.id,g.ripiano,g.posizione,g.nome,g.legacy_componente_id FROM gruppi_kardex g ORDER BY g.ripiano,g.posizione,g.nome;
-- Non cancellare i record originali: il Worker v37 li escluderà SOLO dalla risposta /api/componenti.
