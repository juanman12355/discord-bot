'use strict';

require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs   = require('fs');
const path = require('path');
const MusicPlayer = require('./src/MusicPlayer');

// ── Discord client ────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

client.commands = new Collection();
client.players  = new Map(); // guildId (string) → MusicPlayer

// ── Player helpers ────────────────────────────────────────────────────────────

/**
 * Devuelve el MusicPlayer de un guild (lo crea si no existe).
 * @param {string} guildId
 * @param {import('discord.js').TextChannel} textChannel
 */
client.getPlayer = function (guildId, textChannel) {
  if (!this.players.has(guildId)) {
    this.players.set(guildId, new MusicPlayer(guildId, textChannel));
  }
  return this.players.get(guildId);
};

/**
 * Destruye y elimina el MusicPlayer de un guild.
 * @param {string} guildId
 */
client.destroyPlayer = function (guildId) {
  const player = this.players.get(guildId);
  if (player) {
    player.destroy();
    this.players.delete(guildId);
  }
};

// ── Load slash commands ───────────────────────────────────────────────────────

const cmdDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(cmdDir, file));
  client.commands.set(cmd.data.name, cmd);
}

// ── Events ────────────────────────────────────────────────────────────────────

client.once('clientReady', () => {
  console.log(`✅ Bot listo como ${client.user.tag}`);
  console.log(`   Servidores: ${client.guilds.cache.size}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction, client);
  } catch (err) {
    console.error(`[Command:${interaction.commandName}]`, err);
    const msg = { content: '❌ Ocurrió un error al ejecutar el comando.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

// Auto-pausa cuando el canal queda vacío, reanuda cuando alguien vuelve
client.on('voiceStateUpdate', (oldState, newState) => {
  const player = client.players.get(oldState.guild.id);
  if (!player?.connection) return;

  const botChannel = oldState.guild.members.me?.voice?.channel;
  if (!botChannel) return;

  const humans = botChannel.members.filter(m => !m.user.bot).size;

  if (humans === 0) {
    // Canal quedó vacío → pausar automáticamente
    if (player.autoPause()) {
      player.textChannel
        ?.send('⏸️ Canal vacío. Pausando hasta que alguien vuelva...')
        .catch(() => {});
    }
  } else {
    // Alguien entró al canal → reanudar si fue pausado automáticamente
    if (player.autoResume()) {
      player.textChannel
        ?.send(`▶️ ¡Bienvenido, ${newState.member.displayName}! Reanudando reproducción...`)
        .catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
