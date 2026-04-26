const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnectionStatus,
  AudioPlayerStatus
} = require('@discordjs/voice');

const play = require('play-dl');

class MusicPlayer {
  constructor() {
    this.queue = [];
    this.currentTrack = null;
    this.connection = null;
    this.player = createAudioPlayer();

    // 🔥 eventos importantes
    this.player.on('error', error => {
      console.error('Error en reproducción:', error);
      this.playNext();
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.playNext();
    });
  }

  async connect(channel) {
    this.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator
    });

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (error) {
      this.connection.destroy();
      throw new Error('No pude conectarme al canal de voz');
    }

    // 🔥 MUY IMPORTANTE
    this.connection.subscribe(this.player);
  }

  async play(track) {
    this.currentTrack = track;

    const stream = await play.stream(track.url);

    const resource = createAudioResource(stream.stream, {
      inputType: stream.type
    });

    this.player.play(resource);
  }

  async addToQueue(track) {
    this.queue.push(track);

    if (!this.currentTrack) {
      this.playNext();
    }
  }

  playNext() {
    if (this.queue.length === 0) {
      this.currentTrack = null;
      return;
    }

    const next = this.queue.shift();
    this.play(next);
  }
}

module.exports = MusicPlayer;