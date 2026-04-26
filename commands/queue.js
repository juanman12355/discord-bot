'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration } = require('../src/utils');

const PAGE_SIZE = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Muestra la cola de reproducción')
    .addIntegerOption(o =>
      o.setName('pagina')
        .setDescription('Número de página')
        .setMinValue(1)
    ),

  async execute(interaction, client) {
    const player = client.players.get(interaction.guildId);

    if (!player?.currentTrack && (!player?.queue || player.queue.length === 0)) {
      return interaction.reply({ content: '❌ La cola está vacía.', ephemeral: true });
    }

    const page    = (interaction.options.getInteger('pagina') || 1) - 1;
    const total   = player.queue.length;
    const pages   = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, pages - 1);
    const start   = safePage * PAGE_SIZE;
    const slice   = player.queue.slice(start, start + PAGE_SIZE);

    const embed = new EmbedBuilder()
      .setColor('#1DB954')
      .setTitle('🎵 Cola de reproducción')
      .setFooter({ text: `Página ${safePage + 1} de ${pages} • ${total} canciones en cola` });

    // Canción actual
    if (player.currentTrack) {
      const t = player.currentTrack;
      embed.addFields({
        name: '▶️ Reproduciendo ahora',
        value: `**${t.title}** — ${t.artist}  \`[${formatDuration(t.duration)}]\`${t.autoQueued ? '  🎵 AutoPlay' : ''}`,
      });
    }

    // Cola paginada
    if (slice.length > 0) {
      const list = slice.map((t, i) => {
        const num  = start + i + 1;
        const auto = t.autoQueued ? ' 🎵' : '';
        return `\`${num}.\`${auto} **${t.title}** — ${t.artist}  \`[${formatDuration(t.duration)}]\``;
      }).join('\n');

      embed.addFields({ name: `📋 Siguiente${total > PAGE_SIZE ? ` (mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, total)})` : ''}`, value: list });
    } else if (player.currentTrack) {
      embed.addFields({ name: '📋 Cola', value: 'Sin más canciones. Usa `/play` o espera el AutoPlay.' });
    }

    const loopLabels = { none: 'Off', track: '🔂 Canción', queue: '🔁 Cola' };
    embed.addFields(
      { name: '🔁 Loop',    value: loopLabels[player.loop] || 'Off',         inline: true },
      { name: '🔊 Volumen', value: `${Math.round(player.volume * 100)}%`,     inline: true },
    );

    await interaction.reply({ embeds: [embed] });
  },
};
