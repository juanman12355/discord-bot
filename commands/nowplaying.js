'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration } = require('../src/utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Muestra la canción que está sonando ahora'),

  async execute(interaction, client) {
    const player = client.players.get(interaction.guildId);
    if (!player?.currentTrack) {
      return interaction.reply({ content: '❌ No hay nada reproduciéndose.', ephemeral: true });
    }

    const t = player.currentTrack;
    const loopLabels = { none: '❌ Off', track: '🔂 Canción', queue: '🔁 Cola' };

    const embed = new EmbedBuilder()
      .setColor('#1DB954')
      .setTitle('▶️ Reproduciendo ahora')
      .setDescription(`**${t.title}**`)
      .addFields(
        { name: '🎤 Artista',      value: t.artist,                         inline: true },
        { name: '⏱️ Duración',    value: formatDuration(t.duration),        inline: true },
        { name: '🙋 Pedido por',  value: t.autoQueued ? 'AutoPlay 🎵' : t.requester, inline: true },
        { name: '🔁 Loop',        value: loopLabels[player.loop] || 'Off',  inline: true },
        { name: '🔊 Volumen',     value: `${Math.round(player.volume * 100)}%`, inline: true },
        { name: '📋 En cola',     value: `${player.queue.length} canciones`,     inline: true },
      )
      .setThumbnail(t.thumbnail)
      .setTimestamp();

    if (t.streamUrl) {
      embed.setURL(t.streamUrl);
    }

    await interaction.reply({ embeds: [embed] });
  },
};
