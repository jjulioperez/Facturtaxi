package com.facturtaxi.app;

import android.content.Intent;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private static String pendingSharedText;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(TicketSharePlugin.class);
    super.onCreate(savedInstanceState);
    // A partir de Android 15 el sistema obliga a dibujar el contenido "borde
    // a borde" (bajo la barra de estado y la de navegación). La web no tiene
    // preparado ese espacio (safe-area), así que volvemos al comportamiento
    // clásico: cada barra del sistema reserva su propio espacio y el
    // contenido nunca queda tapado debajo.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    captureShareIntent(getIntent());
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    // launchMode="singleTask": si la app ya estaba abierta cuando el
    // taxista comparte un ticket desde otra app, Android reutiliza esta
    // misma Activity y entrega el nuevo Intent aquí en vez de en onCreate.
    captureShareIntent(intent);
  }

  private void captureShareIntent(Intent intent) {
    if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
      String text = intent.getStringExtra(Intent.EXTRA_TEXT);
      if (text != null && !text.isEmpty()) {
        pendingSharedText = text;
      }
    }
  }

  /** Devuelve el texto compartido pendiente (si hay) y lo olvida, para no reprocesarlo dos veces. */
  static synchronized String consumePendingSharedText() {
    String text = pendingSharedText;
    pendingSharedText = null;
    return text;
  }
}
