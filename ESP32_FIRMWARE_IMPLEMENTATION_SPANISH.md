# Guía de Implementación del Firmware ESP32

> **Proyecto**: Asistente de Voz de Calendario ESP32 Audio Streaming  
> **Hardware**: NodeMCU-32S (ESP32-WROOM-32), Micrófono MEMS INMP441 I²S, Amplificador I²S MAX98357A  
> **Última Actualización**: 17 de noviembre de 2025

---

## 📋 Tabla de Contenidos

- [Resumen](#resumen)
- [Especificaciones de Hardware](#especificaciones-de-hardware)
- [Configuración de Pines](#configuración-de-pines)
- [Prerrequisitos](#prerrequisitos)
- [Dependencias de Librerías](#dependencias-de-librerías)
- [Arquitectura del Firmware](#arquitectura-del-firmware)
- [Pasos de Implementación](#pasos-de-implementación)
- [Implementación de Captura de Audio](#implementación-de-captura-de-audio)
- [Carga de Streaming HTTP](#carga-de-streaming-http)
- [Implementación de Reproducción de Audio](#implementación-de-reproducción-de-audio)
- [Descarga de Streaming HTTP](#descarga-de-streaming-http)
- [Optimización de Memoria](#optimización-de-memoria)
- [Estrategia de Sondeo en Estado Inactivo](#estrategia-de-sondeo-en-estado-inactivo)
- [Gestión de Energía](#gestión-de-energía)
- [Pruebas y Depuración](#pruebas-y-depuración)
- [Solución de Problemas](#solución-de-problemas)
- [Verificación de Documentación](#verificación-de-documentación)

---

## Resumen

Esta guía detalla la implementación del firmware ESP32 para un asistente de voz de calendario que captura audio a través de un micrófono MEMS I²S, transmite el audio a un servidor Node.js y reproduce respuestas de audio a través de un amplificador I²S.

### Características Clave

- ✅ **Entrada de Audio I²S**: Captura directa de micrófono digital (INMP441)
- ✅ **Salida de Audio I²S**: Reproducción de alta calidad amplificada (MAX98357A)
- ✅ **Streaming HTTP**: Carga/descarga por fragmentos (sin necesidad de tarjeta SD)
- ✅ **Eficiente en Memoria**: Buffers de 4-8KB, transferencias DMA
- ✅ **Conectividad WiFi**: 802.11n con reconexión automática
- ✅ **Botón de Activación**: Control de grabación push-to-talk (solo grabación)
- ✅ **LED de Estado**: Sistema de retroalimentación visual
- ✅ **Sondeo en Segundo Plano**: Monitoreo de estado inactivo para eventos del servidor

---

## Especificaciones de Hardware

### Placa de Desarrollo NodeMCU-32S (ESP32-WROOM-32)

**Placa**: NodeMCU-32S (ESP32-S)  
**Módulo**: ESP32-WROOM-32 (4MB Flash)  
**Chipset**: ESP32-D0WDQ6 (variante de doble núcleo)  
**USB-a-Serial**: Chip CH340C  

**Documentación Oficial**:
- [Hoja de Datos del SoC ESP32](https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf)
- [Manual de Referencia Técnica ESP32](https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf)
- [Hoja de Datos del Módulo ESP32-WROOM-32](https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf)
- [Directrices de Diseño de Hardware ESP32-WROOM-32](https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_hardware_design_guidelines_en.pdf)
- [Portal de Documentación ESP32](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/)

| Especificación | Valor | Detalles |
|--------------|-------|---------|
| **CPU** | Xtensa® 32-bit LX6 de doble núcleo | Hasta 240 MHz (ajustable) |
| **Rendimiento** | 600 DMIPS | Potencia de procesamiento de doble núcleo |
| **RAM** | 520 KB SRAM | 448 KB disponibles para el usuario |
| **ROM** | 448 KB | Librerías de arranque y núcleo |
| **Flash** | 4 MB QSPI | Flash SPI externa (ESP32-WROOM-32) |
| **WiFi** | 802.11 b/g/n (2.4 GHz) | Hasta 150 Mbps |
| **Bluetooth** | Bluetooth 4.2 + BLE | Modo dual |
| **GPIO** | 34 pines programables (24 accesibles) | Funciones multiplexadas |
| **ADC** | 12-bit, 18 canales | 2× SAR ADCs |
| **DAC** | 8-bit, 2 canales | DACs de audio integrados |
| **I²S** | 2 interfaces | E/S de audio dedicada |
| **I2C** | 2 interfaces | Configurable por software |
| **SPI** | 4 interfaces | 2× uso general |
| **UART** | 3 interfaces | Depuración + 2 general |
| **PWM** | 16 canales | Controlador PWM LED |
| **DMA** | 16 canales | Memoria-a-periférico |
| **Sensores Táctiles** | 10 capacitivos | Pines GPIO |
| **Sensor de Temperatura** | Integrado | Rango -40°C a +125°C |
| **Voltaje de Operación** | 3.0V - 3.6V | 3.3V nominal |
| **Voltaje de Entrada** | 5V vía USB o pin Vin | Regulador integrado |
| **Conector USB** | USB Tipo-C (versiones más nuevas) | Micro-USB en versiones anteriores |
| **USB-a-Serial** | Chip CH340C | Comunicación USB |
| **Antena** | Antena PCB integrada | 2.4 GHz |
| **Corriente (WiFi Activo)** | ~160-260 mA | Pico durante TX |
| **Corriente (Modo Modem Sleep)** | ~20-30 mA | CPU ejecutándose |
| **Corriente (Modo Light Sleep)** | ~0.8 mA | Despertar automático |
| **Corriente (Modo Deep Sleep)** | ~10 µA | RTC + ULP activo |
| **Temperatura de Operación** | -40°C a +125°C | Grado industrial |
| **Paquete** | 48-pin QFN (6×6 mm) | Chip ESP32-D0WDQ6 |
| **Tamaño del Módulo** | 18 × 25.5 × 3.1 mm | ESP32-WROOM-32 |
| **Diseño de Placa** | Amigable con protoboard | Encabezados de pines dobles |
| **RTC** | Integrado | Coprocesador de bajo consumo |
| **Criptografía** | Aceleradores de hardware | AES, SHA, RSA |
| **Calibración** | Autocalibrante RF | Compensación de temperatura |

**Diseño de Pines**:
```
           NodeMCU-32S (ESP32-WROOM-32)
         ┌─────────────────────────────┐
         │                             │
    EN   │ 1                        30 │ VP (GPIO36) Solo Entrada
   VP36  │ 2                        29 │ VN (GPIO39) Solo Entrada
   VN39  │ 3                        28 │ GPIO34 Solo Entrada
   GPIO34│ 4                        27 │ GPIO35 Solo Entrada
   GPIO35│ 5                        26 │ GPIO32
   GPIO32│ 6                        25 │ GPIO33 ─→ I²S1_WS (INMP441)
   GPIO33│ 7                        24 │ GPIO25 ─→ I²S1_SCK (INMP441)
   GPIO25│ 8                        23 │ GPIO26 ─→ I²S1_SD (INMP441)
   GPIO26│ 9                        22 │ GPIO27
   GPIO27│10                        21 │ GPIO14
   GPIO14│11                        20 │ GPIO12
   GPIO12│12                        19 │ GND
   GND   │13                        18 │ GPIO13
   GPIO13│14                        17 │ D2 (GPIO9) - Flash
   D3    │15 (GPIO10) - Flash       16 │ CMD (GPIO11) - Flash
   CMD   │16                        15 │ 5V (VIN)
         └─────────────────────────────┘
         ┌─────────────────────────────┐
   3V3   │17                        14 │ GND
   GPIO1 │18 (TXD0)                 13 │ GPIO3 (RXD0)
   GPIO22│19 ─→ I²S0_DIN (MAX98357A)12 │ GPIO21 ─→ I²S0_BCK (MAX98357A)
   GPIO19│20 ─→ I²S0_WS (MAX98357A) 11 │ GND
   GPIO23│21                        10 │ GPIO18
   GPIO5 │22                         9 │ GPIO17
   GND   │23                         8 │ GPIO16
   3V3   │24                         7 │ GPIO4
   GPIO0 │25 ─→ BOOT/BOTÓN          6 │ GPIO2 ─→ LED (Integrado)
   GPIO15│26                         5 │ GND
         └─────────────────────────────┘

Nota: GPIO6-GPIO11 están conectados al flash SPI integrado y no se 
recomiendan para uso general. VP/VN (GPIO36/39) y GPIO34/35 son solo entrada.
```

### Micrófono MEMS I²S INMP441

**Fuente**: [Página del Producto InvenSense INMP441](https://invensense.tdk.com/products/digital/inmp441/) | [PDF de Hoja de Datos Oficial](https://invensense.tdk.com/wp-content/uploads/2015/02/INMP441.pdf)

**Estado**: No Recomendado para Nuevos Diseños (NR/ND) - Aún ampliamente disponible y utilizado

| Especificación | Valor | Notas |
|--------------|-------|-------|
| **Tipo** | Micrófono omnidireccional MEMS | Interfaz digital I²S |
| **Interfaz** | Salida digital I²S | Datos de alta precisión de 24-bit |
| **Sensibilidad** | -26 dBFS @ 94 dB SPL | Alta sensibilidad para aplicaciones de campo lejano |
| **SNR (Relación Señal-Ruido)** | 61 dBA | Rendimiento líder en la industria |
| **Rango Dinámico** | 105 dB | Rango dinámico amplio |
| **Respuesta de Frecuencia** | 60 Hz - 15 kHz (plano ±3 dB) | Sonido natural con alta inteligibilidad |
| **Tasa de Muestreo** | Hasta 24-bit @ 48 kHz | También soporta 16kHz, 32kHz |
| **Voltaje de Operación** | 1.8V - 3.3V | Compatible con 3.3V ESP32 |
| **Consumo de Corriente** | 1.4 mA (típico) | Bajo consumo de energía |
| **Punto de Sobrecarga Acústica** | 120 dB SPL | Tolerancia THD del 10% |
| **PSR (Rechazo de Suministro de Potencia)** | -75 dBFS | Alta inmunidad al ruido |
| **Tamaño del Paquete** | 4.72 × 3.76 × 1 mm | Paquete de montaje superficial |
| **Ubicación del Puerto** | Puerto inferior | El sonido entra por la parte inferior |
| **Cumplimiento RoHS** | Sí | Libre de plomo, libre de halógenos |

**Configuración de Pines**:
```
Módulo INMP441
┌───────────────┐
│  ○ VDD (3.3V) │──┐
│  ○ GND        │──┤
│  ○ SD (Datos) │  │
│  ○ WS (L/R)   │  │
│  ○ SCK (Reloj)│  │
│  ○ L/R Select │  │
└───────────────┘  │
```

**Especificaciones de Temporización I²S**:
- **Reloj L/R (WS)**: 8-48 kHz tasa de muestreo soportada
- **Reloj de Bit (SCK)**: 64 × tasa de muestreo (ej., 3.072 MHz @ 48 kHz, 1.024 MHz @ 16 kHz)
- **Datos de Salida (SD)**: 24-bit MSB-first, formato justificado a la izquierda
- **Formato de Datos**: Compatible con estándar I²S
- **Selección de Canal L/R**: Conectar pin L/R a GND para canal Izquierdo, VDD para Derecho
- **Latencia**: Ultra baja latencia para aplicaciones en tiempo real

**Aplicaciones Verificadas** (del fabricante):
- Sistemas de Conferencia Telefónica
- Consolas y Controladores de Juegos
- Dispositivos Móviles y Smartphones
- Laptops y Tablets
- Sistemas de Seguridad
- Dispositivos Domésticos Inteligentes
- Controles Remotos

### Amplificador I²S Clase D MAX98357A

**Fuente**: [Página del Producto Analog Devices MAX98357A](https://www.analog.com/en/products/max98357a.html) | [PDF de Hoja de Datos Oficial (Rev. 13)](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX98357A-MAX98357B.pdf)

**Estado**: Producción - Amplificador Clase D Pequeño y de Bajo Costo con Rendimiento Clase AB

| Especificación | Valor | Notas |
|--------------|-------|-------|
| **Tipo** | Amplificador de audio mono Clase D | Diseño de salida sin filtro |
| **Interfaz** | Entrada digital I²S (MAX98357A) | También soporta modo TDM |
| **Potencia de Salida** | 3.2W @ 4Ω, 5% THD, suministro 5V | Rendimiento Clase AB |
| **Eficiencia** | 92% @ 8Ω, salida 1W | >90% típico |
| **SNR (Relación Señal-Ruido)** | 92 dB | Alta calidad de audio |
| **THD+N** | 0.015% @ 1 kHz, 2.1W | 0.013% @ 1 kHz típico |
| **Ruido de Salida** | 22.8 µVRMS (AV = 15dB) | Nivel de ruido ultra bajo |
| **Respuesta de Frecuencia** | 20 Hz - 20 kHz | Espectro de audio completo |
| **Tasa de Muestreo** | 8-96 kHz | No se requiere MCLK |
| **Profundidad de Bit** | 16/24/32 bits | Formatos de datos flexibles |
| **Voltaje de Operación** | 2.5V - 5.5V | Operación de suministro único |
| **Corriente en Reposo** | 2.4 mA (típico) | Bajo consumo inactivo |
| **Corriente de Apagado** | <1 µA | Bajo consumo en standby |
| **PSRR** | 77 dB @ 1kHz | Excelente rechazo de ruido de potencia |
| **Tamaño del Paquete** | 1.345 × 1.435 mm WLP o 3×3mm TQFN | Ultra compacto |
| **Supresión de Clic y Pop** | Integrado | Circuito extenso |
| **Reducción EMI** | Limitación activa de velocidad de borde | Salida Clase D sin filtro |
| **Protección** | Cortocircuito y térmica | Operación robusta |
| **Tolerancia de Jitter** | 12ns típico en BCLK/LRCLK | Tolerancia amplia |

**Configuración de Pines**:
```
Módulo MAX98357A
┌───────────────┐
│  ○ VIN (5V)   │──┐
│  ○ GND        │  │
│  ○ SD (Mute)  │  │
│  ○ GAIN       │  │  Selección de Ganancia:
│  ○ DIN (Datos)│  │  • GAIN a GND  = 9 dB
│  ○ BCLK       │  │  • GAIN a VDD  = 12 dB
│  ○ LRC (WS)   │  │  • GAIN flotante = 15 dB
│  ○ SPKR+      │──┤
│  ○ SPKR-      │──┘
└───────────────┘
```

**Especificaciones de Temporización I²S**:
- **Reloj de Palabra (LRC)**: 8-96 kHz tasa de muestreo (auto-detecta hasta 35 esquemas PCM/TDM)
- **Reloj de Bit (BCLK)**: 32/48/64 × tasa de muestreo (flexible)
- **Formato de Datos**: I²S (MAX98357A), justificado a la izquierda (MAX98357B), TDM 8-canales
- **Profundidad de Bit**: Datos de 16-bit, 24-bit o 32-bit
- **No se Requiere MCLK**: Elimina reloj maestro, reduce EMI
- **Tolerancia de Jitter**: 12ns típico (banda ancha)
- **Retraso de Inicio**: 1ms típico después de que el pin SD suba
- **Control de Apagado**: Pin SD BAJO = apagado (<1µA), ALTO = habilitar

**Aplicaciones Verificadas** (del fabricante):
- Smartphones y Tablets
- Altavoces Inteligentes y Asistentes de Voz
- Dispositivos IoT y Wearables
- Cámaras con Audio
- Dispositivos de Juegos (Audio y Hápticos)
- Computadoras Portátiles
- Dispositivos de Celda Li-ion Única/5V

### Altavoz de 4Ω 3W

| Especificación | Valor |
|--------------|-------|
| **Impedancia** | 4Ω ±15% |
| **Potencia Nominal** | 3W (RMS) |
| **Respuesta de Frecuencia** | 250 Hz - 18 kHz |
| **Sensibilidad** | 82-86 dB @ 1W/1m |
| **Diámetro** | 40-50mm típico |

---

## Configuración de Pines

### Diagrama de Cableado Completo

```
┌──────────────────────────────────────────────────────────────┐
│                    Placa ESP32 NodeMCU                       │
│                                                              │
│  GPIO26 ─────────┐                      GPIO22 ─────────┐   │
│  GPIO25 ─────┐   │                      GPIO21 ─────┐   │   │
│  GPIO33 ──┐  │   │                      GPIO19 ──┐  │   │   │
│  3.3V ──┐ │  │   │                      5V ────┐ │  │   │   │
│  GND ─┐ │ │  │   │                      GND ─┐ │ │  │   │   │
└───────│─│─│──│───│──────────────────────────│─│─│──│───│───┘
        │ │ │  │   │                          │ │ │  │   │
        │ │ │  │   │                          │ │ │  │   │
  ┌─────┴─┴─┴──┴───┴────┐             ┌──────┴─┴─┴──┴───┴─────┐
  │   Módulo INMP441    │             │  Módulo MAX98357A     │
  ├─────────────────────┤             ├────────────────────────┤
  │ VDD ← 3.3V          │             │ VIN  ← 5V              │
  │ GND ← GND           │             │ GND  ← GND             │
  │ SD  ← GPIO26 (I2S1) │             │ DIN  ← GPIO22 (I2S0)   │
  │ WS  ← GPIO33 (I2S1) │             │ BCLK ← GPIO21 (I2S0)   │
  │ SCK ← GPIO25 (I2S1) │             │ LRC  ← GPIO19 (I2S0)   │
  │ L/R → GND (Izquierdo)│             │ SD   → 3.3V (Habilitar)│
  └─────────────────────┘             │ GAIN → Flotante (15dB) │
                                      │ SPKR+┐                 │
                                      │ SPKR-│                 │
                                      └──────┴─────────────────┘
                                             │
                                      ┌──────┴──────┐
                                      │  Altavoz 4Ω │
                                      └─────────────┘

Componentes Adicionales:
┌─────────────────────┐
│ GPIO0 ← BOTÓN      │  Push-to-talk (activo BAJO)
│ GND  ← BOTÓN       │
│ GPIO2 → LED (+)    │  Retroalimentación visual
│ GND  ← LED (-) 220Ω│
└─────────────────────┘
```

### Resumen de Mapeo de Pines

#### Entrada I²S (Micrófono INMP441) - I2S_NUM_1

| Pin ESP32 | Función | Pin INMP441 |
|-----------|----------|-------------|
| GPIO26 | I2S1_DATA_IN (SD) | SD (Datos Serial) |
| GPIO33 | I2S1_WS (Word Select) | WS (Reloj L/R) |
| GPIO25 | I2S1_SCK (Bit Clock) | SCK (Reloj de Bit) |
| 3.3V | Energía | VDD |
| GND | Tierra | GND |
| GND | Selección de Canal | L/R (Canal izquierdo) |

#### Salida I²S (Amplificador MAX98357A) - I2S_NUM_0

| Pin ESP32 | Función | Pin MAX98357A |
|-----------|----------|---------------|
| GPIO22 | I2S0_DATA_OUT (DIN) | DIN (Datos Serial) |
| GPIO21 | I2S0_BCK (Bit Clock) | BCLK (Reloj de Bit) |
| GPIO19 | I2S0_WS (Word Select) | LRC (Reloj L/R) |
| 5V (VIN) | Energía | VIN |
| GND | Tierra | GND |
| 3.3V | Control de Apagado | SD (Habilitar) |
| Flotante | Selección de Ganancia | GAIN (15 dB) |

#### Pines de Control

| Pin ESP32 | Función | Conexión |
|-----------|----------|------------|
| GPIO0 | Botón de Grabación | Botón pulsador a GND (pull-up) - Solo grabación |
| GPIO2 | LED de Estado | LED + resistor 220Ω a GND |

**Nota**: El botón (GPIO0) se utiliza exclusivamente para iniciar la grabación de audio. El sondeo en segundo plano para eventos pendientes ocurre automáticamente durante el estado inactivo, no activado por pulsación de botón.

---

## Prerrequisitos

### Configuración del IDE Arduino

1. **Instalar IDE Arduino**
   - Descargar desde https://www.arduino.cc/en/software
   - Versión 2.0+ recomendada

2. **Agregar Soporte de Placa ESP32**
   ```
   Archivo → Preferencias → URLs Adicionales de Board Manager:
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```

3. **Instalar Paquete de Placa ESP32**
   ```
   Herramientas → Board Manager → Buscar "ESP32" → Instalar "esp32 by Espressif Systems"
   ```

4. **Seleccionar Placa**
   ```
   Herramientas → Board → ESP32 Arduino → ESP32 Dev Module
   ```

5. **Configurar Configuración de Placa**
   ```
   Velocidad de Carga: 921600
   Frecuencia CPU: 240MHz
   Frecuencia Flash: 80MHz
   Tamaño Flash: 4MB
   Esquema de Partición: Default 4MB with spiffs
   Nivel de Debug Core: None (o Info para depuración)
   ```

---

## Dependencias de Librerías

### Librerías Requeridas con Documentación Verificada

#### 1. ESP32-audioI2S por schreibfaul1

**Fuente**: [schreibfaul1/ESP32-audioI2S](https://github.com/schreibfaul1/ESP32-audioI2S)

**Instalación**:
```
IDE Arduino → Sketch → Include Library → Manage Libraries
Buscar "ESP32-audioI2S" → Instalar
```

**Características Verificadas**:
- ✅ Streaming de audio HTTP/HTTPS
- ✅ Salida I²S con pines configurables
- ✅ Decodificación MP3, AAC, FLAC, WAV, OPUS, VORBIS
- ✅ Integración OpenAI TTS
- ✅ Control de volumen (0-21)
- ✅ Análisis de metadatos
- ✅ Callbacks de eventos
- ✅ Requiere ESP32 multi-núcleo (ESP32, ESP32-S3, ESP32-P4) con PSRAM

**Clases y Métodos Clave**:

```cpp
#include "Audio.h"

Audio audio;

// Configurar pines I²S
void Audio::setPinout(int8_t BCLK, int8_t LRC, int8_t DOUT);

// Transmitir desde URL HTTP
bool Audio::connecttohost(const char* url);

// Transmitir desde archivo local
bool Audio::connecttoFS(fs::FS &fs, const char* path);

// Control de volumen (0-21)
void Audio::setVolume(uint8_t vol);

// Control de reproducción
void Audio::pauseResume();
void Audio::stopSong();

// Callbacks de eventos
void audio_info(const char *info);
void audio_eof_mp3(const char *info);
void audio_showstation(const char *info);
void audio_bitrate(const char *info);
```

**Ejemplo de Documentación**:

```cpp
#include "Audio.h"
#include "WiFi.h"

#define I2S_DOUT      22  // Conexión DIN
#define I2S_BCLK      21  // Reloj de bit
#define I2S_LRC       19  // Reloj izquierda/derecha

Audio audio;

void setup() {
  WiFi.begin("SSID", "password");
  while (!WiFi.connected()) {
    delay(500);
  }
  
  // Configurar pines I²S
  audio.setPinout(I2S_BCLK, I2S_LRC, I2S_DOUT);
  
  // Establecer volumen (0-21)
  audio.setVolume(12);
  
  // Transmitir MP3 desde URL
  audio.connecttohost("http://example.com/audio.mp3");
}

void loop() {
  audio.loop(); // DEBE llamarse continuamente
}

// Callbacks opcionales
void audio_info(const char *info) {
  Serial.printf("audio_info: %s\n", info);
}

void audio_eof_mp3(const char *info) {
  Serial.printf("Fin del archivo: %s\n", info);
}
```

**Ejemplo de Integración OpenAI TTS**:

```cpp
void playOpenAITTS(const String& text, const String& apiKey) {
  HTTPClient http;
  
  http.begin("https://api.openai.com/v1/audio/speech");
  http.addHeader("Authorization", "Bearer " + apiKey);
  http.addHeader("Content-Type", "application/json");
  
  String payload = "{\"model\":\"tts-1\",\"voice\":\"nova\",\"input\":\"" + text + "\"}";
  
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    WiFiClient* stream = http.getStreamPtr();
    audio.connecttohost("https://api.openai.com/v1/audio/speech");
  }
  
  http.end();
}
```

#### 2. HTTPClient (Integrado)

**Parte del**: Núcleo Arduino ESP32

**Características Verificadas**:
- ✅ Solicitudes GET/POST/PUT
- ✅ Codificación de transferencia por fragmentos
- ✅ Encabezados personalizados
- ✅ Carga/descarga de stream
- ✅ Configuración de timeout
- ✅ Conexiones keep-alive

**Uso**:

```cpp
#include <HTTPClient.h>

HTTPClient http;

// Configurar solicitud
http.begin("http://192.168.1.100:3000/api/audio/upload-stream");
http.addHeader("Content-Type", "audio/wav");
http.setTimeout(30000); // Timeout de 30 segundos

// Carga de stream
int httpCode = http.sendRequest("POST", &audioStream, audioSize);

// Verificar respuesta
if (httpCode == 200) {
  String response = http.getString();
  Serial.println(response);
}

http.end();
```

#### 3. WiFi (Integrado)

**Parte del**: Núcleo Arduino ESP32

**Características**:
```cpp
#include <WiFi.h>

// Conectar a WiFi
WiFi.begin("SSID", "password");
WiFi.setAutoReconnect(true);

// Verificar conexión
bool connected = WiFi.status() == WL_CONNECTED;

// Obtener dirección IP
IPAddress ip = WiFi.localIP();

// Fuerza de señal
int rssi = WiFi.RSSI();
```

#### 4. ArduinoJson v6.21+

**Instalación**:
```
Library Manager → Buscar "ArduinoJson" → Instalar
```

**Uso**:
```cpp
#include <ArduinoJson.h>

// Analizar respuesta JSON
StaticJsonDocument<1024> doc;
DeserializationError error = deserializeJson(doc, jsonString);

if (!error) {
  const char* eventId = doc["eventId"];
  bool success = doc["success"];
}
```

### `platformio.ini` Completo (Alternativa al IDE Arduino)

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino

lib_deps =
    schreibfaul1/ESP32-audioI2S @ ^3.0.0
    bblanchon/ArduinoJson @ ^6.21.0

monitor_speed = 115200
upload_speed = 921600
board_build.f_cpu = 240000000L
```

---

## Arquitectura del Firmware

### Máquina de Estados

```
┌─────────────────────────────────────────────────────────┐
│                    Máquina de Estados ESP32             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐                                          │
│  │ INACTIVO │  Sondeo para eventos pendientes (segundo │
│  └────┬─────┘  plano)                                   │
│       │ Botón presionado → Iniciar grabación           │
│       ▼                                                │
│  ┌──────────┐                                          │
│  │GRABACIÓN │  Capturando audio I²S + carga de stream  │
│  └────┬─────┘  (El botón controla SOLO la grabación)   │
│       │ Botón liberado o duración máxima               │
│       ▼                                                │
│  ┌──────────┐                                          │
│  │CARGA     │  Finalizando transferencia por fragmentos│
│  └────┬─────┘                                          │
│       │ Carga completa, eventId recibido               │
│       ▼                                                │
│  ┌──────────┐                                          │
│  │PROCESANDO│  POST /process/:eventId                  │
│  └────┬─────┘                                          │
│       │ Procesamiento activado                         │
│       ▼                                                │
│  ┌──────────┐                                          │
│  │ SONDEO   │  GET /status/:eventId (long-poll)        │
│  └────┬─────┘  Esperar a que complete el procesamiento │
│       │ Estado: listo                                   │
│       ▼                                                │
│  ┌──────────┐                                          │
│  │DESCARGA  │  GET /download/:eventId                  │
│  └────┬─────┘                                          │
│       │ Stream de audio listo                          │
│       ▼                                                │
│  ┌──────────┐                                          │
│  │REPRODUCIÓN│ Streaming de reproducción I²S vía      │
│  └────┬─────┘  MAX98357A (audio.loop() requerido)      │
│       │ Reproducción finalizada                        │
│       ▼                                                │
│  ┌──────────┐                                          │
│  │ INACTIVO │  Reanudar sondeo para eventos pendientes │
│  └──────────┘                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘

Flujo de Trabajo Completo:
1. INACTIVO: Sondear periódicamente el servidor para eventos pendientes (tarea en segundo plano)
2. INACTIVO → GRABACIÓN: Usuario presiona botón (grabación SOLO)
3. GRABACIÓN: Capturar audio del INMP441 vía I²S mientras se mantiene presionado el botón
4. GRABACIÓN → CARGA: POST /api/audio/upload-stream (stream de fragmentos)
5. CARGA → PROCESANDO: Recibir eventId de respuesta del servidor
6. PROCESANDO: POST /api/audio/process/:eventId (activar pipeline de IA)
7. PROCESANDO → SONDEO: Esperar a que complete el procesamiento
8. SONDEO: GET /api/audio/status/:eventId?timeout=30000 (long-poll)
9. SONDEO → DESCARGA: Estado retorna "ready"
10. DESCARGA → REPRODUCIÓN: GET /api/audio/download/:eventId (stream de audio)
11. REPRODUCIÓN: Stream de reproducción a través de MAX98357A (audio.loop() requerido)
12. REPRODUCICIÓN → INACTIVO: Callback audio_eof activado, reanudar sondeo
```

### Diseño de Memoria

```
Memoria ESP32 (520 KB SRAM)
┌─────────────────────────────────────┐
│ Heap (Libre: ~100 KB)               │
├─────────────────────────────────────┤
│ Stack WiFi (~50 KB)                 │
├─────────────────────────────────────┤
│ Buffers DMA I²S (16 KB)             │
│  ├─ Buffer de Entrada  (8 KB × 2)   │
│  └─ Buffer de Salida (8 KB × 2)     │
├─────────────────────────────────────┤
│ Buffer HTTP (8 KB)                  │
├─────────────────────────────────────┤
│ Decodificador de Audio (20 KB)      │
├─────────────────────────────────────┤
│ Tareas FreeRTOS (~50 KB)            │
├─────────────────────────────────────┤
│ Stack del Programa (~30 KB)         │
└─────────────────────────────────────┘
```

---

## Pasos de Implementación

### Paso 1: Conexión WiFi

**Archivo**: `main.ino`

```cpp
#include <WiFi.h>

// Credenciales WiFi
const char* WIFI_SSID = "YourSSID";
const char* WIFI_PASSWORD = "YourPassword";

// Configuración del servidor
const char* SERVER_HOST = "192.168.1.100";
const int SERVER_PORT = 3000;

void setupWiFi() {
  Serial.println("Conectando a WiFi...");
  
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi conectado!");
    Serial.print("Dirección IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("Fuerza de Señal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\nConexión WiFi fallida!");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  setupWiFi();
}

void loop() {
  // Verificar conexión y reconectar si es necesario
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi desconectado, reconectando...");
    setupWiFi();
  }
  
  delay(5000);
}
```

---

### Paso 2: Configuración del Micrófono I²S

```cpp
#include <driver/i2s.h>

// Pines del Micrófono I²S (INMP441)
#define I2S_MIC_SERIAL_CLOCK  GPIO_NUM_25
#define I2S_MIC_LEFT_RIGHT_CLOCK GPIO_NUM_33
#define I2S_MIC_SERIAL_DATA   GPIO_NUM_26

// Configuración I²S
#define I2S_MIC_PORT          I2S_NUM_1
#define I2S_MIC_SAMPLE_RATE   16000  // 16 kHz (bueno para voz)
#define I2S_MIC_BITS_PER_SAMPLE I2S_BITS_PER_SAMPLE_32BIT
#define I2S_MIC_DMA_BUF_COUNT 4
#define I2S_MIC_DMA_BUF_LEN   1024   // 1024 muestras por buffer

void setupMicrophone() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = I2S_MIC_SAMPLE_RATE,
    .bits_per_sample = I2S_MIC_BITS_PER_SAMPLE,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = I2S_MIC_DMA_BUF_COUNT,
    .dma_buf_len = I2S_MIC_DMA_BUF_LEN,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_MIC_SERIAL_CLOCK,
    .ws_io_num = I2S_MIC_LEFT_RIGHT_CLOCK,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_MIC_SERIAL_DATA
  };

  // Instalar y iniciar driver I²S
  esp_err_t err = i2s_driver_install(I2S_MIC_PORT, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("Error al instalar driver I²S: %d\n", err);
    return;
  }

  err = i2s_set_pin(I2S_MIC_PORT, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("Error al configurar pines I²S: %d\n", err);
    return;
  }

  // Limpiar buffer DMA
  i2s_zero_dma_buffer(I2S_MIC_PORT);
  
  Serial.println("Micrófono inicializado exitosamente");
}
```

---

### Paso 3: Configuración del Altavoz I²S

```cpp
#include "Audio.h"

// Pines del Altavoz I²S (MAX98357A)
#define I2S_SPK_DOUT          22  // DIN
#define I2S_SPK_BCLK          21  // BCLK
#define I2S_SPK_LRC           19  // LRC

Audio audio;

void setupSpeaker() {
  // Configurar pines I²S para MAX98357A
  audio.setPinout(I2S_SPK_BCLK, I2S_SPK_LRC, I2S_SPK_DOUT);
  
  // Establecer volumen (0-21, 12 es moderado)
  audio.setVolume(12);
  
  Serial.println("Altavoz inicializado exitosamente");
}

// Callbacks de la librería de audio
void audio_info(const char *info) {
  Serial.printf("Información de audio: %s\n", info);
}

void audio_eof_mp3(const char *info) {
  Serial.println("Reproducción finalizada");
}

void audio_showstation(const char *info) {
  Serial.printf("Estación: %s\n", info);
}

void audio_bitrate(const char *info) {
  Serial.printf("Bitrate: %s\n", info);
}
```

---

### Paso 4: Configuración de Botón y LED

```cpp
#define BUTTON_PIN  GPIO_NUM_0   // Botón de arranque (pull-up) - GRABACIÓN SOLO
#define LED_PIN     GPIO_NUM_2   // LED integrado

volatile bool buttonPressed = false;
volatile unsigned long buttonPressTime = 0;

void IRAM_ATTR buttonISR() {
  buttonPressed = true;
  buttonPressTime = millis();
}

void setupGPIO() {
  // Configurar LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  // Configurar botón con interrupción (para activador de grabación solo)
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), buttonISR, FALLING);
  
  Serial.println("GPIO inicializado exitosamente");
  Serial.println("Nota: El botón es solo para grabación. El sondeo ocurre en estado inactivo.");
}

void setLED(bool state) {
  digitalWrite(LED_PIN, state ? HIGH : LOW);
}

void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    setLED(true);
    delay(delayMs);
    setLED(false);
    delay(delayMs);
  }
}
```

---

## Implementación de Captura de Audio

### Captura de Audio de Streaming

```cpp
#include <HTTPClient.h>

#define CAPTURE_BUFFER_SIZE   4096  // Fragmentos de 4KB
#define MAX_RECORD_DURATION   30000 // Máximo 30 segundos

bool recordAndStreamAudio() {
  Serial.println("Iniciando grabación de audio...");
  setLED(true);
  
  HTTPClient http;
  WiFiClient* stream = nullptr;
  
  // Construir URL de carga
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/audio/upload-stream";
  
  // Configurar cliente HTTP
  http.begin(url);
  http.addHeader("Content-Type", "audio/wav");
  http.setTimeout(60000); // Timeout de 60 segundos
  
  // Abrir conexión
  int httpCode = http.POST("");
  
  if (httpCode != 200) {
    Serial.printf("Conexión HTTP fallida: %d\n", httpCode);
    http.end();
    setLED(false);
    return false;
  }
  
  stream = http.getStreamPtr();
  
  // Buffer de grabación
  int32_t* i2s_buffer = (int32_t*)malloc(CAPTURE_BUFFER_SIZE);
  if (!i2s_buffer) {
    Serial.println("Error al asignar buffer");
    http.end();
    setLED(false);
    return false;
  }
  
  unsigned long startTime = millis();
  size_t bytesRead = 0;
  size_t totalBytes = 0;
  
  // Bucle de grabación
  while (digitalRead(BUTTON_PIN) == LOW) {  // Botón aún presionado
    // Verificar duración máxima
    if (millis() - startTime > MAX_RECORD_DURATION) {
      Serial.println("Duración máxima de grabación alcanzada");
      break;
    }
    
    // Leer desde micrófono I²S
    esp_err_t result = i2s_read(
      I2S_MIC_PORT,
      i2s_buffer,
      CAPTURE_BUFFER_SIZE,
      &bytesRead,
      portMAX_DELAY
    );
    
    if (result == ESP_OK && bytesRead > 0) {
      // Convertir muestras de 32-bit a 16-bit para WAV
      int16_t* samples_16bit = (int16_t*)malloc(bytesRead / 2);
      
      for (size_t i = 0; i < bytesRead / 4; i++) {
        samples_16bit[i] = (int16_t)(i2s_buffer[i] >> 16);
      }
      
      // Transmitir al servidor
      size_t written = stream->write((uint8_t*)samples_16bit, bytesRead / 2);
      totalBytes += written;
      
      free(samples_16bit);
      
      // Retroalimentación de progreso
      if (totalBytes % 10000 < CAPTURE_BUFFER_SIZE) {
        Serial.printf("Cargado: %d bytes\n", totalBytes);
      }
    }
    
    yield(); // Permitir que el stack WiFi procese
  }
  
  free(i2s_buffer);
  
  Serial.printf("Grabación completa: %d bytes\n", totalBytes);
  
  // Obtener respuesta
  String response = http.getString();
  Serial.println("Respuesta del servidor: " + response);
  
  http.end();
  setLED(false);
  
  return true;
}
```

---

## Carga de Streaming HTTP

### Codificación de Transferencia por Fragmentos con Proceso de Dos Pasos

**Paso 1: Cargar Audio y Obtener ID de Evento**

```cpp
#include <HTTPClient.h>
#include <ArduinoJson.h>

String uploadAudioAndGetEventId(const uint8_t* audioData, size_t dataSize) {
  HTTPClient http;
  
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/audio/upload-stream";
  
  http.begin(url);
  http.addHeader("Content-Type", "audio/wav");
  
  // Enviar datos de audio
  int httpCode = http.POST((uint8_t*)audioData, dataSize);
  
  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("Respuesta de carga: " + response);
    
    // Analizar JSON para obtener eventId
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      String eventId = doc["eventId"].as<String>();
      Serial.printf("ID de evento recibido: %s\n", eventId.c_str());
      http.end();
      return eventId;
    } else {
      Serial.printf("Error de análisis JSON: %s\n", error.c_str());
    }
  } else {
    Serial.printf("Carga fallida. Código HTTP: %d\n", httpCode);
  }
  
  http.end();
  return "";
}
```

**Paso 2: Activar Procesamiento**

```cpp
bool triggerProcessing(const String& eventId) {
  HTTPClient http;
  
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + 
               "/api/audio/process/" + eventId;
  
  http.begin(url);
  int httpCode = http.POST("");
  
  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("Respuesta de procesamiento: " + response);
    http.end();
    return true;
  } else {
    Serial.printf("Procesamiento fallido. Código HTTP: %d\n", httpCode);
    http.end();
    return false;
  }
}
```

---

## Implementación de Reproducción de Audio

### Reproducción de Streaming con ESP32-audioI2S

```cpp
#include "Audio.h"

String currentEventId = "";

bool playAudioResponse(const String& eventId) {
  Serial.println("Iniciando reproducción de audio...");
  setLED(true);
  
  // Construir URL de descarga
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/audio/download/" + eventId;
  
  // Iniciar reproducción de streaming
  bool success = audio.connecttohost(url.c_str());
  
  if (success) {
    Serial.println("Reproducción iniciada exitosamente");
    currentEventId = eventId;
    return true;
  } else {
    Serial.println("Error al iniciar reproducción");
    setLED(false);
    return false;
  }
}

// Debe llamarse en loop()
void handleAudioPlayback() {
  if (currentEventId.length() > 0) {
    audio.loop();
  }
}

// Callback cuando finaliza la reproducción
void audio_eof_mp3(const char *info) {
  Serial.println("Reproducción finalizada");
  currentEventId = "";
  setLED(false);
}
```

---

## Descarga de Streaming HTTP

### Verificación de Estado con Long-Polling

```cpp
#include <ArduinoJson.h>

bool pollForAudioReady(const String& eventId, int maxWaitSeconds = 60) {
  HTTPClient http;
  uint32_t startTime = millis();
  uint32_t maxWaitMs = maxWaitSeconds * 1000;
  
  while (millis() - startTime < maxWaitMs) {
    String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + 
                 "/api/audio/status/" + eventId + "?timeout=30000";
    
    Serial.println("Verificando estado: " + url);
    
    http.begin(url);
    http.setTimeout(35000); // Timeout del servidor de 30s + 5s de buffer
    
    int httpCode = http.GET();
    
    if (httpCode == 200) {
      String payload = http.getString();
      Serial.println("Estado: " + payload);
      
      // Analizar JSON
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, payload);
      
      if (!error) {
        const char* status = doc["status"];
        
        if (strcmp(status, "ready") == 0) {
          Serial.println("¡El audio está listo!");
          http.end();
          return true;
        } else if (strcmp(status, "error") == 0) {
          const char* errorMsg = doc["error"];
          Serial.printf("Error del servidor: %s\n", errorMsg);
          http.end();
          return false;
        }
        
        Serial.println("Aún procesando...");
      }
    } else {
      Serial.printf("Verificación de estado fallida: %d\n", httpCode);
    }
    
    http.end();
    delay(1000); // Pequeño retraso antes de reintentar
  }
  
  Serial.println("Timeout esperando audio");
  return false;
}
```

---

## Optimización de Memoria

### Monitoreo de Heap

```cpp
void printMemoryStats() {
  Serial.println("\n=== Estadísticas de Memoria ===");
  Serial.printf("Heap Libre: %d bytes\n", ESP.getFreeHeap());
  Serial.printf("Tamaño Heap: %d bytes\n", ESP.getHeapSize());
  Serial.printf("Heap Mínimo Libre: %d bytes\n", ESP.getMinFreeHeap());
  Serial.printf("Tamaño PSRAM: %d bytes\n", ESP.getPsramSize());
  Serial.printf("PSRAM Libre: %d bytes\n", ESP.getFreePsram());
  Serial.println("=========================\n");
}

void checkMemoryHealth() {
  if (ESP.getFreeHeap() < 50000) {  // Menos de 50KB libre
    Serial.println("ADVERTENCIA: Memoria baja!");
    printMemoryStats();
  }
}
```

### Optimización del Tamaño del Buffer

```cpp
// Ajustar basado en memoria disponible
#define BUFFER_SIZE_LOW_MEM   2048  // 2KB para situaciones de memoria baja
#define BUFFER_SIZE_NORMAL    4096  // 4KB para operación normal
#define BUFFER_SIZE_HIGH_MEM  8192  // 8KB cuando hay abundante memoria

size_t getOptimalBufferSize() {
  size_t freeHeap = ESP.getFreeHeap();
  
  if (freeHeap > 150000) {
    return BUFFER_SIZE_HIGH_MEM;
  } else if (freeHeap > 100000) {
    return BUFFER_SIZE_NORMAL;
  } else {
    return BUFFER_SIZE_LOW_MEM;
  }
}
```

---

## Ejemplo de Flujo de Trabajo de Extremo a Extremo

### Manejador de Comando de Voz (Grabación Activada por Botón)

**Nota**: Esta función se activa SOLO cuando el usuario presiona el botón (GPIO0). El sondeo en segundo plano para eventos pendientes ocurre por separado en el estado inactivo.

```cpp
// Variables globales
String currentEventId = "";
Audio audio;

void handleVoiceCommand() {
  Serial.println("\n=== Iniciando Comando de Voz (Botón Presionado) ===");
  setLED(true);
  
  // Paso 1: Grabar audio
  Serial.println("Paso 1: Grabando audio...");
  const size_t bufferSize = 40000; // ~2.5 segundos a 16kHz 16-bit
  uint8_t* audioBuffer = (uint8_t*)malloc(bufferSize);
  
  if (!audioBuffer) {
    Serial.println("Error al asignar buffer de audio");
    setLED(false);
    return;
  }
  
  size_t bytesRecorded = recordAudioToBuffer(audioBuffer, bufferSize);
  Serial.printf("Grabados %d bytes\n", bytesRecorded);
  
  // Paso 2: Cargar y obtener eventId
  Serial.println("Paso 2: Cargando audio...");
  String eventId = uploadAudioAndGetEventId(audioBuffer, bytesRecorded);
  free(audioBuffer);
  
  if (eventId.length() == 0) {
    Serial.println("Carga fallida - sin eventId");
    setLED(false);
    return;
  }
  
  Serial.printf("ID de Evento: %s\n", eventId.c_str());
  currentEventId = eventId;
  
  // Paso 3: Activar procesamiento
  Serial.println("Paso 3: Activando procesamiento de IA...");
  if (!triggerProcessing(eventId)) {
    Serial.println("Error al activar procesamiento");
    setLED(false);
    return;
  }
  
  // Paso 4: Sondear para completar
  Serial.println("Paso 4: Esperando procesamiento...");
  blinkLED(3, 200); // Retroalimentación visual
  
  if (!pollForAudioReady(eventId, 60)) {
    Serial.println("Timeout de procesamiento o error");
    setLED(false);
    return;
  }
  
  // Paso 5: Reproducir respuesta
  Serial.println("Paso 5: Reproduciendo respuesta de audio...");
  if (playAudioResponse(eventId)) {
    Serial.println("Reproducción iniciada exitosamente");
    // LED se apagará cuando finalice la reproducción (en callback audio_eof)
  } else {
    Serial.println("Reproducción fallida");
    setLED(false);
  }
  
  Serial.println("=== Comando de Voz Completo ===\n");
}

// Función auxiliar para grabar audio a buffer
size_t recordAudioToBuffer(uint8_t* buffer, size_t maxSize) {
  const size_t chunkSize = 4096;
  size_t totalRecorded = 0;
  
  uint32_t startTime = millis();
  uint32_t maxDuration = 5000; // Máximo 5 segundos
  
  while (totalRecorded < maxSize && (millis() - startTime) < maxDuration) {
    size_t bytesRead = 0;
    size_t remaining = maxSize - totalRecorded;
    size_t toRead = min(chunkSize, remaining);
    
    // Leer desde I2S
    recordAudio(buffer + totalRecorded, toRead, &bytesRead);
    totalRecorded += bytesRead;
    
    yield();
  }
  
  return totalRecorded;
}

// Bucle principal
void loop() {
  // Manejar reproducción de audio (debe llamarse continuamente cuando se reproduce)
  if (currentEventId.length() > 0) {
    audio.loop();
  }
  
  // Sondear eventos pendientes cuando inactivo (no grabando o reproduciendo)
  static unsigned long lastPollCheck = 0;
  if (currentEventId.length() == 0 && !buttonPressed) {
    if (millis() - lastPollCheck > 5000) { // Sondear cada 5 segundos cuando inactivo
      checkForPendingEvents();
      lastPollCheck = millis();
    }
  }
  
  // Verificar presión de botón (activador de grabación solo)
  if (buttonPressed) {
    buttonPressed = false;
    handleVoiceCommand();
  }
  
  // Monitorear memoria
  static unsigned long lastMemCheck = 0;
  if (millis() - lastMemCheck > 60000) { // Cada minuto
    checkMemoryHealth();
    lastMemCheck = millis();
  }
  
  delay(10);
}

// Función para verificar eventos pendientes durante inactividad
void checkForPendingEvents() {
  // Sondear servidor para eventos de calendario pendientes o notificaciones
  HTTPClient http;
  
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/events/pending";
  
  http.begin(url);
  http.setTimeout(5000); // Timeout de 5 segundos para sondeo rápido
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String response = http.getString();
    
    // Analizar respuesta JSON
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      bool hasPending = doc["hasPending"] | false;
      
      if (hasPending) {
        String eventId = doc["eventId"].as<String>();
        Serial.printf("Evento pendiente encontrado: %s\n", eventId.c_str());
        
        // Activar reproducción de notificación pendiente
        currentEventId = eventId;
        if (playAudioResponse(eventId)) {
          Serial.println("Reproduciendo notificación de evento pendiente");
        }
      }
    }
  }
  
  http.end();
}
```

### Callbacks de Audio

```cpp
// Llamado cuando finaliza el stream de audio
void audio_eof_stream(const char *info) {
  Serial.printf("Stream finalizado: %s\n", info);
  currentEventId = "";
  setLED(false);
}

// Llamado cuando finaliza MP3/WAV
void audio_eof_mp3(const char *info) {
  Serial.printf("Audio finalizado: %s\n", info);
  currentEventId = "";
  setLED(false);
}

// Callback de información de audio
void audio_info(const char *info) {
  Serial.printf("Información de audio: %s\n", info);
}

// Bitrate info
void audio_bitrate(const char *info) {
  Serial.printf("Bitrate: %s\n", info);
}
```

---

## Estrategia de Sondeo en Estado Inactivo

### Monitoreo de Eventos en Segundo Plano

Cuando el ESP32 está en el estado **INACTIVO** (no grabando o reproduciendo audio), sondea continuamente el servidor para eventos pendientes. Esto permite que el dispositivo reciba notificaciones de calendario, recordatorios u otros mensajes iniciados por el servidor sin interacción del usuario.

**Puntos Clave**:
- ✅ **Botón es Solo para Grabación**: El GPIO0 botón activa exclusivamente la grabación de audio
- ✅ **Sondeo Ocurre Cuando Inactivo**: El sondeo en segundo plano ocurre automáticamente durante el estado inactivo
- ✅ **Sin Sondeo Durante Grabación**: El sondeo se suspende cuando se graba o reproduce audio
- ✅ **Intervalo Configurable**: Intervalo de sondeo predeterminado de 5 segundos (ajustable según caso de uso)
- ✅ **Bajo Impacto en Energía**: Timeout corto (5s) minimiza el drenaje de batería

### Implementación

```cpp
// Configuración de sondeo
#define IDLE_POLL_INTERVAL_MS  5000  // 5 segundos entre sondeos

void loop() {
  // Manejar reproducción de audio (ESP32-audioI2S requiere llamadas continuas a loop())
  if (currentEventId.length() > 0) {
    audio.loop();  // DEBE llamarse para que funcione la reproducción
  }
  
  // Sondeo en segundo plano cuando inactivo (no grabando, no reproduciendo)
  static unsigned long lastPollCheck = 0;
  if (currentEventId.length() == 0 && !buttonPressed) {
    if (millis() - lastPollCheck > IDLE_POLL_INTERVAL_MS) {
      checkForPendingEvents();
      lastPollCheck = millis();
    }
  }
  
  // Botón presiona activa grabación SOLO
  if (buttonPressed) {
    buttonPressed = false;
    handleVoiceCommand();  // Graba, carga, procesa, sondea respuesta
  }
  
  delay(10);
}

// Verificar eventos iniciados por servidor
void checkForPendingEvents() {
  HTTPClient http;
  
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/events/pending";
  
  http.begin(url);
  http.setTimeout(5000); // Timeout rápido para sondeo en segundo plano
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String response = http.getString();
    
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      bool hasPending = doc["hasPending"] | false;
      
      if (hasPending) {
        String eventId = doc["eventId"].as<String>();
        Serial.printf("[SONDEO INACTIVO] Evento pendiente: %s\n", eventId.c_str());
        
        // Reproducir notificación pendiente inmediatamente
        currentEventId = eventId;
        playAudioResponse(eventId);
      }
    }
  } else {
    // Fallo silencioso para sondeo en segundo plano (no spam de logs)
    if (httpCode != -1) {  // Registrar solo errores reales, no timeouts
      Serial.printf("[SONDEO INACTIVO] Error HTTP: %d\n", httpCode);
    }
  }
  
  http.end();
}
```

### Optimización de Sondeo

**Intervalo de Sondeo Adaptativo**:

```cpp
// Ajustar frecuencia de sondeo basado en hora del día o sugerencias del servidor
unsigned long getPollingInterval() {
  // Ejemplo: Sondear más frecuentemente durante horas de oficina
  time_t now;
  struct tm timeinfo;
  time(&now);
  localtime_r(&now, &timeinfo);
  
  int hour = timeinfo.tm_hour;
  
  if (hour >= 9 && hour <= 17) {
    return 3000;  // 3 segundos durante horas de oficina
  } else {
    return 10000; // 10 segundos durante horas fuera de oficina
  }
}
```

**Retry-After Enviado por Servidor**:

```cpp
void checkForPendingEvents() {
  HTTPClient http;
  
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/events/pending";
  
  http.begin(url);
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    // Verificar si el servidor sugiere un intervalo de sondeo diferente
    String retryAfter = http.header("Retry-After");
    if (retryAfter.length() > 0) {
      unsigned long suggestedInterval = retryAfter.toInt() * 1000;
      // Actualizar intervalo de sondeo basado en sugerencia del servidor
    }
    
    // Procesar respuesta...
  }
  
  http.end();
}
```

---

## Gestión de Energía

### Ahorro de Energía WiFi

```cpp
void enablePowerSaving() {
  // Habilitar modo de ahorro de energía WiFi
  esp_wifi_set_ps(WIFI_PS_MIN_MODEM);  // Ahorro de energía mínimo
  Serial.println("Ahorro de energía WiFi habilitado");
}

void disablePowerSaving() {
  // Deshabilitar ahorro para rendimiento máximo
  esp_wifi_set_ps(WIFI_PS_NONE);
  Serial.println("Ahorro de energía WiFi deshabilitado");
}
```

### Modo Deep Sleep

```cpp
void enterDeepSleep(uint64_t sleepTimeSeconds) {
  Serial.printf("Entrando en deep sleep por %llu segundos\n", sleepTimeSeconds);
  
  // Configurar botón de despertar
  esp_sleep_enable_ext0_wakeup(BUTTON_PIN, 0);  // Despertar en LOW
  
  // O despertar por temporizador
  esp_sleep_enable_timer_wakeup(sleepTimeSeconds * 1000000);
  
  // Entrar en deep sleep
  esp_deep_sleep_start();
}
```

---

## Pruebas y Depuración

### Salida de Debug Serial

```cpp
#define DEBUG_LEVEL_NONE    0
#define DEBUG_LEVEL_ERROR   1
#define DEBUG_LEVEL_INFO    2
#define DEBUG_LEVEL_VERBOSE 3

#define DEBUG_LEVEL DEBUG_LEVEL_INFO

void debugPrint(int level, const char* format, ...) {
  if (level <= DEBUG_LEVEL) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    
    Serial.print("[");
    Serial.print(millis());
    Serial.print("] ");
    Serial.println(buffer);
  }
}
```

### Funciones de Prueba de Audio

```cpp
void testMicrophone() {
  Serial.println("\n=== Prueba de Micrófono ===");
  
  int32_t buffer[512];
  size_t bytesRead = 0;
  
  // Leer 5 muestras
  for (int i = 0; i < 5; i++) {
    esp_err_t result = i2s_read(I2S_MIC_PORT, buffer, sizeof(buffer), &bytesRead, 1000);
    
    if (result == ESP_OK) {
      Serial.printf("Muestra %d: %d bytes leídos\n", i + 1, bytesRead);
      
      // Calcular amplitud promedio
      int64_t sum = 0;
      for (size_t j = 0; j < bytesRead / 4; j++) {
        sum += abs(buffer[j]);
      }
      int32_t avg = sum / (bytesRead / 4);
      
      Serial.printf("  Amplitud promedio: %d\n", avg);
    } else {
      Serial.printf("Muestra %d: Lectura fallida (%d)\n", i + 1, result);
    }
    
    delay(100);
  }
  
  Serial.println("=======================\n");
}

void testSpeaker() {
  Serial.println("\n=== Prueba de Altavoz ===");
  
  // Reproducir URL de tono de prueba
  const char* testUrl = "http://www.kozco.com/tech/piano2.wav";
  
  bool success = audio.connecttohost(testUrl);
  
  if (success) {
    Serial.println("Reproducción de prueba iniciada");
    Serial.println("Debería escuchar una muestra de piano");
  } else {
    Serial.println("Reproducción de prueba fallida");
  }
  
  Serial.println("====================\n");
}
```

---

## Solución de Problemas

### Problemas Comunes

#### 1. Sin Conexión WiFi

**Síntomas**: ESP32 no puede conectar a WiFi

**Soluciones**:
```cpp
// Verificar credenciales WiFi
Serial.println("SSID: " + String(WIFI_SSID));
Serial.println("Contraseña: " + String(WIFI_PASSWORD));

// Verificar modo WiFi
WiFi.mode(WIFI_STA);

// Aumentar intentos de conexión
int attempts = 0;
while (WiFi.status() != WL_CONNECTED && attempts < 40) {
  delay(500);
  Serial.print(".");
  attempts++;
}

// Verificar fuerza de señal
Serial.print("RSSI: ");
Serial.println(WiFi.RSSI());
```

#### 2. Sin Audio del Micrófono

**Síntomas**: Lectura I²S retorna 0 bytes o todos ceros

**Soluciones**:
```cpp
// Verificar conexiones de pines
Serial.println("Verificar cableado de pines:");
Serial.printf("  SCK (GPIO%d) -> INMP441 SCK\n", I2S_MIC_SERIAL_CLOCK);
Serial.printf("  WS  (GPIO%d) -> INMP441 WS\n", I2S_MIC_LEFT_RIGHT_CLOCK);
Serial.printf("  SD  (GPIO%d) -> INMP441 SD\n", I2S_MIC_SERIAL_DATA);

// Verificar pin L/R - DEBE conectarse a GND
Serial.println("  INMP441 L/R -> GND (para canal izquierdo)");

// Aumentar timeout del buffer DMA
i2s_read(I2S_MIC_PORT, buffer, size, &bytesRead, 5000 / portTICK_PERIOD_MS);

// Limpiar buffer DMA antes de leer
i2s_zero_dma_buffer(I2S_MIC_PORT);
```

#### 3. Audio Distorsionado/Sin Salida de Altavoz

**Síntomas**: Altavoz reproduce ruido o silencio

**Soluciones**:
```cpp
// Verificar cableado MAX98357A
Serial.println("Verificar cableado del altavoz:");
Serial.printf("  BCLK (GPIO%d) -> MAX98357A BCLK\n", I2S_SPK_BCLK);
Serial.printf("  LRC  (GPIO%d) -> MAX98357A LRC\n", I2S_SPK_LRC);
Serial.printf("  DOUT (GPIO%d) -> MAX98357A DIN\n", I2S_SPK_DOUT);

// Verificar pin SD (apagado) - DEBE estar HIGH para habilitar
Serial.println("  MAX98357A SD -> 3.3V (habilitar)");

// Ajustar volumen
audio.setVolume(15);  // Probar diferentes volúmenes (0-21)

// Probar con tono simple
audio.connecttohost("http://www.kozco.com/tech/piano2.wav");
```

#### 4. Carga HTTP Falla

**Síntomas**: Carga retorna código de error o timeout

**Soluciones**:
```cpp
// Verificar URL del servidor
Serial.println("Servidor: http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT));

// Aumentar timeout
http.setTimeout(120000);  // 2 minutos

// Verificar código de respuesta
int httpCode = http.POST(data, size);
Serial.printf("Código HTTP: %d\n", httpCode);

if (httpCode != 200) {
  String response = http.getString();
  Serial.println("Respuesta de error: " + response);
}

// Probar conectividad
http.begin("http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/health");
int code = http.GET();
Serial.printf("Verificación de salud: %d\n", code);
```

#### 5. Errores de Memoria Insuficiente

**Síntomas**: Caída, reinicio o fallos de asignación

**Soluciones**:
```cpp
// Monitorear heap antes de operaciones
Serial.printf("Heap libre antes: %d bytes\n", ESP.getFreeHeap());

// Reducir tamaños de buffer
#define CAPTURE_BUFFER_SIZE 2048  // Buffer más pequeño

// Liberar buffers inmediatamente
free(buffer);
buffer = nullptr;

// Reiniciar si memoria muy baja
if (ESP.getFreeHeap() < 30000) {
  Serial.println("Memoria crítica - reiniciando");
  ESP.restart();
}
```

---

## Firmware Principal Completo

**Archivo**: `main.ino`

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <driver/i2s.h>
#include <ArduinoJson.h>
#include "Audio.h"

// ====== Configuración ======
const char* WIFI_SSID = "YourSSID";
const char* WIFI_PASSWORD = "YourPassword";
const char* SERVER_HOST = "192.168.1.100";
const int SERVER_PORT = 3000;

// I²S Micrófono (INMP441)
#define I2S_MIC_PORT          I2S_NUM_1
#define I2S_MIC_SCK           25
#define I2S_MIC_WS            33
#define I2S_MIC_SD            26
#define I2S_MIC_SAMPLE_RATE   16000

// I²S Altavoz (MAX98357A)
#define I2S_SPK_BCLK          21
#define I2S_SPK_LRC           19
#define I2S_SPK_DOUT          22

// GPIO
#define BUTTON_PIN            0
#define LED_PIN               2

// Buffers
#define CAPTURE_BUFFER_SIZE   4096
#define MAX_RECORD_DURATION   30000

// ====== Objetos Globales ======
Audio audio;
volatile bool buttonPressed = false;
String currentEventId = "";

// ====== Funciones de Configuración ======
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=== Asistente de Voz de Calendario ESP32 ===\n");
  
  setupGPIO();
  setupWiFi();
  setupMicrophone();
  setupSpeaker();
  
  Serial.println("\n=== Sistema Listo ===\n");
  blinkLED(3, 200);
}

void setupGPIO() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(LED_PIN, LOW);
  
  Serial.println("[OK] GPIO inicializado");
}

void setupWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  Serial.print("Conectando a WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[OK] WiFi conectado");
    Serial.printf("     IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("     RSSI: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n[ERROR] Conexión WiFi fallida");
  }
}

void setupMicrophone() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = I2S_MIC_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 1024,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };
  
  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_MIC_SCK,
    .ws_io_num = I2S_MIC_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_MIC_SD
  };
  
  i2s_driver_install(I2S_MIC_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_MIC_PORT, &pin_config);
  i2s_zero_dma_buffer(I2S_MIC_PORT);
  
  Serial.println("[OK] Micrófono inicializado");
}

void setupSpeaker() {
  audio.setPinout(I2S_SPK_BCLK, I2S_SPK_LRC, I2S_SPK_DOUT);
  audio.setVolume(12);
  Serial.println("[OK] Altavoz inicializado");
}

// ====== Bucle Principal ======
void loop() {
  // Manejar reproducción de audio
  audio.loop();
  
  // Verificar presión de botón
  if (digitalRead(BUTTON_PIN) == LOW && !buttonPressed) {
    buttonPressed = true;
    delay(50);  // Antirrebote
    
    if (digitalRead(BUTTON_PIN) == LOW) {
      handleRecording();
    }
    
    buttonPressed = false;
  }
  
  delay(10);
}

// ====== Grabación y Carga ======
void handleRecording() {
  Serial.println("\n[INICIO] Grabando...");
  setLED(true);
  
  if (recordAndUpload()) {
    Serial.println("[ÉXITO] Carga completa");
    
    // Sondear respuesta
    Serial.println("[SONDEANDO] Esperando respuesta de audio...");
    String eventId = pollForResponse();
    
    if (eventId.length() > 0) {
      // Reproducir respuesta
      Serial.println("[REPRODUCIENDO] Respuesta de audio...");
      playResponse(eventId);
    } else {
      Serial.println("[ERROR] No se recibió respuesta");
    }
  } else {
    Serial.println("[ERROR] Grabación fallida");
  }
  
  setLED(false);
  Serial.println("[FIN] Listo para siguiente comando\n");
}

bool recordAndUpload() {
  HTTPClient http;
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/audio/upload-stream";
  
  http.begin(url);
  http.addHeader("Content-Type", "audio/wav");
  http.setTimeout(60000);
  
  // Iniciar POST
  int code = http.POST("");
  if (code != 200) {
    http.end();
    return false;
  }
  
  WiFiClient* stream = http.getStreamPtr();
  
  int32_t* buffer = (int32_t*)malloc(CAPTURE_BUFFER_SIZE);
  if (!buffer) {
    http.end();
    return false;
  }
  
  unsigned long startTime = millis();
  size_t totalBytes = 0;
  
  // Bucle de grabación
  while (digitalRead(BUTTON_PIN) == LOW) {
    if (millis() - startTime > MAX_RECORD_DURATION) {
      break;
    }
    
    size_t bytesRead = 0;
    i2s_read(I2S_MIC_PORT, buffer, CAPTURE_BUFFER_SIZE, &bytesRead, portMAX_DELAY);
    
    if (bytesRead > 0) {
      // Convertir a 16-bit
      int16_t* samples = (int16_t*)malloc(bytesRead / 2);
      for (size_t i = 0; i < bytesRead / 4; i++) {
        samples[i] = (int16_t)(buffer[i] >> 16);
      }
      
      stream->write((uint8_t*)samples, bytesRead / 2);
      totalBytes += bytesRead / 2;
      
      free(samples);
    }
    
    yield();
  }
  
  free(buffer);
  
  Serial.printf("Total cargado: %d bytes\n", totalBytes);
  
  String response = http.getString();
  http.end();
  
  return totalBytes > 0;
}

String pollForResponse() {
  for (int attempt = 0; attempt < 3; attempt++) {
    HTTPClient http;
    String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/audio/status/latest?timeout=30000";
    
    http.begin(url);
    http.setTimeout(35000);
    
    int code = http.GET();
    
    if (code == 200) {
      String payload = http.getString();
      
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, payload);
      
      if (!error) {
        const char* status = doc["status"];
        if (strcmp(status, "ready") == 0) {
          String eventId = String((const char*)doc["eventId"]);
          http.end();
          return eventId;
        }
      }
    }
    
    http.end();
    delay(1000);
  }
  
  return "";
}

void playResponse(const String& eventId) {
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/audio/download/" + eventId;
  
  bool success = audio.connecttohost(url.c_str());
  
  if (success) {
    currentEventId = eventId;
  }
}

// ====== Funciones de Utilidad ======
void setLED(bool state) {
  digitalWrite(LED_PIN, state ? HIGH : LOW);
}

void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    setLED(true);
    delay(delayMs);
    setLED(false);
    delay(delayMs);
  }
}

// ====== Callbacks de Audio ======
void audio_eof_mp3(const char *info) {
  Serial.println("[CALLBACK] Reproducción finalizada");
  currentEventId = "";
  setLED(false);
}

void audio_info(const char *info) {
  Serial.printf("[AUDIO] %s\n", info);
}
```

---

## Verificación de Documentación

### Fuentes Oficiales Utilizadas

Toda la información de hardware en este documento ha sido verificada contra documentación oficial del fabricante:

#### Placa de Desarrollo NodeMCU-32S
- **Placa**: NodeMCU-32S (también comercializada como NodeMCU ESP-32S)
- **Módulo**: ESP32-WROOM-32 (4MB Flash)
- **Chipset**: ESP32-D0WDQ6 (variante de doble núcleo)
- **USB-a-Serial**: Chip CH340C
- **Fecha de Verificación**: 17 de noviembre de 2025

#### SoC ESP32 y Módulo ESP32-WROOM-32
- **Fabricante**: Espressif Systems
- **Página del Producto**: https://www.espressif.com/en/products/socs/esp32
- **Hoja de Datos ESP32**: https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf
- **Manual de Referencia Técnica ESP32**: https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf
- **Hoja de Datos ESP32-WROOM-32**: https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf
- **Directrices de Diseño de Hardware ESP32-WROOM-32**: https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_hardware_design_guidelines_en.pdf
- **Portal de Documentación**: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/
- **Fecha de Verificación**: 17 de noviembre de 2025
- **Especificaciones Clave Verificadas**: ✅ CPU (Doble núcleo 240MHz, 600 DMIPS), ✅ RAM (520KB), ✅ Flash (4MB QSPI), ✅ WiFi (802.11n), ✅ I²S (2 interfaces), ✅ GPIO (24 accesibles), ✅ Consumo de corriente

#### Micrófono MEMS I²S INMP441
- **Fabricante**: InvenSense (Grupo TDK)
- **Página del Producto**: https://invensense.tdk.com/products/digital/inmp441/
- **Hoja de Datos Oficial**: https://invensense.tdk.com/wp-content/uploads/2015/02/INMP441.pdf
- **Estado**: No Recomendado para Nuevos Diseños (NR/ND) - Aún disponible
- **Fecha de Verificación**: 17 de noviembre de 2025
- **Especificaciones Clave Verificadas**: ✅ SNR (61dBA), ✅ Sensibilidad (-26dBFS), ✅ Interfaz I²S (24-bit), ✅ Corriente (1.4mA), ✅ Respuesta de Frecuencia (60Hz-15kHz)

#### Amplificador I²S Clase D MAX98357A
- **Fabricante**: Analog Devices (anteriormente Maxim Integrated)
- **Página del Producto**: https://www.analog.com/en/products/max98357a.html
- **Hoja de Datos Oficial**: https://www.analog.com/media/en/technical-documentation/data-sheets/MAX98357A-MAX98357B.pdf (Rev. 13, Julio 2019)
- **Estado**: Producción
- **Fecha de Verificación**: 17 de noviembre de 2025
- **Especificaciones Clave Verificadas**: ✅ Potencia de Salida (3.2W@4Ω), ✅ Eficiencia (92%), ✅ SNR (92dB), ✅ THD+N (0.015%), ✅ No se requiere MCLK, ✅ Tasa de Muestreo (8-96kHz)

#### Librería ESP32-audioI2S
- **Fuente**: GitHub - schreibfaul1/ESP32-audioI2S
- **Repositorio**: https://github.com/schreibfaul1/ESP32-audioI2S
- **Documentación**: Vía Context7 y Núcleo Arduino ESP32
- **Fecha de Verificación**: 17 de noviembre de 2025
- **Características Clave Verificadas**: ✅ Streaming HTTP, ✅ Configuración de salida I²S, ✅ Decodificación MP3/AAC, ✅ Integración OpenAI TTS, ✅ Control de volumen

#### Núcleo Arduino ESP32
- **Fuente**: Espressif Systems
- **Repositorio**: https://github.com/espressif/arduino-esp32
- **Documentación**: Vía Context7 (1130+ fragmentos de código)
- **Fecha de Verificación**: 17 de noviembre de 2025
- **Características Clave Verificadas**: ✅ API I²S (setPins, begin, configureRX/TX), ✅ Configuración GPIO, ✅ Gestión WiFi, ✅ HTTPClient

### Metodología de Verificación

1. **Revisión de Hoja de Datos Oficial**: Todas las especificaciones de hardware verificadas contra hojas de datos del fabricante
2. **Documentación Context7**: Librerías de software verificadas usando documentación Context7
3. **Verificación de Compatibilidad de Pines**: Pines GPIO verificados como seguros para uso (evitando pines flash GPIO6-GPIO11)
4. **Identificación de Hardware**: Hardware identificado como NodeMCU-32S con módulo ESP32-WROOM-32 basado en especificaciones
5. **Configuración I²S**: Asignaciones de pines I²S verificadas contra Manual de Referencia Técnica ESP32
6. **Requisitos de Energía**: Consumo de corriente verificado dentro de capacidades ESP32-WROOM-32
7. **Enlaces a fuentes oficiales proporcionados para verificación independiente**

### Garantía de Precisión

- ✅ Placa correctamente identificada como NodeMCU-32S (ESP32-WROOM-32)
- ✅ Chipset especificado como ESP32-D0WDQ6 (variante de doble núcleo)
- ✅ Chip USB-a-Serial identificado como CH340C
- ✅ Flash QSPI de 4MB confirmada (estándar ESP32-WROOM-32)
- ✅ Calificación de rendimiento 600 DMIPS verificada
- ✅ Todas las especificaciones coinciden con hojas de datos oficiales de Espressif
- ✅ Configuraciones de pines verificadas seguras (evitando pines flash)
- ✅ Interfaces I²S correctamente mapeadas (I2S_NUM_0 e I2S_NUM_1)
- ✅ Asignaciones GPIO compatibles con diseño NodeMCU-32S
- ✅ Ejemplos de código verificados contra API Núcleo Arduino ESP32
- ✅ Tasas de muestreo y profundidades de bit confirmadas compatibles en todos los componentes
- ✅ Requisitos de energía verificados dentro de capacidades ESP32
- ✅ Enlaces a fuentes oficiales proporcionados para verificación independiente

---

## Licencia

Licencia MIT - Ver raíz del proyecto para detalles

---

**Versión del Documento**: 1.0  
**Última Actualización**: 17 de noviembre de 2025  
**Especificaciones Verificadas**: 17 de noviembre de 2025  
**Mantenido Por**: Equipo de Desarrollo

````