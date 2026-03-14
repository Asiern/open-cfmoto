# Auditoría Bloques 1 y 2 — open-cfmoto

Fecha: 2026-03-14
Scope: `packages/ble-protocol/` (Block 1) + `apps/mobile/src/stores/` (Block 2)
Metodología: Contraste de cada archivo contra `tools/apk-analysis/findings/` y `docs/protocol.md`, análisis de consistencia interna, y revisión de cobertura de tests.

---

## Resumen ejecutivo

Los Bloques 1 y 2 son sólidos para avanzar a Block 3 con **tres correcciones menores** y **cinco gaps documentados** que no bloquean pero deben resolverse antes de la prueba con hardware real. No hay errores de protocolo críticos que invaliden la implementación actual.

| Categoría | Estado |
|-----------|--------|
| Corrección vs APK (codec, UUIDs, control codes) | ✅ Correcto |
| Consistencia interna (tipos, interfaces) | ⚠️ 2 gaps menores |
| Cobertura de tests | ⚠️ 1 caso faltante |
| Deuda técnica documentada | 3 items |
| Listo para Block 3 | ✅ Go (con correcciones menores) |

---

## Por archivo

### `packages/ble-protocol/src/codec.ts`

**Corrección vs APK:** ✅
- Header `[0xAB, 0xCD]` correcto (fuente: `TboxMessageFrame.java`)
- CRC: suma de bytes[2..end-2] mod 256 correcto (fuente: `TBoxCrcFrame.java`)
- End byte `0xCF` correcto
- Longitud: `lenLo, lenHi` little-endian correcto

**Tests (`__tests__/codec.test.ts`):** ✅ Round-trips, CRC, header/end validation, rechazo de frames inválidos.

**Issues:** Ninguno.

---

### `packages/ble-protocol/src/uuids.ts`

**Corrección vs APK:** ✅
- Service UUID: `0000B354-D6D8-C7EC-BDF0-EAB1BFC6BCBC` ✅
- Write characteristic: `0000B356-D6D8-C7EC-BDF0-EAB1BFC6BCBC` ✅
- Notify characteristic: `0000B357-D6D8-C7EC-BDF0-EAB1BFC6BCBC` ✅

**Issues:** Ninguno.

---

### `packages/ble-protocol/src/auth.ts`

**Corrección vs APK:** ✅ Flujo y control codes correctos.

**Issue — tipo de `_codec` (severidad: menor):**
```typescript
// Línea 53 actual:
async step2(_codec: string, _key: string): Promise<Uint8Array>
```
El campo `TboxRandomNum.codec` está definido en el proto como `bytes`, que ts-proto v2 genera como `Uint8Array`. El caller tendrá que hacer `new TextDecoder().decode(randomNum.codec)` antes de pasar el valor a `step2`. Este paso de conversión no está documentado en ningún comentario ni en `docs/protocol.md`. No es un bug hoy (step2 lanza `NotImplementedError`), pero causará confusión cuando se implemente.

**Acción recomendada:** Añadir en el JSDoc de `step2`:
> `codec`: UTF-8 string obtenido con `new TextDecoder().decode(tboxRandomNum.codec)`. El campo proto es `bytes`, no `string`.

---

### `packages/ble-protocol/src/keepalive.ts`

**Corrección vs APK:** ✅
- Intervalo 2s, watchdog 4s: confirman con `BleModel.java` (keepAliveTime, keepAliveTimeout)
- Payload: `Heartbeat { ping: 1 }` sobre control code `0x67` (LOCK_CONTROL) ✅

**Issue — ambigüedad ACK (severidad: menor, ya documentada):**
El código fuente del OEM sugiere que el ACK del keep-alive es `0xEC` (KEEP_ALIVE_RESULT), pero `0xE7` (LOCK_RESULT) también es plausible. Los comentarios en el código lo reconocen correctamente. Pendiente de confirmar con tráfico BLE real.

**Tests (`__tests__/keepalive.test.ts`):** ✅ Intervalo 2s, watchdog 4s, `notifyAck()` resetea watchdog, `stop()` limpia timers.

---

### `packages/ble-protocol/src/response-router.ts`

**Corrección vs APK:** ✅ con un gap menor.

**Issue — `0xEC` ausente del test de tabla completa (severidad: menor):**
`KEEP_ALIVE_RESULT: 0xEC` fue añadido correctamente al mapa `BIKE_APP_CONTROL_CODES`. Sin embargo, el test `__tests__/response-router.test.ts` línea 67-84 ("registers handlers for all bike→app control codes") itera sobre la lista `[0x5b, 0x5d, 0x8a, 0x8b, 0x8c, 0x95, 0xe7, 0xea, 0xeb, 0xf1, 0xf9]` y **no incluye `0xEC`**. Si se añade un nuevo control code al mapa en el futuro, el test no lo detectará.

**Acción recomendada:** Añadir `0xec` a la lista del test, o mejor: reemplazar la lista hardcodeada con `Object.values(BIKE_APP_CONTROL_CODES)` para que el test sea automáticamente exhaustivo.

**Tests:** ✅ Dispatch por código, registro/deregistro de handlers, frames inválidos ignorados. Con la corrección arriba: ✅ completo.

---

### `packages/ble-protocol/src/commands/index.ts`

**Corrección vs APK:** ✅
- Control codes verificados: LOCK_CONTROL `0x67`, FIND_CAR `0x6A`, LIGHT_CONTROL `0x6B`, PREFERENCE `0x68`, DISPLAY_UNITS `0x69` ✅
- `setUnits` metric = KM+CELSIUS+H24+EN, imperial = MILE+FAHRENHEIT+H24+EN ✅
- `setSpeedLimit` rango 0-255, `RangeError` en 256 y -1 ✅
- `findCar` modos horn/flash/light ✅
- `setIndicators` lados left/right/off ✅

**Tests (`__tests__/commands.test.ts`):** ✅ 18 casos cubriendo los 7 builders, valores de frontera en `setSpeedLimit`, todos los modos de `findCar`/`setIndicators`/`setUnits`, payload `heartbeat` decodifica a `ping=1`.

**Issues:** Ninguno.

---

### `packages/ble-protocol/src/cfmoto450.ts`

**Corrección vs APK:** ✅
- Secuencia de conexión: connect → delay 100ms → subscribe → requestMtu(185) → auth ✅
- El delay de 100ms está confirmado por `BleModel.java`

**No testeado** (justificación documentada: requiere mock de BLE transport completo, scope de Block 3).

**Issue — scan por UUID vs MAC:**
`ble.service.ts` escanea usando `serviceUUIDs` del notify characteristic. `docs/protocol.md` §3 indica que el OEM escanea por MAC address. La diferencia es funcional: scan por UUID es más robusto para el caso general (no requiere MAC conocida de antemano). El comportamiento es aceptable para MVP, pero debe documentarse como desviación deliberada.

---

### `packages/ble-protocol/src/mock/mock-protocol.ts`

**Issue — datos sintéticos no representan el protocolo real (severidad: media):**
`MockBikeProtocol` emite `BikeData` con campos `rpm`, `speedKmh`, `gear`, `batteryPercent`, etc. Sin embargo, según `docs/protocol.md` §1 y §8, **BLE es control-only**: el protocolo TBox no transmite telemetría en tiempo real por BLE; esos datos vienen de la API cloud. La interfaz `BikeData` en `types.ts` define estos campos pensando en el mock y en datos cloud futuros, pero un usuario nuevo podría asumir erróneamente que el BLE real los provee.

**Acción recomendada:** Añadir un comentario en `mock-protocol.ts` (y en `types.ts`) aclarando que los campos de telemetría no se reciben por BLE sino por cloud API. No rompe nada hoy, pero previene confusión en Block 3.

---

### `apps/mobile/src/stores/bike.store.ts`

**Corrección vs especificación Block 2:** ✅
- `lastHeartbeatAck: number | null` ✅
- `commandHistory: CommandHistoryEntry[]` con FIFO cap 20 ✅
- `recordCommandAcked` escanea desde el más reciente (backwards) ✅

**Issue — `recordHeartbeatAck` no está conectado (severidad: menor, Block 3 gap):**
La acción existe en el store pero nada la llama. En `ble.service.ts` el `ResponseRouter` no tiene ningún handler para `0xEC` o `0xE7` que dispare `recordHeartbeatAck()`. Este wiring es scope de Block 3, pero vale la pena dejarlo anotado como TODO explícito.

**Tests (`src/__tests__/bike-store.test.ts`):** ✅ 7 casos cubriendo todos los comportamientos especificados.

---

### `apps/mobile/src/stores/settings.store.ts`

**Corrección vs especificación Block 2:** ✅
- Persistencia MMKV de 4 campos (units, speedLimit, lastConnectedDeviceId, lastConnectedDeviceName) ✅
- `useMockBike` en memoria, NO persistido (verificado por test) ✅
- Defaults: `units='metric'`, `speedLimit=120`, device=null ✅

**Tests (`src/__tests__/settings-store.test.ts`):** ✅ 10 casos cubriendo defaults, persistencia, lectura síncrona, limpieza con null, exclusión de useMockBike de MMKV.

**Issues:** Ninguno.

---

## Deuda técnica documentada

| ID | Archivo | Descripción | Prioridad |
|----|---------|-------------|-----------|
| TD-01 | `keepalive.ts` + `commands/index.ts` | `getHeartbeatFrame()` (privado) y `heartbeat()` (público) tienen lógica idéntica. Duplicación deliberada para mantener `commands/` como módulo puro sin dependencias internas. Consolidar cuando se implemente auth real. | Baja |
| TD-02 | `auth.ts` | `step2(_codec: string, _key: string)` — el tipo `string` es correcto para el caller, pero el paso de conversión desde `TboxRandomNum.codec` (Uint8Array) a string no está documentado. | Baja |
| TD-03 | `mock-protocol.ts` | `MockBikeProtocol` emite telemetría (rpm, speed, gear) que no existe en el protocolo BLE real. Aceptable para desarrollo UI, pero puede crear expectativas incorrectas. Añadir comentario aclaratorio. | Media |

---

## Qué falta validar con hardware

Los siguientes puntos no pueden resolverse con análisis estático ni tests unitarios. Requieren un CFMoto 450 real con HCI snoop habilitado:

1. **ACK del keep-alive**: Confirmar si el bike responde al heartbeat (0x67) con 0xEC (KEEP_ALIVE_RESULT) o 0xE7 (LOCK_RESULT) o ambos. Resolver la ambigüedad en `keepalive.ts` y `response-router.ts`.

2. **Secuencia de auth**: Verificar que `AuthPackage.info = hex_decode(encryptValue)` (de la API cloud) es el encoding correcto. La implementación en `auth.ts` está stub; necesita las claves reales del cloud endpoint.

3. **Delay de 100ms post-connect**: Confirmar que el delay antes de `subscribe()` es necesario con el hardware específico. En algunos chipsets BLE puede no hacer falta o puede necesitar más tiempo.

4. **Frame de lock/unlock**: `lock()` y `unlock()` en `commands/index.ts` toman `encryptedPayload: Uint8Array` como argumento, pero la estructura interna del payload encriptado (qué proto message, qué campos) no está confirmada en los findings actuales. El control code 0x67 está confirmado; el contenido del payload encrypted, no.

5. **Campos de DISPLAY_UNITS (0x69)**: Los valores de enum para units (KM=1, MILE=2, etc.) están inferidos del proto; confirmar con tráfico real que el bike los acepta.

6. **MTU efectivo**: Verificar que el bike acepta MTU=185 y que no trunca frames más grandes que el MTU por defecto (23 bytes).

---

## Veredicto

**Block 3 completado.**

Las tres correcciones menores se aplicaron antes de iniciar Block 3. El núcleo del protocolo, los stores y la API pública React Native están implementados y testeados.

El principal riesgo pendiente es el wiring del `ResponseRouter` con los stores (ACK del keep-alive) — no resolvible sin hardware real. La arquitectura lo permite limpiamente.

---

## Block 3 — Estado (2026-03-14)

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `apps/mobile/src/providers/CFMotoProvider.tsx` | Lifecycle provider: permisos → init → destroy |
| `apps/mobile/src/hooks/index.ts` | `useCFMoto`, `useBikeCommands`, `useSettings`, `useHeartbeat`, `useRideRecording` |
| `apps/mobile/src/__tests__/provider.test.tsx` | 7 tests: permisos Android, iOS skip, destroy |
| `apps/mobile/src/__tests__/hooks.test.ts` | 14 tests: connect, guards, findCar, isAlive, TripSummary, MMKV persist |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `packages/ble-protocol/src/commands/index.ts` | Eliminado `heartbeat()` — TD-01 resuelto |
| `packages/ble-protocol/__tests__/commands.test.ts` | Eliminado test de heartbeat |
| `apps/mobile/src/services/ble.service.ts` | Añadidos `sendCommand()` + `destroy()`, clase exportada |
| `apps/mobile/jest.config.js` | Añadido soporte para `*.test.tsx` |

### Decisiones de diseño

- **`runBleInit` exportada** (no solo el provider): permite tests unitarios del ciclo de vida sin renderizar React.
- **iOS handling en el provider**: la verificación `Platform.OS === 'android'` está en el provider, no en `requestBlePermissions`. Hace el comportamiento iOS explícitamente testeable.
- **Helpers puros exportados**: `checkConnected`, `calcIsAlive`, `buildTripSummary`, `persistTrip`, `connectAndPersist`, `sendBikeCommand` — testables sin React renderer en node env.
- **`useSettings` no requiere provider**: wrapper fino sobre `useSettingsStore`; no necesita BLE para leer preferencias.
- **`useRideRecording` sin telemetría**: solo `deviceId`, `deviceName`, `startedAt`, `endedAt`, `durationMs` — sin speed/RPM (BLE es control-only).
- **MMKV separado para rides**: `id: 'open-cfmoto-rides'` aislado de `'open-cfmoto-settings'`.

### Gap pendiente (hardware)

El `ResponseRouter` en `ble.service.ts` aún no tiene handlers para `0xEC`/`0xE7` que disparen `useBikeStore.recordHeartbeatAck()`. El wiring completo requiere confirmar el ACK code con tráfico BLE real (punto 1 de la lista de validación hardware).

---

## Bloque 3 — Auditoría (2026-03-14)

**[estado: listo para Bloque 4 — con dos issues menores documentados, ninguno bloqueante]**

---

### Por archivo

#### `apps/mobile/src/providers/CFMotoProvider.tsx`

**Estado: ⚠️**

| Línea | Hallazgo | Severidad |
|-------|----------|-----------|
| 60-74 | **Race condition en unmount durante init**: `runBleInit` se lanza con `.catch()` sin `await`. Si el componente se desmonta mientras `requestBlePermissions` está pendiente (el prompt de Android no se ha resuelto), la cleanup function corre (`cancelled = true; bleService.destroy()`), pero cuando `requestBlePermissions` resuelve a true, `runBleInit` llama igualmente a `bleService.initialize()` — dejando el servicio inicializado tras el unmount. La variable `cancelled` guarda el `.catch` pero no el path de `initialize()`. | Menor |
| 90-98 | Error de contexto descriptivo: mensaje con nombre del provider y hint de fix. ✅ | — |
| 35-43 | Secuencia permissions → initialize correcta. ✅ | — |
| 67-70 | `bleService.destroy()` en cleanup de `useEffect([])` — cubre todos los paths de unmount (React garantiza que el cleanup siempre corre). ✅ | — |
| 35 | iOS: `Platform.OS === 'android'` evita `requestBlePermissions` en iOS. ✅ | — |

**Acción recomendada:** Añadir un flag `let destroyed = false` en el `useEffect` y guardarlo en la closure de `runBleInit` para evitar `initialize()` tras `destroy()`.

---

#### `apps/mobile/src/hooks/index.ts`

**Estado: ⚠️**

| Línea | Hallazgo | Severidad |
|-------|----------|-----------|
| 256-268 | **`useRideRecording`: stale closure en `isRecording`**. `isRecording` se lee dentro del `useEffect` pero no está en el array de dependencias (`[connectionState]` solamente). En React 18 concurrent mode, si `connectionState` cambia y el render previo de `isRecording` es stale, el effect puede evaluar `!isRecording` con valor antiguo. En práctica es improbable que cause doble-arranque porque `connectionState` solo cambia externamente (BLE), pero viola las reglas de hooks. | Menor |
| 111-113 | `recordCommandSent` llamado ANTES de que `sendCommand` complete. Si la escritura BLE falla, el comando queda en historial con `ackedAt: null`. Comportamiento aceptable pero no documentado. | Info |
| 163-186 | Todos los builders usan `commands/index.ts` (lock, unlock, findCar, setIndicators, setUnits, setSpeedLimit). ✅ | — |
| 55-61, 73 | `TripSummary` sin campos de telemetría (speed/RPM/fuel). ✅ | — |
| — | Sin `any` en ningún hook. ✅ | — |
| 270-278 | `finalizeTrip()` retorna null si `deviceId === null \|\| startedAt === null` — protege contra llamada prematura. ✅ | — |
| 275 | `endedAt = endedAtRef.current ?? Date.now()` — funciona si se llama mientras recording está activo (antes del disconnect). ✅ | — |

---

#### `apps/mobile/src/__tests__/provider.test.tsx`

**Estado: ⚠️**

| Línea | Hallazgo | Severidad |
|-------|----------|-----------|
| 103-109 | **Falso positivo en test de unmount**: el test crea una closure local `() => bleService.destroy()` y la ejecuta directamente. No testea el `useEffect` cleanup real del provider — pasaría aunque el provider llamase `bleService.scan()` en lugar de `destroy()`. Sin React renderer en el entorno de test, no es posible testear mount/unmount sin refactor. | Menor |
| 31-36 | Mock de `Platform` via mutación del objeto: patrón correcto con `jest.mock` hoisted. ✅ | — |
| 10-20 | Mock de `bleService` cubre todos los métodos públicos: `initialize`, `destroy`, `scan`, `connect`, `disconnect`, `sendCommand`. ✅ | — |
| 81-95 | iOS: `Platform.OS = 'ios'` antes de `runBleInit` → `requestBlePermissions` NO llamado → `bleService.initialize` llamado. Test funciona porque mutamos el objeto mockeado. ✅ | — |

---

#### `apps/mobile/src/__tests__/hooks.test.ts`

**Estado: ⚠️**

| Línea | Hallazgo | Severidad |
|-------|----------|-----------|
| 86-94 | **Tests de `isConnected` de bajo valor**: comprueban `useBikeStore.getState().connectionState === 'connected'` — no testean `useCFMoto` en absoluto. Pasarían aunque `isConnected` en el hook estuviese hardcodeado a `false`. | Info |
| 116-143 | `findCar`: test correcto — verifica que el frame de `findCar('horn')` llega a `sendCommand` con el ControlCode esperado. ✅ | — |
| 165-173 | `calcIsAlive` con timestamps inyectables: tests de boundary deterministas. ✅ | — |
| 181-186 | `buildTripSummary` con timestamps fijos (1000, 4000): `durationMs = 3000` determinista. ✅ | — |
| 199-216 | `persistTrip` con storage inyectado (plain Map): verifica key y JSON serializado. ✅ | — |

---

#### `apps/mobile/src/services/ble.service.ts`

**Estado: ✅**

- `destroy()` llama a `disconnect()` antes de nullar `protocol`/`transport` — orden correcto. ✅
- `sendCommand()` lanza si `protocol === null` — falla rápido, mensaje descriptivo. ✅
- `BleService` exportada como clase — permite tipar el contexto. ✅

---

#### `packages/ble-protocol/src/commands/index.ts` — TD-01

**Estado: ✅**

`heartbeat()` eliminado. Comentario explícito apunta a `KeepAliveManager`. La spec decía "useBikeCommands.heartbeat re-exporta desde keepalive.ts" — implementado como "heartbeat no expuesto en useBikeCommands" (más correcto: el heartbeat es automático, no debería ser un comando de usuario). Desviación intencional y justificada.

---

### Deuda técnica actualizada

| ID | Archivo | Descripción | Estado | Prioridad |
|----|---------|-------------|--------|-----------|
| TD-01 | `commands/index.ts` | Heartbeat duplicado en keepalive.ts + commands. | ✅ **RESUELTO** — `heartbeat()` eliminado de commands | — |
| TD-02 | `auth.ts` | Conversión Uint8Array→string no documentada para `step2._codec`. | ✅ **RESUELTO** — JSDoc añadido con TextDecoder | — |
| TD-03 | `mock-protocol.ts` | Telemetría sintética no representa el protocolo real. | ✅ **RESUELTO** — comentario MOCK ONLY añadido | — |
| TD-04 | `CFMotoProvider.tsx:60-74` | Race condition: `bleService.initialize()` puede correr tras `destroy()` si el componente se desmonta durante el prompt de permisos Android. | 🔴 **NUEVO** — fix recomendado antes de prod | Baja (improbable en uso real) |
| TD-05 | `hooks/index.ts:256-268` | `isRecording` en stale closure dentro de `useEffect([connectionState])`. | ⚠️ **NUEVO** — viola exhaustive-deps; baja probabilidad de bug real | Baja |
| TD-06 | `ble.service.ts` / `hooks/index.ts` | `recordCommandAcked` nunca es llamado por ningún hook. Cuando el bike responde con un ACK, nadie cierra el ciclo en `commandHistory`. Requiere handlers en ResponseRouter (post-hardware). | ⚠️ **NUEVO** — scope de wiring post-hardware | Media |
| TD-07 | `__tests__/provider.test.tsx:103-109` | Test de unmount es falso positivo: no testea el cleanup real del `useEffect`. Sin renderer React no es resoluble en node env. | ⚠️ **NUEVO** — aceptable como limitación de la estrategia de tests | Info |

---

### Qué falta validar con hardware

1. **ACK del keep-alive**: ¿0xEC, 0xE7, o ambos? Necesario para wiring `ResponseRouter` → `recordHeartbeatAck()` y para `recordCommandAcked()` (TD-06). **Más crítico que antes**: ahora también bloquea el cierre de `commandHistory`.

2. **Secuencia de auth**: `AuthPackage.info = hex_decode(encryptValue)` + encoding correcto de `TboxRandomNum.codec` → `RandomNum.sn`. `auth.ts` sigue en stub.

3. **Delay de 100ms post-connect**: Confirmar necesidad en hardware real.

4. **Frame de lock/unlock**: Estructura interna del payload encriptado no confirmada. `lock()`/`unlock()` toman `Uint8Array` opaco — la construcción del proto `Lock { type, state }` + encriptación no está implementada ni documentada.

5. **Campos DISPLAY_UNITS (0x69)**: Valores de enum KM=1, MILE=2, CELSIUS=1, FAHRENHEIT=2 inferidos del proto. Confirmar con tráfico real.

6. **MTU efectivo**: Confirmar que el bike acepta MTU=185.

7. **[NUEVO] `connectionState` vs estado real del bike**: `ble.service.ts` pone `connectionState = 'connected'` cuando `protocol.connect()` resuelve (antes de auth). Tras auth `onDisconnect` del keepalive cambiaría el estado, pero `setConnectionState` no está conectado al `onDisconnect` del `KeepAliveManager`. Con hardware real, el estado visible al usuario podría ser 'connected' aunque el keepalive haya fallado.

---

### Veredicto

**Bloque 4 directo — sin fixes bloqueantes.**

El Bloque 3 es sólido para continuar. Los dos issues nuevos (TD-04 race condition, TD-05 stale closure) son improbables en el flujo de uso real y no afectan la correctitud en escenarios normales. La API pública (provider + hooks) está completa y correctamente tipada.

El gap de wiring más importante (TD-06: `recordCommandAcked` nunca llamado) es intrínsecamente post-hardware: hasta confirmar los ACK codes con tráfico real, no hay nada que conectar. La arquitectura lo soporta sin cambios.
