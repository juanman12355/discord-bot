'use strict';

/**
 * SpotifyHelper
 * Wrapper para la Spotify Web API usando Client Credentials (sin login de usuario).
 * Reutiliza las credenciales de tu proyecto de playlists.
 */
class SpotifyHelper {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this._token = null;
    this._tokenExpiry = 0;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async _getToken() {
    if (this._token && Date.now() < this._tokenExpiry) return this._token;

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:
          'Basic ' +
          Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) throw new Error(`Spotify auth fallida: ${res.status}`);
    const data = await res.json();
    this._token = data.access_token;
    this._tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this._token;
  }

  async _get(path) {
    const token = await this._getToken();
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Spotify API error ${res.status}: ${path}`);
    return res.json();
  }

  // ── URL parsing ───────────────────────────────────────────────────────────

  /**
   * Detecta si una URL es de Spotify y devuelve su tipo e ID.
   * @param {string} url
   * @returns {{ type: 'track'|'playlist', id: string } | null}
   */
  static parseUrl(url) {
    const track = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (track) return { type: 'track', id: track[1] };

    const playlist = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
    if (playlist) return { type: 'playlist', id: playlist[1] };

    return null;
  }

  // ── Track formatting ──────────────────────────────────────────────────────

  /**
   * Convierte un objeto de track de la Spotify API al formato interno del bot.
   */
  _formatTrack(t, requester = 'AutoPlay') {
    return {
      title: t.name,
      artist: t.artists?.map(a => a.name).join(', ') || 'Desconocido',
      duration: Math.floor((t.duration_ms || 0) / 1000),
      thumbnail: t.album?.images?.[0]?.url || null,
      spotifyId: t.id,
      streamUrl: null, // se resuelve a YouTube justo antes de reproducir
      requester,
      autoQueued: false,
    };
  }

  // ── Public methods ────────────────────────────────────────────────────────

  /** Obtiene un track individual por ID. */
  static async getTrack(id, requester) {
    const data = await this._get(`/tracks/${id}`);
    return this._formatTrack(data, requester);
  }

  /**
   * Obtiene todos los tracks de una playlist (maneja paginación de hasta 100 por página).
   * @returns {Track[]}
   */
  static async getPlaylistTracks(id, requester) {
    const tracks = [];
    let path =
      `/playlists/${id}/tracks?limit=100` +
      `&fields=next,items(track(id,name,artists,duration_ms,album(images)))`;

    while (path) {
      const data = await this._get(path);
      for (const item of data.items) {
        // Saltar tracks locales o eliminados
        if (item.track?.id) {
          tracks.push(this._formatTrack(item.track, requester));
        }
      }
      // La URL next de Spotify es absoluta; extraemos solo el path
      path = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
    }

    return tracks;
  }

  /**
   * Busca un track en Spotify por texto y devuelve su ID (para tracks de YouTube).
   * @returns {string|null}
   */
  async searchTrackId(query) {
    try {
      const data = await this._get(
        `/search?q=${encodeURIComponent(query)}&type=track&limit=1`
      );
      return data.tracks?.items?.[0]?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Obtiene 5 recomendaciones basadas en el último track reproducido.
   * Si el track no tiene spotifyId, lo busca primero.
   * @param {Track} track
   * @returns {Track[]}
   */
  async getRecommendations(track) {
    let spotifyId = track.spotifyId;

    if (!spotifyId) {
      spotifyId = await this.searchTrackId(`${track.title} ${track.artist || ''}`);
    }
    if (!spotifyId) return [];

    try {
      const data = await this._get(
        `/recommendations?seed_tracks=${spotifyId}&limit=5`
      );
      return (data.tracks || []).map(t => ({
        ...this._formatTrack(t, 'AutoPlay 🎵'),
        autoQueued: true,
      }));
    } catch (err) {
      console.error('[Spotify] Recommendations error:', err.message);
      return [];
    }
  }
}

module.exports = new SpotifyHelper();
