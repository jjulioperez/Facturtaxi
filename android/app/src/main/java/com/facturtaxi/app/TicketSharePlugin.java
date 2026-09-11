package com.facturtaxi.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Expone a la web el texto de un ticket que otra app (p.ej. el taxímetro)
 * haya compartido con Facturtaxi vía el menú "Compartir" de Android. Ver
 * MainActivity para cómo se captura ese texto desde el Intent.
 */
@CapacitorPlugin(name = "TicketShare")
public class TicketSharePlugin extends Plugin {

    @PluginMethod
    public void getPendingSharedText(PluginCall call) {
        String text = MainActivity.consumePendingSharedText();
        JSObject ret = new JSObject();
        ret.put("text", text);
        call.resolve(ret);
    }
}
