# CFMoto Cloud API — Certificate Pinning & Interception Analysis

> **Fuente**: análisis estático de `com.cfmoto.cfmotointernational` (jadx).
> Directorio: `tools/apk-analysis/jadx-output/sources/`
> Validación dinámica adicional: export Burp `tools/apk-analysis/mitm-logs/full-history` (2026-03-14).

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

## Hallazgos dinámicos confirmados (2026-03-14)

Captura: `tools/apk-analysis/mitm-logs/full-history` — 98 items, 3 hosts.

### Login — request y response completos

```http
POST /v1.0/fuel-user/serveruser/app/auth/user/login_by_idcard
Host: tapi-flkf.cfmoto-oversea.com
Authorization: Bearer cfmoto_virtual_vehicle_token
Cfmoto-X-Sign: <32-hex>
Cfmoto-X-Param: appId=rRrIs3ID&nonce=A5X2k0SV2j3GFY71&timestamp=1773508178729
Cfmoto-X-Sign-Type: 0
appId: rRrIs3ID
nonce: A5X2k0SV2j3GFY71
signature: <32-hex>
timestamp: 1773508178729
user_id:
lang: en_US
ZoneId: Europe/Madrid
User-Agent: MOBILE|Android|35|CFMOTO_INTERNATIONAL_APP|2.2.5|Dalvik/2.1.0 (Linux; U; Android 15; sdk_gphone64_x86_64 Build/BE31.1-preview4)|1080x2400|<deviceId>|WIFI|Android
Content-Type: application/json; charset=UTF-8

{
  "idcardType": "email",
  "idcard": "<email>",
  "password": "<md5-32-hex>",
  "areaNo": "ES",
  "thirdpartyId": "",
  "thirdpartyType": "",
  "areaCode": "",
  "emailMarketingAlarm": false,
  "verifyCode": ""
}
```

Response:
```json
{
  "code": "0",
  "msg": "success",
  "data": {
    "userId": "<userId>",
    "email": "<email>",
    "nickName": "<nick>",
    "areaNo": "ES",
    "region": "eu-central-1",
    "tokenInfo": {
      "accessToken": "<uuid>",
      "tokenType": "bearer",
      "refreshToken": "<uuid>",
      "scope": "all read write app",
      "expiresIn": 8639999
    },
    "googleMapEnable": false
  },
  "success": true
}
```

**Confirmaciones clave**:
- `password` = MD5 hex de 32 chars ✅
- Token en `data.tokenInfo.accessToken` (no en `data.token`) ✅
- `refreshToken` presente ✅ — TTL confirmado: **8.639.999 s ≈ 100 días**
- `nonce` observado: **16 chars alfanuméricos** ✅ (ej. `A5X2k0SV2j3GFY71`)
- Signing `Cfmoto-X-Sign` de 32 hex en todos los requests ✅
- Host regional observado: `tapi-flkf.cfmoto-oversea.com` (distinto al fallback `tapi.cfmoto-oversea.com`)

### Vehicle list — vehicleId=-1 (vehículo virtual)

`GET /vehicle/mine?position=1` devuelve `virtualFlag: "1"` y `vehicleId: "-1"`.
La cuenta de captura tiene únicamente el vehículo demo — por eso **`encryptInfo` llega vacío**.
Para obtener `encryptValue` + `key` reales hay que capturar con una moto física vinculada.

### User-Agent — formato exacto

```
MOBILE|Android|{sdkInt}|CFMOTO_INTERNATIONAL_APP|{appVersion}|Dalvik/2.1.0 (Linux; U; Android {version}; {model} Build/{buildId})|{widthxheight}|{deviceId}|{network}|Android
```

Ejemplo real: `MOBILE|Android|35|CFMOTO_INTERNATIONAL_APP|2.2.5|Dalvik/2.1.0 (Linux; U; Android 15; sdk_gphone64_x86_64 Build/BE31.1-preview4)|1080x2400|<deviceId>|WIFI|Android`

Mismo valor en `X-App-Info` y `User-Agent`.

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

Fuente: análisis estático (`UserService.java`) + captura dinámica. ✅ = observado en captura.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `app/auth/user/login_by_idcard` | — | **Login** → Bearer token ✅ |
| GET | `app/auth/user/user_info` | Bearer | Info de usuario ✅ |
| GET | `app/auth/user/getMqttUserInfo?machineCode=` | Bearer | **Credenciales MQTT cifradas** ✅ |
| GET | `app/auth/user/mqtt/log/upload/info` | Bearer | Config log MQTT ✅ |
| POST | `app/auth/user/user_machine_code` | Bearer | Registrar machine code del dispositivo ✅ |
| POST | `app/auth/user/user_device_id` | Bearer | Registrar Firebase push token ✅ |
| POST | `app/auth/user/createEndpoint` | Bearer | Endpoint de push notifications ✅ |
| POST | `app/auth/user/change_language` | Bearer | Actualizar idioma ✅ |
| PUT | `app/user/timezone?offset=` | Bearer | Actualizar timezone ✅ |
| POST | `common/code/send_code_v2` | — | Enviar código SMS/email |
| POST | `common/code/check_code` | — | Verificar código |
| POST | `app/auth/user/registe` | — | Registro de usuario |
| PUT | `app/auth/user/setPsw` | Bearer | Establecer contraseña |
| PUT | `app/auth/user/updatePsw` | Bearer | Cambiar contraseña |
| POST | `app/auth/user/updateUserInfo` | Bearer | Actualizar perfil |
| PUT | `app/auth/user/cancelUser` | Bearer | Eliminar cuenta |
| GET | `app/dealer/store/country` | — | Lista de países/regiones |
| GET | `app/launch/advertisement/appLaunchPageAdvertisement/all` | Bearer | Splash ads ✅ |
| GET | `app/popwindow?position=` | Bearer | Pop-ups in-app ✅ |
| GET | `sys/oss/sts` | Bearer | Credenciales OSS (Aliyun) temporales ✅ |
| POST | `app/dbpoint/send` | Bearer | Analytics de eventos app ✅ |

### VehicleService — Vehículo y telemetría BLE

Base: `fuel-vehicle/servervehicle/`

✅ = observado en captura.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `app/vehicle/mine?position=` | Bearer | **Lista de vehículos del usuario** ✅ |
| GET | `app/vehicle?vehicleId=` | Bearer | **Detalles vehículo** → `encryptInfo` (claves BLE) ✅ |
| GET | `app/vehicle-type/show` | Bearer | Tipos de vehículo ✅ |
| GET | `app/vehicle-type/show/suggest` | Bearer | Sugerencias de tipo ✅ |
| GET | `app/vehicle/set/special/function` | Bearer | Funciones especiales del vehículo ✅ |
| GET | `app/vehicle/set/list/compatibility/ele-v2?deviceId=` | Bearer | Settings compatibilidad ✅ |
| GET | `app/vehicle/message/list/unread?deviceId=` | Bearer | Mensajes sin leer ✅ |
| GET | `app/setting` | Bearer | Settings generales ✅ |
| GET | `app/google/map/setting` | Bearer | Config Google Maps ✅ |
| GET | `app/v2/sim/check` | Bearer | Estado SIM ✅ |
| GET | `app/ota/redPointType?deviceId=` | Bearer | OTA pendiente (indicador) ✅ |
| GET | `app/alarm/messagerecord/red/dot` | Bearer | Alertas sin leer ✅ |
| GET | `app/information/type` | Bearer | Tipos de contenido/noticias ✅ |
| GET | `app/information/content?consultTypeId=&pageNum=&pageSize=` | Bearer | Contenido/noticias ✅ |
| GET | `app/privacy/protocol?areaNo=` | Bearer | Privacidad/TOS ✅ |
| GET | `app/privacy/protocol/protocol-info?areaNo=` | Bearer | Info protocolo privacidad ✅ |
| GET | `app/version/version-detail?areaNo=&phoneType=&versionNumber=` | Bearer | Info de versión ✅ |
| POST | `app/vehicle/bind-v3` | Bearer | Vincular vehículo (primera vez) |
| GET | `app/vehicle/charge/detail/{vehicleId}` | Bearer | Estado de carga |
| POST | `app/charging/createScheduleCharging` | Bearer | Programar carga |
| GET | `app/ridehistory/list_v2?vehicleId=&pageStart=&pageSize=` | Bearer | Lista de rutas (paginada) |
| GET | `app/ridehistory?id=<id>&month=<yyyy-MM>` | Bearer | Detalle de ruta (query params, no path) |
| DELETE | `app/ridehistory/{id}` | Bearer | Eliminar ruta |
| GET | `app/vehicle/update/list` | Bearer | Actualizaciones OTA |
| POST | `app/vehicle/update/execute` | Bearer | Ejecutar OTA |
| POST | `app/electricFence` | Bearer | Crear geocerca |
| PUT | `app/electricFence/{id}` | Bearer | Actualizar geocerca |
| DELETE | `app/electricFence/{id}` | Bearer | Eliminar geocerca |
| POST | `app/navigation/address` | Bearer | Guardar dirección favorita |
| POST | `app/v2/sim/recharge/flypay` | Bearer + Sign | Recargar SIM (firmado) |

### Endpoint crítico: claves BLE

```
GET https://tapi.cfmoto-oversea.com/v1.0/fuel-vehicle/servervehicle/app/vehicle?vehicleId=<vehicleId>
```

La respuesta (`VehicleNowInfoResp`) incluye `encryptInfo` en raíz (y en algunos flujos puede verse anidado):

```json
{
  "encryptInfo": {
    "encryptValue": "<hex — AuthPackage cifrado enviado al TBox>",
    "key":          "<clave AES-256 para descifrar el challenge del TBox>",
    "iv":           "<IV para AES-CBC si aplica>"
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
| `User-Agent` / `X-App-Info` | `MOBILE\|Android\|{sdk}\|CFMOTO_INTERNATIONAL_APP\|{ver}\|Dalvik/...\|{res}\|{deviceId}\|{net}\|Android` | UserAgentUtil |
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
   POST /v1.0/fuel-user/serveruser/app/auth/user/login_by_idcard
   ```
   La respuesta contiene el Bearer token en `data.tokenInfo.accessToken`
   (en respuestas antiguas puede aparecer como `data.token`).

4. Navegar a la pantalla de la moto. Buscar:
   ```
   GET /v1.0/fuel-vehicle/servervehicle/app/vehicle?vehicleId=<vehicleId>
   ```
   La respuesta JSON contiene:
   ```json
   {
     "data": {
       "encryptInfo": {
         "encryptValue": "...",
         "key": "...",
         "iv": "..."
       }
     }
   }
   ```
   **Estos son los valores que van a `packages/ble-protocol/src/auth.ts`.**

   Nota de la captura actual (`full-history`): solo aparece `vehicleId=-1` (vehículo virtual),
   y en ese caso la respuesta trae `encryptInfo: {}`. Para validar BLE real se necesita una
   captura con vehículo físico vinculado (VIN real), donde `encryptInfo` venga poblado.

### Paso 6 — Guardar las claves y reproducir con curl

```bash
# Ejemplo de request autenticado con las credenciales capturadas:
curl -X GET "https://tapi.cfmoto-oversea.com/v1.0/fuel-vehicle/servervehicle/app/vehicle?vehicleId=<vehicleId>" \
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

- **Token TTL**: **confirmado en captura** — `expiresIn: 8639999` ≈ 100 días. `refreshToken` presente en la respuesta de login pero sin endpoint de refresh confirmado en el APK ni en capturas. En open-cfmoto se lanza `CloudAuthError` para forzar relogin.

- **MQTT** (`mqtts.cfmoto-oversea.com:8883`): las credenciales se obtienen de `getMqttUserInfo?machineCode=<hwId>` como blob cifrado base64 (probablemente AES). El `machineCode` es un identificador de hardware del dispositivo Android (`98bc59b5f9218ff4` en la captura). Sin descifrar el blob no se puede autenticar en el broker. No es necesario para el flujo BLE MVP.

- **machineCode / device fingerprint**: la app registra `machineCode` (hardware ID) y `deviceId` (Firebase push token) en endpoints separados tras el login. No parece que el servidor valide estos en cada request, solo los almacena para push/MQTT.

- **`cfmoto_virtual_vehicle_token`**: token hardcodeado usado antes del login (confirmado en captura — es el `Authorization` del request de login). Da acceso únicamente a endpoints sin autenticación real.

- **Mapbox**: tráfico a `api.mapbox.com` y `config.mapbox.com` con token `pk.eyJ1IjoiY2FyYml0IiwiYSI6ImNreGp0cDJjbTBuc3QyeHFrcjN5bWdhNmsifQ.ahQqET49R1Z2YJWKZDJ_dw`. Estilo `streets-v11`, capas terrain + traffic. Google Maps desactivado para región ES (`googleMapEnable: false` en login response).

- **Aliyun OSS**: assets de vehículo (imágenes) en `oss-cfmoto.zeehoev.com` y `international.oss-ap-southeast-1.aliyuncs.com`. Credenciales temporales vía `sys/oss/sts`. No relevante para BLE.

---

## Decisiones de implementacion (open-cfmoto)

Estas decisiones reflejan la implementacion en `packages/cloud-client/` y la integracion
con `packages/ble-protocol/`.

- Se centralizaron constantes y endpoints en `packages/cloud-client/src/config.ts`.
- El signing implementa `MD5(SHA1(body + params + APPSECRET))`, con:
  - `body = JSON.stringify(body)` para requests con body
  - `body = ""` para requests sin body (ej. GET)
- `nonce` en la implementacion actual: **16 caracteres** (alineado con el APK),
  usando fuente criptografica cuando esta disponible.
  - Distribucion alineada con `SignatureUtils.getNonce()`: digito o letra (A..Y / a..y).
- Se envian headers de firma compatibles:
  - `appId`, `nonce`, `timestamp`, `sign`
  - `signature`, `Cfmoto-X-Param`, `Cfmoto-X-Sign`, `Cfmoto-X-Sign-Type`
- Login cloud implementado sobre:
  - `POST /fuel-user/serveruser/app/auth/user/login_by_idcard`
  - payload estilo APK: `idcard`, `idcardType`, `password`
  - `password` se normaliza a MD5 hex (si ya viene en MD5, se reutiliza sin rehash)
  - extraccion de token desde `data.tokenInfo.accessToken` (con fallback a `data.token`)
- Vehicle lookup implementado sobre:
  - `GET /fuel-vehicle/servervehicle/app/vehicle?vehicleId=...`
  - firma GET con query params ordenados y URL-encoded (estilo `RequestSignInterceptor`)
  - se propaga `user_id` si existe tras login; si no, se envia vacio igual que el interceptor
- Lista de vehiculos del usuario implementada sobre:
  - `GET /fuel-vehicle/servervehicle/app/vehicle/mine?position=1`
  - parseo de `data[]` en respuesta (`Vehicle[]` del APK)
  - firma GET con `position` y mismos headers (`Authorization`, `user_id`, `lang`, `ZoneId`)
- No se persiste password:
  - No se escribe en disco (MMKV/SQLite/etc.)
  - No se guarda en estado de larga vida del cliente cloud
- `refreshToken()`:
  - No hay endpoint de refresh confirmado en el APK/documentacion
  - Se lanza `CloudAuthError` indicando repetir `login()`
- Campo `iv`:
  - Se mantiene en tipos y respuesta cloud para trazabilidad
  - En BLE auth actual se ignora porque el flujo confirmado usa `AES/ECB/PKCS7` (sin IV)

---

## Estado actual del cliente cloud (2026-03-14)

Implementado en `packages/cloud-client/`:

### `CloudAuthClient` (`auth.ts`)
- `login(username, password)` → `Promise<string>`
  - Endpoint: `POST /fuel-user/serveruser/app/auth/user/login_by_idcard`
  - `idcardType` auto-detectado (`email` o `phone`)
  - `password` normalizado a MD5 hex antes de enviar
  - Token extraído de `data.tokenInfo.accessToken` (con fallback a `data.token`)
  - Guarda `token` y `userId` en memoria
- `refreshToken()` — lanza `CloudAuthError` (no hay endpoint de refresh en el APK)

### `VehicleClient` (`vehicle.ts`)
- `getVehicleDetail(vehicleId, token)` → `Promise<VehicleNowInfoData>`
  - Endpoint: `GET /fuel-vehicle/servervehicle/app/vehicle?vehicleId=...`
  - Devuelve datos completos del vehículo (isOnline, lock states, telemetría, geoLocation)
- `getEncryptInfo(vehicleId, token)` → `Promise<EncryptInfo>`
  - Mismo endpoint; valida que `encryptInfo` esté presente (lanza si es vehículo virtual)
- `getVehicles(token)` → `Promise<UserVehicle[]>`
  - Endpoint: `GET /fuel-vehicle/servervehicle/app/vehicle/mine?position=2`
  - `position=2` confirmado en `VehicleGarageActivity.java` para lista completa

### `UserClient` (`user.ts`)
- `getProfile(token)` → `Promise<UserProfile>`
  - Endpoint: `GET /fuel-user/serveruser/app/auth/user/user_info`
- `updateProfile(token, req)` → `Promise<UserProfile>`
  - Endpoint: `PUT /fuel-user/serveruser/app/auth/user/update_info`
- `updateAreaNo(token, areaNo)` → `Promise<void>`
  - Endpoint: `POST /fuel-user/serveruser/app/auth/user/updateUserAreaNo`

### `AccountClient` (`account.ts`)
- `register(req)` → `Promise<RegisterResult>`
  - Endpoint: `POST /fuel-user/serveruser/app/auth/user/register`
  - `password` MD5-hasheado antes de enviar; no se persiste
  - Devuelve `{ token, userId, profile }`
- `sendCode(req)` → `Promise<void>`
  - Endpoint: `POST /fuel-user/serveruser/common/code/send_code`
- `checkCode(req)` → `Promise<void>`
  - Endpoint: `POST /fuel-user/serveruser/common/code/check_code`
- `updatePassword(token, req)` → `Promise<void>`
  - Endpoint: `POST /fuel-user/serveruser/app/auth/user/update_password` (POST, no PUT — confirmado en APK)
  - `oldPassword` y `newPassword` MD5-hasheados; ninguno se persiste

### `RideClient` (`ride.ts`)
- `listRides(token, params)` → `Promise<RideHistoryItem[]>`
  - Endpoint: `GET /fuel-vehicle/servervehicle/app/ridehistory/list_v2`
  - Params: `vehicleId` (req), `pageStart` (def: 1, 1-indexed), `pageSize` (def: 20), filtros opcionales de fecha
- `getRide(token, id, month)` → `Promise<RideHistoryDetail>`
  - Endpoint: `GET /fuel-vehicle/servervehicle/app/ridehistory?id=<id>&month=<yyyy-MM>`
  - `month` requerido por el servidor para particionar la query (confirmado en APK `@Query`)
- `deleteRide(token, id)` → `Promise<void>`
  - Endpoint: `DELETE /fuel-vehicle/servervehicle/app/ridehistory/{id}`

### Integración BLE
- `CFMoto450Protocol.connect(..., cloudCredentials)` ejecuta:
  1. `CloudAuthClient.login()`
  2. `VehicleClient.getEncryptInfo(vehicleId)`
  3. `AuthFlow.authenticate({ encryptValue, key })`
- Sin credenciales cloud: modo dev con warning y sin auth

Integrado en app móvil (`apps/mobile/src/services/cloud-auth.service.ts`):
- Login cloud funcional
- Consulta de vehículos funcional

---

## Captura dinámica y tooling

- Export principal de tráfico: `tools/apk-analysis/mitm-logs/full-history` (sanitizar antes de commit).
- Script de override de proxy usado en pruebas con Frida:
  - `tools/apk-analysis/frida/burp-override.js`
  - Objetivo: forzar tráfico hacia Burp/mitm en escenarios donde la app no respeta proxy de sistema.
