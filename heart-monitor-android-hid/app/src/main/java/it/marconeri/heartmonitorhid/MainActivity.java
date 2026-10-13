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
    private TextView status, lastEvent, mappings;
    private Spinner actionSpinner;
    private final String[] actions = {
        "Scorri giù","Scorri su","Home","Indietro","App recenti","Notifiche",
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

        TextView title = text("💍 Heart Monitor — R09 HID", 28, true);
        title.setTextColor(Color.rgb(194,24,75));
        root.addView(title);

        TextView info = text("Modalità nativa: nessuno streaming X/Y/Z. I LED ottici non vengono attivati dall'app. Android ascolta i tasti HID inviati dall'anello.", 16, false);
        info.setPadding(0,dp(10),0,dp(18));
        root.addView(info);

        status = text("", 17, true);
        root.addView(card(status));

        Button accessibility = button("1 · ABILITA ACCESSIBILITÀ");
        accessibility.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
        root.addView(accessibility);

        Button bluetooth = button("2 · APRI BLUETOOTH");
        bluetooth.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)));
        root.addView(bluetooth);

        lastEvent = text("", 16, false);
        root.addView(card(lastEvent));

        TextView lab = text("AZIONE DA ASSOCIARE", 14, true);
        lab.setPadding(0,dp(16),0,dp(6));
        root.addView(lab);

        actionSpinner = new Spinner(this);
        actionSpinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, actions));
        root.addView(actionSpinner, new LinearLayout.LayoutParams(-1, dp(56)));

        Button capture = button("🎯 REGISTRA IL PROSSIMO GESTO HID");
        capture.setOnClickListener(v -> {
            getSharedPreferences("ringhid", MODE_PRIVATE).edit()
                .putBoolean("capture_armed", true)
                .putString("capture_action", actions[actionSpinner.getSelectedItemPosition()])
                .apply();
            Toast.makeText(this, "Ora fai il gesto con l'anello", Toast.LENGTH_LONG).show();
            refresh();
        });
        root.addView(capture);

        mappings = text("", 15, false);
        root.addView(card(mappings));

        Button clear = button("CANCELLA MAPPATURE");
        clear.setOnClickListener(v -> {
            SharedPreferences p=getSharedPreferences("ringhid",MODE_PRIVATE);
            SharedPreferences.Editor e=p.edit();
            for(String k:p.getAll().keySet()) if(k.startsWith("map_")) e.remove(k);
            e.apply();
            refresh();
        });
        root.addView(clear);

        TextView hint=text("Test consigliato: in QRing abilita una volta “Controllo gestuale”, poi chiudi QRing. Associa l'R09 in Bluetooth se richiesto. Nell'app premi “Registra” e fai un gesto. Se arriva un comando HID vedrai KeyCode, ScanCode e dispositivo.",14,false);
        hint.setPadding(0,dp(18),0,0);
        root.addView(hint);
        return scroll;
    }

    private void refresh() {
        SharedPreferences p=getSharedPreferences("ringhid",MODE_PRIVATE);
        boolean enabled = RingGestureAccessibilityService.isEnabled(this);
        boolean armed = p.getBoolean("capture_armed",false);
        status.setText((enabled ? "✅ Servizio HID attivo" : "⚠️ Servizio HID non abilitato") +
                (armed ? "\n🎯 Registrazione armata: fai ora il gesto" : ""));

        String dev=p.getString("last_device","--");
        int key=p.getInt("last_key",-1), scan=p.getInt("last_scan",-1);
        long t=p.getLong("last_time",0);
        lastEvent.setText("ULTIMO EVENTO HID\nDispositivo: "+dev+
                "\nKeyCode: "+(key<0?"--":key)+"   ScanCode: "+(scan<0?"--":scan)+
                "\nOra: "+(t==0?"--":new java.text.SimpleDateFormat("HH:mm:ss", Locale.ITALY).format(new Date(t))));

        StringBuilder sb=new StringBuilder("GESTI PROGRAMMATI\n");
        int n=0;
        for(Map.Entry<String,?> e:p.getAll().entrySet()){
            if(e.getKey().startsWith("map_")){
                n++;
                sb.append("• ").append(e.getKey().substring(4).replace('_',' ')).append(" → ").append(e.getValue()).append("\n");
            }
        }
        if(n==0) sb.append("Nessuno. Registra il primo gesto.");
        mappings.setText(sb.toString());
    }

    private TextView text(String s,int sp,boolean bold){
        TextView t=new TextView(this); t.setText(s); t.setTextSize(sp); t.setTextColor(Color.rgb(40,40,45));
        if(bold)t.setTypeface(null,1); return t;
    }
    private View card(View v){
        LinearLayout box=new LinearLayout(this); box.setPadding(dp(16),dp(15),dp(16),dp(15));
        box.setBackgroundColor(Color.WHITE); box.addView(v,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2); lp.setMargins(0,dp(10),0,dp(8)); box.setLayoutParams(lp); return box;
    }
    private Button button(String s){
        Button b=new Button(this); b.setText(s); b.setTextSize(16);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(62)); lp.setMargins(0,dp(8),0,dp(8)); b.setLayoutParams(lp); return b;
    }
    private int dp(int v){ return (int)(v*getResources().getDisplayMetrics().density+0.5f); }
}
