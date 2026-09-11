# Facturtaxi — app nativa Android (React Native)

App Android nativa (sin WebView) para Facturtaxi, construida con React Native. Comparte el mismo
backend Supabase que la web (`../supabase/migrations`).

## Por qué React Native y no Kotlin/Flutter

Se eligió React Native para poder reaprovechar, casi sin cambios, la generación de PDF (`pdf-lib`)
y la firma con certificado digital PAdES (`@signpdf/signpdf` + `@signpdf/signer-p12` +
`node-forge`) que ya están probadas en la web — reescribir esa lógica criptográfica en Kotlin o
Dart era el mayor riesgo técnico del proyecto. Sigue siendo una app instalada de verdad, sin
WebView, con navegación y componentes nativos.

## Alcance actual (MVP)

Implementado: login (email/contraseña), pantalla de cuenta pendiente de aprobación, Nueva factura
(cliente existente o nuevo, servicio estructurado, firma opcional con certificado, generación y
subida del PDF), Historial (listar, compartir el PDF vía el panel nativo del sistema).

Todavía NO implementado (ver plan original si hace falta retomarlo): página de Clientes dedicada,
Plantilla (edición de logo/sello/firma/estilo — usa lo que ya haya en la cuenta, configurado desde
la web), modo demo, importar ticket compartido desde otra app, facturas rectificativas, certificado
guardado en la cuenta (se pide el .p12 cada vez).

## Desarrollo

Necesitas, además de Node 22+:

- **JDK 21** (imprescindible, JDK 17 no sirve).
- **Android SDK** (cmdline-tools + `platform-tools`, `platforms;android-34`, `build-tools;34.0.0`).
- `android/local.properties` con `sdk.dir=<TU_SDK>` (no se commitea, está en `.gitignore`).
- `.env` en esta carpeta con `SUPABASE_URL` y `SUPABASE_ANON_KEY` (no se commitea).

```bash
npm install
cd android && JAVA_HOME=<TU_JDK_21> ./gradlew assembleDebug
# APK en android/app/build/outputs/apk/debug/app-debug.apk
```

`applicationId`: `com.facturtaxi.app` (el mismo que usaba el APK antiguo con Capacitor — si ese
APK sigue instalado en el móvil de pruebas, hay que desinstalarlo antes de instalar este, porque
las firmas de depuración no coinciden).

## Estructura

- `src/lib/` — cliente Supabase, lógica de negocio (clientes, facturas, PDF, firma) — portada
  desde `../src/lib/` de la web, mismo comportamiento.
- `src/context/` — Auth/Profile (equivalentes a los de la web).
- `src/screens/` — pantallas (Login, PendingApproval, NewInvoice, InvoiceHistory).
- `App.tsx` — navegación (`@react-navigation`, bottom tabs).

## Publicar en Google Play (pendiente, fase futura)

El objetivo final es publicarla en Google Play. Para eso falta (no confirmado como tarea activa
todavía): cuenta de Google Play Developer (25$ de tasa única, la debe crear y pagar el propio
usuario), clave de firma de release, ficha de la tienda, política de privacidad.
