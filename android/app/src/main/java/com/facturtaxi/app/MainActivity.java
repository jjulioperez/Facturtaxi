package com.facturtaxi.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // A partir de Android 15 el sistema obliga a dibujar el contenido "borde
    // a borde" (bajo la barra de estado y la de navegación). La web no tiene
    // preparado ese espacio (safe-area), así que volvemos al comportamiento
    // clásico: cada barra del sistema reserva su propio espacio y el
    // contenido nunca queda tapado debajo.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
  }
}
