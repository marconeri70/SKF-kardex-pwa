package it.marconeri.heartmonitorhid;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.*;
import android.graphics.Path;
import android.media.AudioManager;
import android.os.*;
import android.provider.MediaStore;
import android.view.*;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.*;

public class RingGestureAccessibilityService extends AccessibilityService {
    public static final String ACTION_EVENT="it.marconeri.heartmonitorhid.HID_EVENT";
    private SharedPreferences prefs;

    @Override public void onServiceConnected() {
        prefs=getSharedPreferences("ringhid",MODE_PRIVATE);
    }

    @Override protected boolean onKeyEvent(KeyEvent event) {
        if(event.getAction()!=KeyEvent.ACTION_DOWN) return false;
        if(prefs==null) prefs=getSharedPreferences("ringhid",MODE_PRIVATE);

        int key=event.getKeyCode(), scan=event.getScanCode();
        String keyName=KeyEvent.keyCodeToString(key);
        String device="Sconosciuto";
        boolean external=false;
        InputDevice d=InputDevice.getDevice(event.getDeviceId());
        if(d!=null){
            if(d.getName()!=null) device=d.getName();
            external=d.isExternal();
        }

        // Ignore phone hardware keys such as gpio-keys.
        if(!external){
            prefs.edit()
                .putString("ignored_device",device)
                .putInt("ignored_key",key)
                .putInt("ignored_scan",scan)
                .putLong("ignored_time",System.currentTimeMillis())
                .apply();
            sendBroadcast(new Intent(ACTION_EVENT).setPackage(getPackageName()));
            return false;
        }

        String signature=signature(key,scan,device);
        prefs.edit()
            .putString("last_device",device)
            .putInt("last_key",key)
            .putString("last_key_name",keyName)
            .putInt("last_scan",scan)
            .putLong("last_time",System.currentTimeMillis())
            .putString("last_signature",signature)
            .apply();

        if(prefs.getBoolean("capture_armed",false)){
            String slot=prefs.getString("capture_slot","Su");
            String action=prefs.getString("capture_action","Scorri su");

            // If this HID signature is already used by another gesture slot,
            // do not silently overwrite it: the ring would be indistinguishable.
            String existingSlot=prefs.getString("sig_slot_"+signature,null);
            if(existingSlot!=null && !existingSlot.equals(slot)){
                prefs.edit()
                    .putBoolean("capture_armed",false)
                    .putString("capture_error","Il gesto «"+slot+"» invia lo stesso comando HID di «"+existingSlot+"». Il firmware non permette di distinguerli in modalità HID.")
                    .apply();
                sendBroadcast(new Intent(ACTION_EVENT).setPackage(getPackageName()));
                vibratePattern(false);
                return true;
            }

            // Re-registering a slot replaces only that slot's old signature.
            String oldSig=prefs.getString("slot_sig_"+slot,null);
            SharedPreferences.Editor ed=prefs.edit();
            if(oldSig!=null && !oldSig.equals(signature)){
                ed.remove("map_"+oldSig);
                ed.remove("sig_slot_"+oldSig);
                ed.remove("label_"+oldSig);
            }

            String label=device+" · "+keyName+" ("+key+") · Scan "+scan;
            ed.putString("slot_sig_"+slot,signature)
              .putString("sig_slot_"+signature,slot)
              .putString("map_"+signature,action)
              .putString("label_"+signature,label)
              .putBoolean("capture_armed",false)
              .remove("capture_error")
              .apply();

            sendBroadcast(new Intent(ACTION_EVENT).setPackage(getPackageName()));
            vibratePattern(true);
            return true;
        }

        String action=prefs.getString("map_"+signature,null);
        sendBroadcast(new Intent(ACTION_EVENT).setPackage(getPackageName()));
        if(action!=null){
            runAction(action);
            return true;
        }
        return false;
    }

    private String signature(int key,int scan,String dev){
        return "k"+key+"_s"+scan+"_d"+Math.abs(dev.hashCode());
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
        vibratePattern(true);
    }

    private void swipe(int dx,int dy){
        android.util.DisplayMetrics dm=getResources().getDisplayMetrics();
        float cx=dm.widthPixels/2f, cy=dm.heightPixels/2f;
        float spanX=dm.widthPixels*0.30f, spanY=dm.heightPixels*0.25f;

        // Finger movement is opposite to content direction.
        float sx=cx, sy=cy, ex=cx, ey=cy;
        if(dx<0){ sx=cx+spanX; ex=cx-spanX; }
        if(dx>0){ sx=cx-spanX; ex=cx+spanX; }
        if(dy<0){ sy=cy+spanY; ey=cy-spanY; }
        if(dy>0){ sy=cy-spanY; ey=cy+spanY; }

        Path p=new Path();
        p.moveTo(sx,sy);
        p.lineTo(ex,ey);
        GestureDescription.StrokeDescription stroke=
                new GestureDescription.StrokeDescription(p,0,280);
        GestureDescription.Builder b=new GestureDescription.Builder();
        b.addStroke(stroke);
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

    private void vibratePattern(boolean ok){
        Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE);
        if(v==null) return;
        if(Build.VERSION.SDK_INT>=26){
            if(ok) v.vibrate(VibrationEffect.createOneShot(45,VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(VibrationEffect.createWaveform(new long[]{0,80,60,80},-1));
        }else{
            if(ok) v.vibrate(45);
            else v.vibrate(new long[]{0,80,60,80},-1);
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
