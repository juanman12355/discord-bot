'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Configura el modo de repetición')
    .addStringOption(o =>
      o.setName('modo')
        .setDescription('Modo de loop a activar')
        .setRequired(true)
        .addChoices(
          { name: '❌ Off — sin repetición',          value: 'none'  },
          { name: '🔂 Canción — repite la actual',    value: 'track' },
          { name: '🔁 Cola — repite toda la cola',    value: 'queue' },
        )
    ),

  async execute(interaction, client) {
    const player = client.players.get(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: '❌ El bot no está en ningún canal de voz.', ephemeral: true });
    }
    const mode = interaction.options.getString('modo');
    player.setLoop(mode);
    const labels = { none: '❌ Off', track: '🔂 Canción', queue: '🔁 Cola completa' };
    await interaction.reply(`Loop: **${labels[mode]}**`);
  },
};
