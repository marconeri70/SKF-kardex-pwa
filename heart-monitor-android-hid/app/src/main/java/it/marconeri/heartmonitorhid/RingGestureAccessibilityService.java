package it.marconeri.heartmonitorhid;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.*;
import android.graphics.Path;
import android.media.AudioManager;
import android.os.*;
import android.provider.MediaStore;
import android.view.*;
import java.util.*;

public class RingGestureAccessibilityService extends AccessibilityService {
    public static final String ACTION_EVENT="it.marconeri.heartmonitorhid.HID_EVENT";
    private SharedPreferences prefs;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private int pulseCount=0;
    private long lastPulse=0;
    private final Runnable finalizeSequence=this::fireSequence;

    @Override public void onServiceConnected() {
        prefs=getSharedPreferences("ringhid",MODE_PRIVATE);
    }

    @Override protected boolean onKeyEvent(KeyEvent event) {
        if(event.getAction()!=KeyEvent.ACTION_DOWN) return false;
        if(prefs==null) prefs=getSharedPreferences("ringhid",MODE_PRIVATE);

        InputDevice d=InputDevice.getDevice(event.getDeviceId());
        String device=d!=null && d.getName()!=null ? d.getName() : "Sconosciuto";
        boolean external=d!=null && d.isExternal();

        if(!external) return false;

        int key=event.getKeyCode(), scan=event.getScanCode();
        prefs.edit()
            .putString("last_device",device)
            .putInt("last_key",key)
            .putString("last_key_name",KeyEvent.keyCodeToString(key))
            .putInt("last_scan",scan)
            .putLong("last_time",System.currentTimeMillis())
            .apply();

        long now=SystemClock.uptimeMillis();
        if(now-lastPulse<120) return true; // debounce
        lastPulse=now;

        pulseCount=Math.min(6,pulseCount+1);
        prefs.edit().putInt("live_pulse_count",pulseCount).apply();
        handler.removeCallbacks(finalizeSequence);
        handler.postDelayed(finalizeSequence,650);
        sendBroadcast(new Intent(ACTION_EVENT).setPackage(getPackageName()));
        return true;
    }

    private void fireSequence(){
        if(pulseCount<=0) return;
        int count=pulseCount;
        pulseCount=0;
        prefs.edit()
            .putInt("live_pulse_count",0)
            .putInt("last_sequence_count",count)
            .putLong("last_sequence_time",System.currentTimeMillis())
            .apply();

        String action=prefs.getString("seq_action_"+count,null);
        if(action!=null && !action.equals("Nessuna")){
            runAction(action);
        }else{
            vibrate(false);
        }
        sendBroadcast(new Intent(ACTION_EVENT).setPackage(getPackageName()));
    }

    private void runAction(String a){
        switch(a){
            case "Scorri su": swipe(0,-1); break;
            case "Scorri giù": swipe(0,1); break;
            case "Scorri sinistra": swipe(-1,0); break;
            case "Scorri destra": swipe(1,0); break;
            case "Home": performGlobalAction(GLOBAL_ACTION_HOME); break;
            case "Indietro": performGlobalAction(GLOBAL_ACTION_BACK); break;
            case "App recenti": performGlobalAction(GLOBAL_ACTION_RECENTS); break;
            case "Notifiche": performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS); break;
            case "Volume +": volume(true); break;
            case "Volume -": volume(false); break;
            case "Play/Pausa": media(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE); break;
            case "Brano successivo": media(KeyEvent.KEYCODE_MEDIA_NEXT); break;
            case "Brano precedente": media(KeyEvent.KEYCODE_MEDIA_PREVIOUS); break;
            case "Apri fotocamera":
                try{
                    Intent i=new Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA);
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(i);
                }catch(Exception ignored){}
                break;
            case "Apri Heart Monitor":
                Intent launch=getPackageManager().getLaunchIntentForPackage(getPackageName());
                if(launch!=null){
                    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(launch);
                }
                break;
        }
        vibrate(true);
    }

    private void swipe(int dx,int dy){
        android.util.DisplayMetrics dm=getResources().getDisplayMetrics();
        float cx=dm.widthPixels/2f, cy=dm.heightPixels/2f;
        float spanX=dm.widthPixels*0.30f, spanY=dm.heightPixels*0.25f;
        float sx=cx, sy=cy, ex=cx, ey=cy;
        if(dx<0){ sx=cx+spanX; ex=cx-spanX; }
        if(dx>0){ sx=cx-spanX; ex=cx+spanX; }
        if(dy<0){ sy=cy+spanY; ey=cy-spanY; }
        if(dy>0){ sy=cy-spanY; ey=cy+spanY; }

        Path p=new Path();
        p.moveTo(sx,sy);
        p.lineTo(ex,ey);
        GestureDescription.Builder b=new GestureDescription.Builder();
        b.addStroke(new GestureDescription.StrokeDescription(p,0,280));
        dispatchGesture(b.build(),null,null);
    }

    private void volume(boolean up){
        AudioManager am=(AudioManager)getSystemService(AUDIO_SERVICE);
        am.adjustStreamVolume(AudioManager.STREAM_MUSIC,
                up?AudioManager.ADJUST_RAISE:AudioManager.ADJUST_LOWER,
                AudioManager.FLAG_SHOW_UI);
    }

    private void media(int code){
        AudioManager am=(AudioManager)getSystemService(AUDIO_SERVICE);
        long now=SystemClock.uptimeMillis();
        am.dispatchMediaKeyEvent(new KeyEvent(now,now,KeyEvent.ACTION_DOWN,code,0));
        am.dispatchMediaKeyEvent(new KeyEvent(now,now,KeyEvent.ACTION_UP,code,0));
    }

    private void vibrate(boolean ok){
        Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE);
        if(v==null) return;
        if(Build.VERSION.SDK_INT>=26){
            if(ok) v.vibrate(VibrationEffect.createOneShot(45,VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(VibrationEffect.createWaveform(new long[]{0,35,45,35},-1));
        }else{
            if(ok) v.vibrate(45);
            else v.vibrate(new long[]{0,35,45,35},-1);
        }
    }

    @Override public void onAccessibilityEvent(android.view.accessibility.AccessibilityEvent e) {}
    @Override public void onInterrupt() {}

    public static boolean isEnabled(Context c){
        String enabled=android.provider.Settings.Secure.getString(
                c.getContentResolver(),
                android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return enabled!=null &&
                enabled.contains(c.getPackageName()+"/"+RingGestureAccessibilityService.class.getName());
    }
}
