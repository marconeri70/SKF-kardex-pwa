package it.marconeri.heartmonitorhid;

import android.accessibilityservice.AccessibilityService;
import android.content.*;
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
        String device="Sconosciuto";
        InputDevice d=InputDevice.getDevice(event.getDeviceId());
        if(d!=null && d.getName()!=null) device=d.getName();

        prefs.edit().putString("last_device",device).putInt("last_key",key)
                .putInt("last_scan",scan).putLong("last_time",System.currentTimeMillis()).apply();

        String signature=signature(key,scan,device);
        if(prefs.getBoolean("capture_armed",false)){
            String action=prefs.getString("capture_action","Scorri giù");
            prefs.edit().putString("map_"+signature,action).putBoolean("capture_armed",false).apply();
            sendBroadcast(new Intent(ACTION_EVENT).setPackage(getPackageName()));
            vibrate();
            return true;
        }

        String action=prefs.getString("map_"+signature,null);
        if(action==null){
            // fallback: some HID stacks change scanCode but keep keyCode stable
            for(Map.Entry<String,?> e:prefs.getAll().entrySet()){
                if(e.getKey().startsWith("map_k"+key+"_")) { action=String.valueOf(e.getValue()); break; }
            }
        }
        sendBroadcast(new Intent(ACTION_EVENT).setPackage(getPackageName()));
        if(action!=null){ runAction(action); return true; }
        return false;
    }

    private String signature(int key,int scan,String dev){
        return "k"+key+"_s"+scan+"_d"+Math.abs(dev.hashCode());
    }

    private void runAction(String a){
        switch(a){
            case "Scorri giù": scroll(true); break;
            case "Scorri su": scroll(false); break;
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
                try { Intent i=new Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); } catch(Exception ignored){}
                break;
            case "Apri Heart Monitor":
                Intent launch=getPackageManager().getLaunchIntentForPackage(getPackageName());
                if(launch!=null){ launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(launch); }
                break;
        }
        vibrate();
    }

    private void volume(boolean up){
        AudioManager am=(AudioManager)getSystemService(AUDIO_SERVICE);
        am.adjustStreamVolume(AudioManager.STREAM_MUSIC, up?AudioManager.ADJUST_RAISE:AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI);
    }

    private void media(int code){
        AudioManager am=(AudioManager)getSystemService(AUDIO_SERVICE);
        long now=SystemClock.uptimeMillis();
        am.dispatchMediaKeyEvent(new KeyEvent(now,now,KeyEvent.ACTION_DOWN,code,0));
        am.dispatchMediaKeyEvent(new KeyEvent(now,now,KeyEvent.ACTION_UP,code,0));
    }

    private void scroll(boolean down){
        AccessibilityNodeInfo root=getRootInActiveWindow();
        if(root==null) return;
        int action=down?AccessibilityNodeInfo.ACTION_SCROLL_FORWARD:AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD;
        Deque<AccessibilityNodeInfo> q=new ArrayDeque<>(); q.add(root);
        while(!q.isEmpty()){
            AccessibilityNodeInfo n=q.removeFirst();
            if(n.getActionList().stream().anyMatch(x -> x.getId()==action)){ n.performAction(action); return; }
            for(int i=0;i<n.getChildCount();i++){ AccessibilityNodeInfo c=n.getChild(i); if(c!=null) q.add(c); }
        }
    }

    private void vibrate(){
        Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE);
        if(v==null) return;
        if(Build.VERSION.SDK_INT>=26) v.vibrate(VibrationEffect.createOneShot(45,VibrationEffect.DEFAULT_AMPLITUDE));
        else v.vibrate(45);
    }

    @Override public void onAccessibilityEvent(android.view.accessibility.AccessibilityEvent e) {}
    @Override public void onInterrupt() {}

    public static boolean isEnabled(Context c){
        String enabled=android.provider.Settings.Secure.getString(c.getContentResolver(), android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return enabled!=null && enabled.contains(c.getPackageName()+"/"+RingGestureAccessibilityService.class.getName());
    }
}
