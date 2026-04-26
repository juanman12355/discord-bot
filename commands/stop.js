'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene la reproducción y desconecta el bot'),

  async execute(interaction, client) {
    const player = client.players.get(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: '❌ El bot no está en ningún canal de voz.', ephemeral: true });
    }
    client.destroyPlayer(interaction.guildId);
    await interaction.reply('⏹️ Detenido y desconectado. ¡Hasta luego! 👋');
  },
};
