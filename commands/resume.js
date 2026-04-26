'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Reanuda la reproducción'),

  async execute(interaction, client) {
    const player = client.players.get(interaction.guildId);
    if (!player?.isPaused) {
      return interaction.reply({ content: '❌ No hay nada pausado.', ephemeral: true });
    }
    player.resume();
    await interaction.reply('▶️ Reanudando...');
  },
};
