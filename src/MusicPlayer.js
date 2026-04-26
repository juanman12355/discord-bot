'use strict';

const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
} = require('@discordjs/voice');
const playdl = require('play-dl');
const SpotifyHelper = require('./SpotifyHelper');

/**
 * MusicPlayer
 * Una instancia por servidor (guild). Gestiona la conexión de voz,
 * la cola de canciones, el reproductor de audio y las recomendaciones automáticas.
 */
class MusicPlayer {
  /**
   * @param {string} guildId
   * @param {import('discord.js').TextChannel} textChannel  Canal donde enviar mensajes automáticos
   */
  constructor(guildId, textChannel) {
    this.guildId = guildId;
    this.textChannel = textChannel;

    this.queue = [];            // Track[]
    this.currentTrack = null;   // Track | null
    this.connection = null;     // VoiceConnection | null
    this.volume = 0.5;          // 0.0 – 1.0
    this.loop = 'none';         // 'none' | 'track' | 'queue'

    this._currentResource = null;
    this.autoPaused = false;   // true solo cuando fue pausado por canal vacío (no por el usuario)

    this.audioPlayer = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    this.audioPlayer.on('error', error => {
      console.error('Error en reproducción:', error);
      this.playNext();
    });

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.playNext();
    });

    this._setupEvents();
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  _setupEvents() {
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => this._onIdle());
    this.audioPlayer.on('error', err => {
      console.error(`[Player:${this.guildId}] Error de audio:`, err.message);
      this._onIdle(); // salta la canción rota
    });
  }

  async _onIdle() {
    // 1. Loop de canción
    if (this.loop === 'track' && this.currentTrack) {
      return this._playTrack(this.currentTrack);
    }

    // 2. Loop de cola
    if (this.loop === 'queue' && this.currentTrack) {
      this.queue.push({ ...this.currentTrack });
    }

    // 3. Siguiente en cola
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      return this._playTrack(next);
    }

    // 4. Cola vacía → recomendaciones automáticas por género
    const lastTrack = this.currentTrack;
    this.currentTrack = null;

    if (!lastTrack) return;

    this.textChannel
      ?.send('🔍 Cola vacía. Buscando canciones del mismo género...')
      .catch(() => {});

    const recs = await SpotifyHelper.getRecommendations(lastTrack);

    if (!recs.length) {
      this.textChannel
        ?.send('ℹ️ No se pudieron obtener recomendaciones. Usa `/play` para continuar.')
        .catch(() => {});
      return;
    }

    for (const t of recs) this.queue.push(t);

    const list = recs.map(t => `• **${t.title}** — ${t.artist}`).join('\n');
    this.textChannel
      ?.send(`🎵 **AutoPlay activado**\nCanciones similares añadidas:\n${list}`)
      .catch(() => {});

    await this._playTrack(this.queue.shift());
  }

  // ── Playback internals ────────────────────────────────────────────────────

  /**
   * Resuelve la URL de stream (YouTube) si es necesario y reproduce el track.
   * @param {Track} track
   */
  async _playTrack(track) {
    this.currentTrack = track;

    // Tracks de Spotify no traen streamUrl; lo buscamos en YouTube ahora
    if (!track.streamUrl) {
      const results = await playdl.search(`${track.title} ${track.artist}`, {
        source: { youtube: 'video' },
        limit: 1,
      });

      if (!results.length) {
        this.textChannel
          ?.send(`⚠️ No encontré audio para **${track.title}**. Saltando...`)
          .catch(() => {});
        return this._onIdle();
      }

      track.streamUrl = results[0].url;
    }

    try {
      const stream = await playdl.stream(track.streamUrl, { quality: 2 });
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });
      resource.volume.setVolume(this.volume);
      this._currentResource = resource;
      this.audioPlayer.play(resource);
    } catch (err) {
      console.error(`[Player:${this.guildId}] Stream error:`, err.message);
      this.textChannel
        ?.send(`⚠️ Error al reproducir **${track.title}**. Saltando...`)
        .catch(() => {});
      this._onIdle();
    }
  }

  // ── Voice connection ──────────────────────────────────────────────────────

  /**
   * Conecta el bot al canal de voz.
   * @param {import('discord.js').VoiceChannel} voiceChannel
   */
  async join(voiceChannel) {
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (error) {
      this.connection.destroy();
      throw new Error("No pude conectarme al canal de voz");
    }

    this.connection.subscribe(this.audioPlayer);

    await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);

    // Reconectar automáticamente si se desconecta momentáneamente
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Añade uno o varios tracks a la cola. Si el player está inactivo, empieza a reproducir.
   * @param {Track | Track[]} tracks
   */
  async addTracks(tracks) {
    if (!Array.isArray(tracks)) tracks = [tracks];
    this.queue.push(...tracks);

    const idle =
      this.audioPlayer.state.status === AudioPlayerStatus.Idle &&
      !this.currentTrack;

    if (idle) {
      await this._playTrack(this.queue.shift());
    }
  }

  skip() {
    this.audioPlayer.stop(); // dispara el evento Idle → _onIdle
  }

  pause() {
    this.autoPaused = false; // pausa manual → no reanudar automáticamente
    this.audioPlayer.pause();
  }

  resume() {
    this.autoPaused = false;
    this.audioPlayer.unpause();
  }

  /** Pausa automática por canal vacío. Devuelve true si se pausó. */
  autoPause() {
    if (!this.isPlaying) return false;
    this.audioPlayer.pause();
    this.autoPaused = true;
    return true;
  }

  /** Reanuda solo si fue pausado automáticamente. Devuelve true si se reanudó. */
  autoResume() {
    if (!this.autoPaused) return false;
    this.audioPlayer.unpause();
    this.autoPaused = false;
    return true;
  }

  stop() {
    this.queue = [];
    this.currentTrack = null;
    this.audioPlayer.stop();
  }

  /** @param {number} vol  0–100 */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol / 100));
    this._currentResource?.volume?.setVolume(this.volume);
  }

  /** @param {'none'|'track'|'queue'} mode */
  setLoop(mode) {
    this.loop = mode;
  }

  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
  }

  get isPlaying() {
    return this.audioPlayer.state.status === AudioPlayerStatus.Playing;
  }

  get isPaused() {
    return this.audioPlayer.state.status === AudioPlayerStatus.Paused;
  }

  destroy() {
    this.stop();
    this.connection?.destroy();
    this.connection = null;
  }
}

module.exports = MusicPlayer;
