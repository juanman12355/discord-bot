'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const playdl        = require('play-dl');
const MusicPlayer   = require('../src/MusicPlayer');
const SpotifyHelper = require('../src/SpotifyHelper');
const { formatDuration } = require('../src/utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una canción o playlist de YouTube o Spotify')
    .addStringOption(o =>
      o.setName('query')
        .setDescription('URL de YouTube/Spotify o nombre de la canción')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    // ── Validaciones previas ──────────────────────────────────────────────────
    const vc = interaction.member?.voice?.channel;
    if (!vc) {
      return interaction.editReply('❌ Debes estar en un canal de voz primero.');
    }

    const query     = interaction.options.getString('query');
    const requester = interaction.user.username;
    let tracks      = [];

    // ── Detectar fuente ───────────────────────────────────────────────────────

    const spotifyParsed = SpotifyHelper.parseUrl(query);

    if (spotifyParsed?.type === 'track') {
      // ── Spotify: canción individual ────────────────────────────────────────
      const track = await SpotifyHelper.getTrack(spotifyParsed.id, requester);
      tracks.push(track);

    } else if (spotifyParsed?.type === 'playlist') {
      // ── Spotify: playlist completa ─────────────────────────────────────────
      await interaction.editReply('⏳ Cargando playlist de Spotify...');
      tracks = await SpotifyHelper.getPlaylistTracks(spotifyParsed.id, requester);
      if (!tracks.length) {
        return interaction.editReply('❌ La playlist está vacía o es privada.');
      }

    } else {
      // ── YouTube o búsqueda de texto ────────────────────────────────────────
      const srcType = await playdl.validate(query).catch(() => 'search');

      if (srcType === 'yt_video') {
        const info = await playdl.video_info(query);
        const v    = info.video_details;
        tracks.push({
          title:       v.title,
          artist:      v.channel?.name || 'Desconocido',
          duration:    v.durationInSec,
          thumbnail:   v.thumbnails?.[0]?.url || null,
          spotifyId:   null,
          streamUrl:   query,
          requester,
          autoQueued:  false,
        });

      } else if (srcType === 'yt_playlist') {
        await interaction.editReply('⏳ Cargando playlist de YouTube...');
        const playlist = await playdl.playlist_info(query, { incomplete: true });
        const videos   = await playlist.all_videos();
        tracks = videos.map(v => ({
          title:       v.title,
          artist:      v.channel?.name || 'Desconocido',
          duration:    v.durationInSec,
          thumbnail:   v.thumbnails?.[0]?.url || null,
          spotifyId:   null,
          streamUrl:   v.url,
          requester,
          autoQueued:  false,
        }));

      } else {
        // Búsqueda de texto → YouTube
        const results = await playdl.search(query, {
          source: { youtube: 'video' },
          limit:  1,
        });
        if (!results.length) {
          return interaction.editReply('❌ No se encontraron resultados.');
        }
        const v = results[0];
        tracks.push({
          title:       v.title,
          artist:      v.channel?.name || 'Desconocido',
          duration:    v.durationInSec,
          thumbnail:   v.thumbnails?.[0]?.url || null,
          spotifyId:   null,
          streamUrl:   v.url,
          requester,
          autoQueued:  false,
        });
      }
    }

    // ── Obtener o crear el player ─────────────────────────────────────────────
    let player = client.players.get(interaction.guildId);
    if (!player) {
      player = new MusicPlayer(interaction.guildId, interaction.channel);
      client.players.set(interaction.guildId, player);
    }

    if (!player.connection) {
      try {
        await player.join(vc);
      } catch (err) {
        console.error('[play] Error al conectar al canal de voz:', err);
        client.players.delete(interaction.guildId);
        return interaction.editReply(`❌ No pude conectarme al canal de voz: \`${err.message}\``);
      }
    }

    await player.addTracks(tracks);

    // ── Respuesta ─────────────────────────────────────────────────────────────
    if (tracks.length === 1) {
      const t   = tracks[0];
      const now = player.currentTrack;
      const embed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle(now?.title === t.title ? '▶️ Reproduciendo ahora' : '➕ Añadido a la cola')
        .setDescription(`**${t.title}**`)
        .addFields(
          { name: '🎤 Artista',     value: t.artist,                    inline: true },
          { name: '⏱️ Duración',   value: formatDuration(t.duration),   inline: true },
          { name: '🙋 Pedido por', value: t.requester,                  inline: true },
        )
        .setThumbnail(t.thumbnail)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply(
        `✅ **${tracks.length} canciones** añadidas a la cola.`
      );
    }
  },
};
