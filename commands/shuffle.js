'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Mezcla aleatoriamente las canciones de la cola'),

  async execute(interaction, client) {
    const player = client.players.get(interaction.guildId);
    if (!player?.queue?.length) {
      return interaction.reply({ content: '❌ La cola está vacía.', ephemeral: true });
    }
    player.shuffle();
    await interaction.reply(`🔀 Cola mezclada — **${player.queue.length} canciones** en orden aleatorio.`);
  },
};
