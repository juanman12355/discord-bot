'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta la canción actual'),

  async execute(interaction, client) {
    const player = client.players.get(interaction.guildId);
    if (!player?.currentTrack) {
      return interaction.reply({ content: '❌ No hay nada reproduciéndose.', ephemeral: true });
    }
    const title = player.currentTrack.title;
    player.skip();
    await interaction.reply(`⏭️ Saltando **${title}**...`);
  },
};
