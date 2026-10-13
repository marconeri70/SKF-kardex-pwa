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
    private TextView status, live, table;
    private final String[] names={"Su","Giù","Destra","Sinistra","Avanti","Indietro"};
    private final String[] actions={
        "Nessuna","Scorri su","Scorri giù","Scorri sinistra","Scorri destra",
        "Home","Indietro","App recenti","Notifiche",
        "Volume +","Volume -","Play/Pausa","Brano successivo","Brano precedente",
        "Apri fotocamera","Apri Heart Monitor"
    };
    private Spinner[] actionSpinners=new Spinner[6];
    private BroadcastReceiver receiver;

    @Override public void onCreate(Bundle b){
        super.onCreate(b);
        setContentView(buildUi());
        receiver=new BroadcastReceiver(){
            @Override public void onReceive(Context c, Intent i){ refresh(); }
        };
    }

    @Override protected void onResume(){
        super.onResume();
        IntentFilter f=new IntentFilter(RingGestureAccessibilityService.ACTION_EVENT);
        if(Build.VERSION.SDK_INT>=33) registerReceiver(receiver,f,Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(receiver,f);
        refresh();
    }

    @Override protected void onPause(){
        super.onPause();
        try{ unregisterReceiver(receiver); }catch(Exception ignored){}
    }

    private View buildUi(){
        ScrollView scroll=new ScrollView(this);
        LinearLayout root=new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20),dp(18),dp(20),dp(30));
        root.setBackgroundColor(Color.rgb(250,248,252));
        scroll.addView(root);

        TextView title=text("💍 R09 Multi-Gesti · LED spenti",27,true);
        title.setTextColor(Color.rgb(194,24,75));
        root.addView(title);

        TextView expl=text("Il test ha dimostrato che Su e Giù inviano entrambi KEYCODE_MEDIA_NEXT (87), quindi il firmware non trasmette la direzione. Questa modalità crea 6 comandi simultanei contando movimenti consecutivi: 1=Su, 2=Giù, 3=Destra, 4=Sinistra, 5=Avanti, 6=Indietro. I LED restano spenti.",15,false);
        expl.setPadding(0,dp(10),0,dp(14));
        root.addView(expl);

        status=text("",17,true);
        root.addView(card(status));

        Button accessibility=button("CONTROLLA ACCESSIBILITÀ");
        accessibility.setOnClickListener(v->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
        root.addView(accessibility);

        live=text("",16,true);
        root.addView(card(live));

        SharedPreferences p=getSharedPreferences("ringhid",MODE_PRIVATE);

        for(int i=0;i<6;i++){
            TextView label=text((i+1)+" movimento"+(i==0?"":"i")+" → "+names[i],16,true);
            label.setPadding(0,dp(12),0,dp(4));
            root.addView(label);

            Spinner sp=new Spinner(this);
            sp.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,actions));
            actionSpinners[i]=sp;
            String saved=p.getString("seq_action_"+(i+1), defaultAction(i));
            sp.setSelection(indexOf(actions,saved));
            root.addView(sp,new LinearLayout.LayoutParams(-1,dp(54)));
        }

        Button save=button("💾 SALVA TUTTI I 6 COMANDI");
        save.setOnClickListener(v->{
            SharedPreferences.Editor e=getSharedPreferences("ringhid",MODE_PRIVATE).edit();
            for(int i=0;i<6;i++){
                e.putString("seq_action_"+(i+1),actions[actionSpinners[i].getSelectedItemPosition()]);
            }
            e.apply();
            Toast.makeText(this,"6 comandi salvati e attivi insieme",Toast.LENGTH_SHORT).show();
            refresh();
        });
        root.addView(save);

        table=text("",15,false);
        root.addView(card(table));

        TextView note=text("Uso: esegui i movimenti uno dopo l'altro con meno di circa 0,65 s tra uno e l'altro. Dopo l'ultimo movimento l'app attende 0,65 s e poi esegue l'azione. È il compromesso per avere più comandi con LED spenti sul firmware attuale.",14,false);
        note.setPadding(0,dp(14),0,0);
        root.addView(note);

        return scroll;
    }

    private String defaultAction(int i){
        switch(i){
            case 0:return "Scorri su";
            case 1:return "Scorri giù";
            case 2:return "Scorri destra";
            case 3:return "Scorri sinistra";
            case 4:return "Home";
            case 5:return "Indietro";
            default:return "Nessuna";
        }
    }

    private void refresh(){
        SharedPreferences p=getSharedPreferences("ringhid",MODE_PRIVATE);
        boolean enabled=RingGestureAccessibilityService.isEnabled(this);
        status.setText(enabled?"✅ Servizio HID attivo":"⚠️ Servizio HID non abilitato");

        int liveCount=p.getInt("live_pulse_count",0);
        int lastCount=p.getInt("last_sequence_count",0);
        long lastTime=p.getLong("last_sequence_time",0);
        live.setText("SEQUENZA IN CORSO: "+liveCount+
                "\nUltimo comando: "+(lastCount==0?"--":lastCount+" movimento"+(lastCount==1?"":"i"))+
                "\nOra: "+(lastTime==0?"--":new java.text.SimpleDateFormat("HH:mm:ss",Locale.ITALY).format(new Date(lastTime))));

        StringBuilder sb=new StringBuilder("COMANDI ATTIVI SIMULTANEAMENTE\n");
        for(int i=0;i<6;i++){
            String a=p.getString("seq_action_"+(i+1),defaultAction(i));
            sb.append("• ").append(names[i]).append(" (").append(i+1).append("x) → ").append(a).append("\n");
        }
        table.setText(sb.toString());
    }

    private int indexOf(String[] arr,String s){
        for(int i=0;i<arr.length;i++) if(arr[i].equals(s)) return i;
        return 0;
    }

    private TextView text(String s,int sp,boolean bold){
        TextView t=new TextView(this);
        t.setText(s); t.setTextSize(sp); t.setTextColor(Color.rgb(40,40,45));
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
        b.setText(s); b.setTextSize(15);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(62));
        lp.setMargins(0,dp(8),0,dp(8));
        b.setLayoutParams(lp);
        return b;
    }

    private int dp(int v){
        return (int)(v*getResources().getDisplayMetrics().density+0.5f);
    }
}
