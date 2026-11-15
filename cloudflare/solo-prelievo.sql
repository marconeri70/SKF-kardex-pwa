ALTER TABLE operatori ADD COLUMN solo_prelievo INTEGER NOT NULL DEFAULT 0 CHECK (solo_prelievo IN (0,1));
