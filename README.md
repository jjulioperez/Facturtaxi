# 🚕 Facturtaxi

Aplicación web para taxistas: genera facturas al vuelo rellenando los datos del cliente, con
plantilla de PDF editable (logo, sello, firma manual o firma con certificado digital), numeración
correlativa e historial de facturas descargables.

## Stack

- React + TypeScript + Vite + Tailwind CSS
- [Supabase](https://supabase.com) (Postgres + Auth + Storage) como backend
- Generación de PDF 100% en el navegador con `pdf-lib`
- Firma digital (PAdES) con certificado `.p12`/`.pfx` también en el navegador (`@signpdf` + `node-forge`)
- Despliegue automático a GitHub Pages con GitHub Actions

## 1. Crear el proyecto en Supabase (gratis)

1. Ve a [app.supabase.com](https://app.supabase.com) y crea un proyecto nuevo (plan Free).
2. En **SQL Editor**, pega y ejecuta el contenido de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   Esto crea las tablas, las políticas de seguridad (RLS), la función de numeración correlativa y
   los buckets de almacenamiento (`branding`, `invoices`).
3. Ejecuta también [`supabase/migrations/0002_approval_gate.sql`](supabase/migrations/0002_approval_gate.sql)
   (añade la aprobación manual de cuentas nuevas, ver sección 6 más abajo).
4. En **Project Settings → API Keys**, copia la `Project URL` y la clave **Publishable** (`anon`/`publishable`).

## 2. Configurar el login con GitHub (opcional pero recomendado)

1. En GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - *Homepage URL*: la URL de tu GitHub Pages, p.ej. `https://TU-USUARIO.github.io/Facturtaxi/`
   - *Authorization callback URL*: la que te indique Supabase en el paso siguiente
     (normalmente `https://TU-PROYECTO.supabase.co/auth/v1/callback`)
2. Copia el `Client ID` y genera un `Client Secret`.
3. En Supabase: **Authentication → Providers → GitHub**, actívalo y pega ambos valores.

Si prefieres no usar GitHub, la app también permite login con email/contraseña.

## 3. Desarrollo local

```bash
cp .env.example .env
# edita .env con tu VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## 4. Desplegar en GitHub Pages

1. Sube este proyecto a un repositorio de GitHub llamado `Facturtaxi` (si le pones otro nombre,
   cambia `BASE_PATH` en [`vite.config.ts`](vite.config.ts)).
2. En **Settings → Pages**, en "Build and deployment" elige **GitHub Actions** como fuente.
3. En **Settings → Secrets and variables → Actions**, añade dos secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Haz `git push` a `main`: el workflow [`deploy.yml`](.github/workflows/deploy.yml) compila y
   publica la app automáticamente. La `anon key` es segura de exponer: la protección real de los
   datos la da Row Level Security en Supabase.

## 5. Primeros pasos en la app

1. Inicia sesión (GitHub o email).
2. Ve a **Plantilla** y rellena tus datos fiscales, sube tu logo, sello y/o firma manual, elige
   color y estilo, y guarda.
3. Ve a **Nueva factura**, rellena los datos del cliente (o elige uno existente) y el servicio.
   Si quieres firmarla con tu certificado digital, marca la casilla correspondiente y sube tu
   `.p12`/`.pfx` con su contraseña en el paso siguiente (no se guardan en ningún sitio).
4. Descarga el PDF generado. En **Historial** puedes volver a descargar cualquier factura anterior,
   ordenadas por número correlativo.

## 6. Aprobar cuentas nuevas (tú eres el administrador)

Cualquiera puede registrarse (email o GitHub), pero una cuenta nueva **no puede entrar** hasta que
tú la apruebes: verá la pantalla "Cuenta pendiente de aprobación". Para aprobar a alguien:

1. En Supabase, ve a **Table Editor → profiles**.
2. Busca la fila con su email, y cambia la columna `approved` a `true`
   (o ejecuta en el **SQL Editor**: `update public.profiles set approved = true where email = '...';`).

La primera vez que ejecutas `0002_approval_gate.sql`, tu propia cuenta (y cualquiera que ya
existiera) se aprueba automáticamente para no dejarte fuera.

## 7. Generar la app de Android (APK nativo)

La carpeta `android/` (creada con [Capacitor](https://capacitorjs.com)) envuelve la misma web app
en una app Android nativa instalable.

Necesitas, además de Node:

- **JDK 21** (p.ej. [Temurin 21](https://adoptium.net/temurin/releases/?version=21))
- **Android SDK** (basta con las *command line tools*, no hace falta Android Studio completo):
  descarga `commandlinetools-mac-*_latest.zip` desde la
  [web de Android Studio](https://developer.android.com/studio#command-line-tools-only),
  descomprímelo, y coloca su contenido en `<sdk>/cmdline-tools/latest/`.
  Luego instala los paquetes necesarios:
  ```bash
  ./sdkmanager --sdk_root=<TU_SDK> "platform-tools" "platforms;android-34" "build-tools;34.0.0"
  ```
- Crea `android/local.properties` con: `sdk.dir=<TU_SDK>`

Con eso listo:

```bash
# 1. Compila la web app para Android y sincroniza los assets nativos
npm run build:apk

# 2. Compila el APK (queda en android/app/build/outputs/apk/debug/app-debug.apk)
cd android
JAVA_HOME=<TU_JDK_21> ./gradlew assembleDebug
```

El APK de depuración ya está firmado (con una clave de depuración automática) y se puede instalar
directamente en un móvil Android activando "Instalar apps de orígenes desconocidos". Para publicarla
en Google Play necesitarías además generar una clave de firma de release
([guía oficial](https://developer.android.com/studio/publish/app-signing)).

## Notas legales

- La numeración es correlativa por serie (por defecto, el año) y sin huecos, gestionada de forma
  atómica en la base de datos.
- La firma con certificado implementa PAdES básico (firma + cadena de certificados embebida). No
  incluye sellado de tiempo/OCSP (PAdES-LTA); si necesitas validez a largo plazo, puede añadirse
  más adelante.
- Revisa con tu asesoría/gestoría que los campos de la factura (IVA, datos fiscales, numeración)
  cumplen tus obligaciones fiscales concretas.
