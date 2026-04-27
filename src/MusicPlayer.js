'use strict';

const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
  StreamType,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const playdl = require('play-dl');
const SpotifyHelper = require('./SpotifyHelper');

class MusicPlayer {
  constructor(guildId, textChannel) {
    this.guildId = guildId;
    this.textChannel = textChannel;

    this.queue = [];
    this.currentTrack = null;
    this.connection = null;
    this.volume = 0.5;
    this.loop = 'none';

    this._currentResource = null;
    this._ytdlpProcess = null;
    this.autoPaused = false;

    this.audioPlayer = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });

    this._setupEvents();
  }

  _setupEvents() {
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => this._onIdle());
    this.audioPlayer.on('error', err => {
      console.error(`[Player:${this.guildId}] Error de audio:`, err.message);
      this._onIdle();
    });
  }

  async _onIdle() {
    if (this.loop === 'track' && this.currentTrack) {
      return this._playTrack(this.currentTrack);
    }

    if (this.loop === 'queue' && this.currentTrack) {
      this.queue.push({ ...this.currentTrack });
    }

    if (this.queue.length > 0) {
      const next = this.queue.shift();
      return this._playTrack(next);
    }

    const lastTrack = this.currentTrack;
    this.currentTrack = null;

    if (!lastTrack) return;

    this.textChannel?.send('🔍 Cola vacía. Buscando canciones del mismo género...').catch(() => {});

    const recs = await SpotifyHelper.getRecommendations(lastTrack);

    if (!recs.length) {
      this.textChannel?.send('ℹ️ No se pudieron obtener recomendaciones. Usa `/play` para continuar.').catch(() => {});
      return;
    }

    for (const t of recs) this.queue.push(t);

    const list = recs.map(t => `• **${t.title}** — ${t.artist}`).join('\n');
    this.textChannel?.send(`🎵 **AutoPlay activado**\nCanciones similares añadidas:\n${list}`).catch(() => {});

    await this._playTrack(this.queue.shift());
  }

  async _playTrack(track) {
    this.currentTrack = track;

    if (!track.streamUrl) {
      const results = await playdl.search(`${track.title} ${track.artist}`, {
        source: { youtube: 'video' },
        limit: 1,
      });

      if (!results.length) {
        this.textChannel?.send(`⚠️ No encontré audio para **${track.title}**. Saltando...`).catch(() => {});
        return this._onIdle();
      }

      track.streamUrl = results[0].url;
    }

    try {
      const ytdlp = spawn('/usr/local/bin/yt-dlp', [
        '-f', 'bestaudio',
        '-o', '-',
        '--quiet',
        '--no-playlist',
        '--cookies', '/home/ubuntu/discord-bot/cookies.txt',
        '--js-runtimes', 'deno',
        track.streamUrl,
      ]);
      this._ytdlpProcess = ytdlp;

      ytdlp.stderr.on('data', data => {
        console.error(`[yt-dlp:${this.guildId}]`, data.toString().trim());
      });

      const resource = createAudioResource(ytdlp.stdout, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
      });
      resource.volume.setVolume(this.volume);
      this._currentResource = resource;
      this.audioPlayer.play(resource);
    } catch (err) {
      console.error(`[Player:${this.guildId}] Stream error:`, err.message);
      this.textChannel?.send(`⚠️ Error al reproducir **${track.title}**. Saltando...`).catch(() => {});
      this._onIdle();
    }
  }

  async join(voiceChannel) {
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    this.connection.subscribe(this.audioPlayer);

    this.connection.on('stateChange', (oldSt, newSt) => {
      console.log(`[Voice:${this.guildId}] ${oldSt.status} -> ${newSt.status}`);
    });

    let isReady = false;

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (!isReady) return;
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });

    await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
    isReady = true;
  }

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
    this._ytdlpProcess?.kill();
    this.audioPlayer.stop();
  }

  pause() {
    this.autoPaused = false;
    this.audioPlayer.pause();
  }

  resume() {
    this.autoPaused = false;
    this.audioPlayer.unpause();
  }

  autoPause() {
    if (!this.isPlaying) return false;
    this.audioPlayer.pause();
    this.autoPaused = true;
    return true;
  }

  autoResume() {
    if (!this.autoPaused) return false;
    this.audioPlayer.unpause();
    this.autoPaused = false;
    return true;
  }

  stop() {
    this._ytdlpProcess?.kill();
    this.queue = [];
    this.currentTrack = null;
    this.audioPlayer.stop();
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol / 100));
    this._currentResource?.volume?.setVolume(this.volume);
  }

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
