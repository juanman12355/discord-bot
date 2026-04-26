# 🎵 Discord Music Bot

Bot de música para Discord con soporte de **YouTube**, **Spotify** y **recomendaciones automáticas por género** cuando la cola se vacía.

---

## ✨ Características

| Función | Descripción |
|---|---|
| `/play` | Reproduce canción/playlist de YouTube o Spotify |
| `/pause` | Pausa la reproducción |
| `/resume` | Reanuda la reproducción |
| `/skip` | Salta la canción actual |
| `/stop` | Detiene todo y desconecta el bot |
| `/queue` | Muestra la cola (con paginación) |
| `/nowplaying` | Muestra la canción actual con detalle |
| `/volume` | Ajusta el volumen (0–100) |
| `/loop` | Off / Canción / Cola completa |
| `/shuffle` | Mezcla la cola aleatoriamente |
| AutoPlay | Cuando la cola se vacía, busca canciones del mismo género en Spotify |

---

## 📋 Requisitos

- **Node.js 18 o superior** (`node -v` para verificar)
- **FFmpeg** instalado en el sistema  
  - Windows: descarga desde https://ffmpeg.org/download.html y agrégalo al PATH  
  - O el paquete `ffmpeg-static` lo incluye automáticamente
- Credenciales de **Discord Developer** y **Spotify Developer**

---

## 🚀 Instalación paso a paso

### 1. Crear el Bot de Discord

1. Ve a https://discord.com/developers/applications → **New Application**
2. En **Bot** → crea el bot → copia el **Token**
3. En **OAuth2 → General** → copia el **Client ID**
4. En **Bot** → activa los intents: `Server Members Intent`, `Message Content Intent`
5. Para invitarlo a tu servidor: **OAuth2 → URL Generator**  
   Scopes: `bot`, `applications.commands`  
   Permisos: `Connect`, `Speak`, `Send Messages`, `Embed Links`

### 2. Credenciales de Spotify

Usa las credenciales de tu proyecto de playlists existente  
(Client ID y Client Secret del Spotify Developer Dashboard).

### 3. Configurar variables de entorno

```bash
# Copia el archivo de ejemplo
cp .env.example .env
```

Edita `.env` con tus datos:

```env
DISCORD_TOKEN=tu_token_del_bot
DISCORD_CLIENT_ID=tu_client_id_de_discord
SPOTIFY_CLIENT_ID=tu_spotify_client_id
SPOTIFY_CLIENT_SECRET=tu_spotify_client_secret
```

### 4. Instalar dependencias

```bash
npm install
```

### 5. Registrar los comandos slash

```bash
npm run deploy
```

Esto registra los comandos en Discord (solo necesitas hacerlo una vez, o cuando agregues comandos nuevos).

### 6. Iniciar el bot

```bash
npm start
```

---

## 🎮 Uso

```
/play https://open.spotify.com/track/...         → canción de Spotify
/play https://open.spotify.com/playlist/...      → playlist de Spotify completa
/play https://www.youtube.com/watch?v=...        → video de YouTube
/play https://www.youtube.com/playlist?list=...  → playlist de YouTube
/play bohemian rhapsody                          → búsqueda por texto en YouTube

/queue pagina:2    → ver página 2 de la cola
/loop modo:Cola    → repetir toda la cola
/volume nivel:70   → ajustar volumen al 70%
```

---

## 🤖 AutoPlay (recomendaciones automáticas)

Cuando la cola se vacía, el bot:
1. Toma el último track reproducido
2. Busca su ID en Spotify (si no lo tiene ya)
3. Llama al endpoint `/recommendations` de Spotify con ese track como seed
4. Añade 5 canciones del mismo género a la cola
5. Envía un mensaje al canal indicando las canciones añadidas

Este ciclo se repite indefinidamente → el bot nunca para de sonar.

---

## 🛠️ Solución de problemas comunes

**El bot no se conecta al canal de voz**  
→ Verifica que tiene permisos de `Connect` y `Speak` en ese canal.

**Error `Cannot find module '@discordjs/opus'`**  
→ Ejecuta `npm install @discordjs/opus` o `npm install opusscript`

**Error de FFmpeg**  
→ Asegúrate de tener FFmpeg instalado: `ffmpeg -version` en la terminal.

**Los comandos no aparecen en Discord**  
→ Espera hasta 1 hora (Discord caché global) o usa comandos de guild para pruebas inmediatas.

**Error 401 de Spotify**  
→ Verifica que `SPOTIFY_CLIENT_ID` y `SPOTIFY_CLIENT_SECRET` estén correctos en `.env`.
