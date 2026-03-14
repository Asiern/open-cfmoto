# CFMoto Cloud API — Certificate Pinning & Interception Analysis

> **Fuente**: análisis estático de `com.cfmoto.cfmotointernational` (jadx).
> Directorio: `tools/apk-analysis/jadx-output/sources/`

---

## Certificate Pinning

**¿Existe? ❌ — No hay certificate pinning de ningún tipo.**

El APK implementa lo contrario: **deshabilita completamente la validación SSL**.

### SSLSocketClient — TrustManager vacío

`com/bat/lib/net/SSLSocketClient.java`

```java
// Acepta CUALQUIER certificado — checkServerTrusted no hace nada
private static TrustManager[] getTrustManager() {
    return new TrustManager[]{new X509TrustManager() {
        public void checkClientTrusted(X509Certificate[] chain, String authType) {}
        public void checkServerTrusted(X509Certificate[] chain, String authType) {}
        public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
    }};
}

// Hostname verification desactivada
public static HostnameVerifier getHostnameVerifier() {
    return (hostname, session) -> true;  // siempre true
}
```

### OkHttp — sin CertificatePinner

`com/bat/lib/net/NetWorkManager.java`:

```java
new OkHttpClient.Builder()
    // ...interceptors...
    .hostnameVerifier(SSLSocketClient.getHostnameVerifier())  // bypass
    // SIN .certificatePinner(...)
    .build();
```

### Network Security Config

`res/xml/network_security_config.xml`:

```xml
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system"/>
            <certificates src="user"/>   <!-- acepta CAs de usuario -->
        </trust-anchors>
    </base-config>
</network-security-config>
```

### Resumen de pinning

| Mecanismo | Estado |
|-----------|--------|
| OkHttp `CertificatePinner` | ❌ No presente |
| `X509TrustManager` custom (bypass) | ✅ Presente — acepta todo |
| `HostnameVerifier` (bypass) | ✅ Siempre `true` |
| Network Security Config | Permite cleartext + CAs de usuario |
| TrustKit / conscrypt custom | ❌ No presente |

**Bypasseable sin Frida (via cert de usuario en Android < 14): ✅ — trivialmente.**
De hecho, ni siquiera hace falta instalar el CA en el sistema. El NSC ya confía en CAs de usuario,
y el TrustManager custom ignora todo de todas formas.

---

## Endpoints Cloud

### URLs base

`com/cfmoto/cfmotointernational/common/AppConfig.java`:

| Entorno | URL |
|---------|-----|
| Producción | `https://tapi.cfmoto-oversea.com/v1.0/` |
| Dev/test | `http://ttapi.cfmoto-oversea.com:8700/v1.0/` |
| MQTT (prod) | `ssl://mqtts.cfmoto-oversea.com:8883` |
| OSS (Aliyun) | `https://cfmoto.oss-cn-hangzhou.aliyuncs.com/` |

> La URL base real se determina dinámicamente por región (`LoginCountry.getDomain()`).
> El fallback es el dominio de producción.

### UserService — Autenticación y cuenta

Base: `fuel-user/serveruser/`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `app/auth/user/login` | — | **Login** → devuelve Bearer token |
| POST | `common/code/send_code_v2` | — | Enviar código SMS/email |
| POST | `common/code/check_code` | — | Verificar código |
| POST | `app/auth/user/registe` | — | Registro de usuario |
| PUT | `app/auth/user/setPsw` | Bearer | Establecer contraseña |
| PUT | `app/auth/user/updatePsw` | Bearer | Cambiar contraseña |
| GET | `app/auth/user/getUserInfo` | Bearer | Info de usuario |
| POST | `app/auth/user/updateUserInfo` | Bearer | Actualizar perfil |
| PUT | `app/auth/user/cancelUser` | Bearer | Eliminar cuenta |
| GET | `app/dealer/store/country` | — | Lista de países/regiones |

### VehicleService — Vehículo y telemetría BLE

Base: `fuel-vehicle/servervehicle/`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `app/vehicle/{vehicleId}` | Bearer | **Detalles vehículo** → `VehicleNowInfoResp` (contiene claves BLE) |
| POST | `app/vehicle/bind-v3` | Bearer | Vincular vehículo (primera vez) |
| GET | `app/vehicle/charge/detail/{vehicleId}` | Bearer | Estado de carga |
| POST | `app/charging/createScheduleCharging` | Bearer | Programar carga |
| GET | `app/ridehistory` | Bearer | Historial de rutas |
| GET | `app/ridehistory/{id}` | Bearer | Detalle de ruta |
| GET | `app/vehicle/update/list` | Bearer | Actualizaciones OTA disponibles |
| POST | `app/vehicle/update/execute` | Bearer | Ejecutar OTA |
| POST | `app/electricFence` | Bearer | Crear geocerca |
| PUT | `app/electricFence/{id}` | Bearer | Actualizar geocerca |
| DELETE | `app/electricFence/{id}` | Bearer | Eliminar geocerca |
| POST | `app/navigation/address` | Bearer | Guardar dirección favorita |
| POST | `app/v2/sim/recharge/flypay` | Bearer + Sign | Recargar SIM (firmado) |

### Endpoint crítico: claves BLE

```
GET https://tapi.cfmoto-oversea.com/v1.0/fuel-vehicle/servervehicle/app/vehicle/{vehicleId}
```

La respuesta (`VehicleNowInfoResp`) incluye el campo `vehicleInfo.encryptInfo`:

```json
{
  "vehicleInfo": {
    "encryptInfo": {
      "encryptValue": "<hex — AuthPackage cifrado enviado al TBox>",
      "key":          "<clave AES-256 para descifrar el challenge del TBox>",
      "iv":           "<IV para AES-CBC si aplica>"
    },
    "btMac": "XX:XX:XX:XX:XX:XX"
  }
}
```

Estas son exactamente las claves que el protocolo BLE necesita para la autenticación (control codes 0x5A–0x5D).
`encryptValue` → enviado al TBox como `Meter.AuthPackage` (0x5A).
`key` → usado para descifrar el random challenge del TBox (0x5B) con AES-256/ECB/PKCS7.

---

## Cliente HTTP — Análisis

### Stack

- **Retrofit 2** sobre **OkHttp 3**
- Convertidores: Gson (custom factory), RxJava2, LiveData
- Dos clientes OkHttp: normal (`mOkHttpClient`) y firmado (`mOkHttpClientSign`)
- Todos los `ApiService` se crean con el cliente firmado

### Headers en todos los requests

`TokenInterceptor` + `RequestSignInterceptor` añaden:

| Header | Valor | Fuente |
|--------|-------|--------|
| `Authorization` | `Bearer <token>` (o `cfmoto_virtual_vehicle_token` si no hay sesión) | MMKV storage |
| `user_id` | ID numérico del usuario | MMKV storage |
| `lang` | `en_US`, `es_ES`, etc. | Locale del sistema |
| `ZoneId` | `Europe/Madrid`, etc. | TimeZone.getDefault() |
| `User-Agent` | `CFMoto/2.2.5 Android/...` | UserAgentUtil |
| `download_id` | `Android<userId><installTimestamp>` | Fingerprint de instalación |
| `appId` | `rRrIs3ID` | Hardcodeado |
| `nonce` | 16 chars random (SecureRandom) | Generado por request |
| `timestamp` | ms desde epoch | System.currentTimeMillis() |
| `signature` | ver abajo | Calculado |
| `Cfmoto-X-Param` | `appId=rRrIs3ID&nonce=X&timestamp=Y` | Calculado |
| `Cfmoto-X-Sign` | igual que `signature` | Calculado |
| `Cfmoto-X-Sign-Type` | `0` | Constante |

### Algoritmo de firma (HMAC-like)

`com/bat/lib/net/RequestSignInterceptor.java` + `SignatureUtils.java`:

```
payload    = <request body como string, o vacío si GET>
params_str = "appId=rRrIs3ID&nonce=<random16>&timestamp=<ms>"
input      = payload + params_str + APPSECRET

signature  = MD5( SHA1( input ) )
```

**Credenciales hardcodeadas** (`SignatureUtils.java`):
```java
public static String APPID    = "rRrIs3ID";
public static String APPSECRET = "6c1936f85ecb23508c02ceb7a6e3fd0e33eb8bd2";
```

Estas credenciales son públicas (extraídas del APK). Cualquiera puede generar firmas válidas.

### Sin fingerprint de dispositivo adicional

No hay IMEI, Android ID ni attestation verificada en el servidor.
El `download_id` (`Android<userId><installTime>`) es rastreable pero no imposible de replicar.

---

## Estrategia recomendada

### Recomendación: **Opción A — MitM directo con mitmproxy**

No hay certificate pinning. El TrustManager custom acepta cualquier certificado. El NSC confía en CAs de usuario. El proxy no necesita ni Frida ni patch del APK.

```
Android (CFMoto app)
        ↓ WiFi
[mitmproxy en PC / laptop]
        ↓
 tapi.cfmoto-oversea.com
```

---

## Pasos exactos para interceptar

### Requisitos

- PC con Python instalado (mitmproxy `pip install mitmproxy`)
- Dispositivo Android físico en la misma red WiFi
- Cuenta CFMoto activa y vehículo vinculado

### Paso 1 — Instalar mitmproxy

```bash
pip install mitmproxy
mitmproxy --version  # verificar
```

### Paso 2 — Arrancar el proxy

```bash
mitmweb --listen-port 8080 --web-port 8081
# o en modo CLI:
mitmproxy --listen-port 8080
```

mitmweb abre `http://127.0.0.1:8081` con UI web para inspeccionar tráfico.

### Paso 3 — Configurar proxy en Android

1. Ajustes → WiFi → mantener pulsada tu red → Modificar red
2. Opciones avanzadas → Proxy → Manual
3. Host: `<IP del PC>` (ej. `192.168.1.100`)
4. Puerto: `8080`

### Paso 4 — Instalar el CA de mitmproxy (solo necesario en Android 7-13)

> En teoría el TrustManager custom ya ignora el CA, pero instalarlo es buena práctica
> y garantiza que otras librerías del APK también confíen en él.

```bash
# En el PC, generar/obtener el cert:
curl -o mitmproxy-ca.pem http://mitm.it/cert/pem  # con proxy configurado en el browser
# O directamente desde ~/.mitmproxy/mitmproxy-ca-cert.pem
```

En Android:
1. Ajustes → Seguridad → Credenciales → Instalar certificado → CA Certificate
2. Seleccionar `mitmproxy-ca-cert.pem`

> **Android 14+**: Los CAs de usuario ya no se confían para apps que tienen `targetSdk >= 24`.
> Pero como `SSLSocketClient` tiene el TrustManager vacío, el CA ni siquiera se comprueba.
> El MitM funciona igual en Android 14.

### Paso 5 — Capturar el login y las claves BLE

1. Abrir la app CFMoto en el dispositivo
2. Iniciar sesión (si no hay sesión activa)
3. En mitmweb, buscar la request:
   ```
   POST /v1.0/fuel-user/serveruser/app/auth/user/login
   ```
   La respuesta contiene el Bearer token en el campo `data.token`.

4. Navegar a la pantalla de la moto. Buscar:
   ```
   GET /v1.0/fuel-vehicle/servervehicle/app/vehicle/<vehicleId>
   ```
   La respuesta JSON contiene:
   ```json
   {
     "data": {
       "vehicleInfo": {
         "encryptInfo": {
           "encryptValue": "...",
           "key": "...",
           "iv": "..."
         },
         "btMac": "XX:XX:XX:XX:XX:XX"
       }
     }
   }
   ```
   **Estos son los valores que van a `packages/ble-protocol/src/auth.ts`.**

### Paso 6 — Guardar las claves y reproducir con curl

```bash
# Ejemplo de request autenticado con las credenciales capturadas:
curl -X GET "https://tapi.cfmoto-oversea.com/v1.0/fuel-vehicle/servervehicle/app/vehicle/<vehicleId>" \
  -H "Authorization: Bearer <token_capturado>" \
  -H "user_id: <userId>" \
  -H "appId: rRrIs3ID" \
  -H "nonce: abcDEF123456gh78" \
  -H "timestamp: $(date +%s)000" \
  -H "signature: <calculada>" \
  -H "Cfmoto-X-Sign-Type: 0" \
  -H "lang: en_US" \
  --proxy http://127.0.0.1:8080
```

Para calcular la firma en Python:
```python
import hashlib, time, random, string

APPID = "rRrIs3ID"
APPSECRET = "6c1936f85ecb23508c02ceb7a6e3fd0e33eb8bd2"

def make_nonce(n=16):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=n))

def sign(body: str = "") -> dict:
    nonce = make_nonce()
    ts = str(int(time.time() * 1000))
    params = f"appId={APPID}&nonce={nonce}&timestamp={ts}"
    raw = body + params + APPSECRET
    sig = hashlib.md5(hashlib.sha1(raw.encode()).hexdigest().encode()).hexdigest()
    return {
        "appId": APPID,
        "nonce": nonce,
        "timestamp": ts,
        "signature": sig,
        "Cfmoto-X-Param": params,
        "Cfmoto-X-Sign": sig,
        "Cfmoto-X-Sign-Type": "0",
    }
```

### Paso 7 — Quitar el proxy

Cuando termines, en Android:
- Ajustes → WiFi → red → Modificar → Proxy → Ninguno

---

## Notas adicionales

- **MQTT** (`mqtts.cfmoto-oversea.com:8883`): El broker MQTT usa SSL pero tampoco hay pinning.
  Se puede interceptar con un proxy MQTT (ej. Mosquitto en modo bridge) o con mitmproxy en modo TCP.
  El protocolo MQTT no es necesario para el flujo BLE principal.

- **Aliyun OSS**: usado para upload de fotos de perfil. No relevante para BLE.

- **Token TTL**: desconocido, pero el interceptor gestiona 401 → `loginExpired()` automáticamente.
  Probablemente sea un JWT — se puede decodificar con `jwt.io` para ver la expiración.

- **`cfmoto_virtual_vehicle_token`**: token hardcodeado usado antes del login.
  Podría dar acceso a endpoints públicos sin autenticación.
