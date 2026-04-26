'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa la canción actual'),

  async execute(interaction, client) {
    const player = client.players.get(interaction.guildId);
    if (!player?.isPlaying) {
      return interaction.reply({ content: '❌ No hay nada reproduciéndose.', ephemeral: true });
    }
    player.pause();
    await interaction.reply('⏸️ Pausado.');
  },
};
