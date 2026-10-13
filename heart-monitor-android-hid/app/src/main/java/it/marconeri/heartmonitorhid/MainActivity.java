package it.marconeri.heartmonitorhid;

import android.app.Activity;
import android.content.*;
import android.graphics.Color;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import java.util.*;

public class MainActivity extends Activity {
    private TextView status, lastEvent, mappings, conflict;
    private Spinner gestureSpinner, actionSpinner;

    private final String[] gestures = {
        "Su","Giù","Destra","Sinistra","Avanti","Indietro",
        "Rotazione oraria","Rotazione antioraria","Doppio movimento","Conferma"
    };

    private final String[] actions = {
        "Scorri su","Scorri giù","Scorri sinistra","Scorri destra",
        "Home","Indietro","App recenti","Notifiche",
        "Volume +","Volume -","Play/Pausa","Brano successivo","Brano precedente",
        "Apri fotocamera","Apri Heart Monitor"
    };

    private BroadcastReceiver receiver;

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(buildUi());
        receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) { refresh(); }
        };
    }

    @Override protected void onResume() {
        super.onResume();
        IntentFilter f = new IntentFilter(RingGestureAccessibilityService.ACTION_EVENT);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(receiver, f);
        refresh();
    }

    @Override protected void onPause() {
        super.onPause();
        try { unregisterReceiver(receiver); } catch (Exception ignored) {}
    }

    private View buildUi() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22), dp(20), dp(22), dp(30));
        root.setBackgroundColor(Color.rgb(250,248,252));
        scroll.addView(root);

        TextView title = text("💍 Heart Monitor — R09 Multi-Gesti", 27, true);
        title.setTextColor(Color.rgb(194,24,75));
        root.addView(title);

        TextView info = text("Puoi registrare più gesti e lasciarli tutti attivi contemporaneamente. Ogni gesto viene associato al comando HID nativo inviato dall'R09, senza streaming X/Y/Z e senza accendere i LED ottici.", 16, false);
        info.setPadding(0,dp(10),0,dp(14));
        root.addView(info);

        status = text("", 17, true);
        root.addView(card(status));

        Button accessibility = button("ABILITA / CONTROLLA ACCESSIBILITÀ");
        accessibility.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
        root.addView(accessibility);

        lastEvent = text("", 16, false);
        root.addView(card(lastEvent));

        conflict = text("", 15, true);
        conflict.setTextColor(Color.rgb(180,30,30));
        root.addView(conflict);

        TextView gLab = text("NOME DEL GESTO", 14, true);
        gLab.setPadding(0,dp(16),0,dp(6));
        root.addView(gLab);

        gestureSpinner = new Spinner(this);
        gestureSpinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, gestures));
        root.addView(gestureSpinner, new LinearLayout.LayoutParams(-1, dp(56)));

        TextView aLab = text("AZIONE DA ESEGUIRE", 14, true);
        aLab.setPadding(0,dp(14),0,dp(6));
        root.addView(aLab);

        actionSpinner = new Spinner(this);
        actionSpinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, actions));
        root.addView(actionSpinner, new LinearLayout.LayoutParams(-1, dp(56)));

        Button capture = button("🎯 REGISTRA / AGGIORNA QUESTO GESTO");
        capture.setOnClickListener(v -> {
            String slot=gestures[gestureSpinner.getSelectedItemPosition()];
            String action=actions[actionSpinner.getSelectedItemPosition()];
            getSharedPreferences("ringhid", MODE_PRIVATE).edit()
                .putBoolean("capture_armed", true)
                .putString("capture_slot", slot)
                .putString("capture_action", action)
                .remove("capture_error")
                .apply();
            Toast.makeText(this, "Fai ora il gesto «"+slot+"» con l'anello", Toast.LENGTH_LONG).show();
            refresh();
        });
        root.addView(capture);

        Button deleteSelected = button("ELIMINA GESTO SELEZIONATO");
        deleteSelected.setOnClickListener(v -> deleteSlot(gestures[gestureSpinner.getSelectedItemPosition()]));
        root.addView(deleteSelected);

        mappings = text("", 15, false);
        root.addView(card(mappings));

        Button clear = button("CANCELLA TUTTI I GESTI");
        clear.setOnClickListener(v -> clearAll());
        root.addView(clear);

        TextView hint=text("Tutti i gesti registrati restano attivi insieme. Se due movimenti diversi dell'R09 inviano lo stesso KeyCode/ScanCode, l'app lo segnala: in modalità HID quei due movimenti non possono essere distinti senza usare l'accelerometro raw.",14,false);
        hint.setPadding(0,dp(18),0,0);
        root.addView(hint);

        return scroll;
    }

    private void deleteSlot(String slot){
        SharedPreferences p=getSharedPreferences("ringhid",MODE_PRIVATE);
        String sig=p.getString("slot_sig_"+slot,null);
        SharedPreferences.Editor e=p.edit();
        if(sig!=null){
            e.remove("map_"+sig);
            e.remove("sig_slot_"+sig);
            e.remove("label_"+sig);
        }
        e.remove("slot_sig_"+slot).apply();
        refresh();
    }

    private void clearAll(){
        SharedPreferences p=getSharedPreferences("ringhid",MODE_PRIVATE);
        SharedPreferences.Editor e=p.edit();
        for(String k:p.getAll().keySet()){
            if(k.startsWith("map_") || k.startsWith("label_") ||
               k.startsWith("slot_sig_") || k.startsWith("sig_slot_")){
                e.remove(k);
            }
        }
        e.remove("capture_error").apply();
        refresh();
    }

    private void refresh() {
        SharedPreferences p=getSharedPreferences("ringhid",MODE_PRIVATE);
        boolean enabled = RingGestureAccessibilityService.isEnabled(this);
        boolean armed = p.getBoolean("capture_armed",false);
        String slot=p.getString("capture_slot","");

        status.setText((enabled ? "✅ Servizio HID attivo" : "⚠️ Servizio HID non abilitato") +
                (armed ? "\n🎯 In attesa del gesto: "+slot : ""));

        String err=p.getString("capture_error","");
        conflict.setText(err.isEmpty() ? "" : "⚠️ "+err);

        String dev=p.getString("last_device","--");
        int key=p.getInt("last_key",-1), scan=p.getInt("last_scan",-1);
        String keyName=p.getString("last_key_name", key<0?"--":KeyEvent.keyCodeToString(key));
        long t=p.getLong("last_time",0);

        lastEvent.setText("ULTIMO EVENTO HID ESTERNO\nDispositivo: "+dev+
                "\nTasto: "+keyName+
                "\nKeyCode: "+(key<0?"--":key)+"   ScanCode: "+(scan<0?"--":scan)+
                "\nOra: "+(t==0?"--":new java.text.SimpleDateFormat("HH:mm:ss", Locale.ITALY).format(new Date(t))));

        StringBuilder sb=new StringBuilder("GESTI ATTIVI SIMULTANEAMENTE\n");
        int n=0;
        for(String g:gestures){
            String sig=p.getString("slot_sig_"+g,null);
            if(sig!=null){
                String action=p.getString("map_"+sig,"--");
                String label=p.getString("label_"+sig,prettyLegacy(sig));
                n++;
                sb.append("• ").append(g).append(" → ").append(action).append("\n");
                sb.append("  ").append(label).append("\n");
            }
        }
        if(n==0) sb.append("Nessuno. Registra il primo gesto.");
        else sb.insert("GESTI ATTIVI SIMULTANEAMENTE\n".length(),"Attivi: "+n+"\n");
        mappings.setText(sb.toString());
    }

    private String prettyLegacy(String sig){
        try{
            String[] parts=sig.split("_");
            int key=Integer.parseInt(parts[0].substring(1));
            int scan=Integer.parseInt(parts[1].substring(1));
            return KeyEvent.keyCodeToString(key)+" ("+key+") · Scan "+scan;
        }catch(Exception e){ return sig; }
    }

    private TextView text(String s,int sp,boolean bold){
        TextView t=new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(Color.rgb(40,40,45));
        if(bold)t.setTypeface(null,1);
        return t;
    }

    private View card(View v){
        LinearLayout box=new LinearLayout(this);
        box.setPadding(dp(16),dp(15),dp(16),dp(15));
        box.setBackgroundColor(Color.WHITE);
        box.addView(v,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
        lp.setMargins(0,dp(10),0,dp(8));
        box.setLayoutParams(lp);
        return box;
    }

    private Button button(String s){
        Button b=new Button(this);
        b.setText(s);
        b.setTextSize(15);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(62));
        lp.setMargins(0,dp(8),0,dp(8));
        b.setLayoutParams(lp);
        return b;
    }

    private int dp(int v){
        return (int)(v*getResources().getDisplayMetrics().density+0.5f);
    }
}
