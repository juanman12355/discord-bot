const { SlashCommandBuilder } = require('discord.js');
const play = require('play-dl');
const SpotifyHelper = require('../src/SpotifyHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce música')
    .addStringOption(option =>
      option.setName('query').setDescription('Nombre o URL').setRequired(true)
    ),

  async execute(interaction, player) {
    try {
      await interaction.deferReply();

      const query = interaction.options.getString('query');
      const voiceChannel = interaction.member.voice.channel;

      if (!voiceChannel) {
        return interaction.editReply('❌ Debes estar en un canal de voz');
      }

      // 🔥 conectar si no está conectado
      if (!player.connection) {
        await player.connect(voiceChannel);
      }

      let track;

      // 🎵 SPOTIFY
      const spotifyParsed = SpotifyHelper.parseUrl(query);
      if (spotifyParsed && spotifyParsed.type === 'track') {
        const data = await SpotifyHelper.getTrack(spotifyParsed.id);

        const search = await play.search(data.title, { limit: 1 });

        if (!search.length) {
          return interaction.editReply('❌ No se encontraron resultados');
        }

        track = {
          title: search[0].title,
          url: search[0].url
        };
      }

      // 🎥 YOUTUBE DIRECTO
      else if (play.yt_validate(query) === 'video') {
        track = {
          title: 'YouTube Track',
          url: query
        };
      }

      // 🔎 BÚSQUEDA NORMAL
      else {
        const search = await play.search(query, { limit: 1 });

        if (!search.length) {
          return interaction.editReply('❌ No se encontraron resultados');
        }

        track = {
          title: search[0].title,
          url: search[0].url
        };
      }

      await player.addToQueue(track);

      return interaction.editReply(`🎶 Añadido: ${track.title}`);

    } catch (error) {
      console.error(error);

      if (interaction.deferred) {
        await interaction.editReply(`❌ ${error.message}`);
      } else {
        await interaction.reply(`❌ ${error.message}`);
      }
    }
  }
};