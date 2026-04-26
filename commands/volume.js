'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ajusta el volumen del bot (0–100)')
    .addIntegerOption(o =>
      o.setName('nivel')
        .setDescription('Nivel de volumen (0 = silencio, 100 = máximo)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),

  async execute(interaction, client) {
    const player = client.players.get(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: '❌ El bot no está en ningún canal de voz.', ephemeral: true });
    }
    const vol = interaction.options.getInteger('nivel');
    player.setVolume(vol);
    const icon = vol === 0 ? '🔇' : vol < 40 ? '🔈' : vol < 70 ? '🔉' : '🔊';
    await interaction.reply(`${icon} Volumen ajustado a **${vol}%**.`);
  },
};
