# Heart Monitor — COLMI R09 HID

Versione Android nativa di test per usare i gesti del COLMI R09 tramite il profilo HID di Android, senza aprire lo streaming raw X/Y/Z.

## Obiettivo
- niente LED ottici tenuti accesi dall'app;
- intercettare i tasti HID inviati dal ring;
- mostrare dispositivo, KeyCode e ScanCode;
- associare ogni gesto rilevato a un'azione Android.

## Primo test
1. Installa l'APK.
2. In QRing abilita una volta **Controllo gestuale**, poi chiudi QRing.
3. Associa l'R09 nelle impostazioni Bluetooth se Android lo richiede.
4. Apri Heart Monitor R09 HID.
5. Premi **ABILITA ACCESSIBILITÀ** e abilita il servizio.
6. Premi **REGISTRA IL PROSSIMO GESTO HID** e fai un gesto.
7. Se l'R09 invia un comando HID, l'app mostra KeyCode/ScanCode e salva la mappatura.

Questa build è sperimentale: serve a scoprire esattamente quali eventi HID emette il firmware RT09_3.10.21_251107.
