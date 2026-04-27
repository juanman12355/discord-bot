'use strict';

/**
 * SpotifyHelper
 * Usa Client Credentials para búsquedas públicas.
 * Usa OAuth (refresh token) para acceder a playlists del usuario.
 */
class SpotifyHelper {
  constructor() {
    this.clientId     = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

    this._ccToken       = null; // Client Credentials token
    this._ccExpiry      = 0;
    this._userToken     = null; // OAuth user token
    this._userExpiry    = 0;
  }

  // ── Client Credentials (búsquedas públicas) ───────────────────────────────

  async _getCCToken() {
    if (this._ccToken && Date.now() < this._ccExpiry) return this._ccToken;

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) throw new Error(`Spotify CC auth fallida: ${res.status}`);
    const data = await res.json();
    this._ccToken  = data.access_token;
    this._ccExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this._ccToken;
  }

  // ── OAuth user token (playlists privadas/del usuario) ────────────────────

  async _getUserToken() {
    if (this._userToken && Date.now() < this._userExpiry) return this._userToken;

    if (!this.refreshToken) throw new Error('SPOTIFY_REFRESH_TOKEN no está configurado en el .env');

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: this.refreshToken,
      }),
    });

    if (!res.ok) throw new Error(`Spotify OAuth refresh fallido: ${res.status}`);
    const data = await res.json();
    this._userToken  = data.access_token;
    this._userExpiry = Date.now() + (data.expires_in - 60) * 1000;
    // Spotify a veces devuelve un nuevo refresh token
    if (data.refresh_token) this.refreshToken = data.refresh_token;
    return this._userToken;
  }

  // ── Requests ──────────────────────────────────────────────────────────────

  async _get(path, useUserToken = false) {
    const token = useUserToken ? await this._getUserToken() : await this._getCCToken();
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Spotify API error ${res.status}: ${path}`);
    return res.json();
  }

  // ── URL parsing ───────────────────────────────────────────────────────────

  parseUrl(url) {
    const track = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (track) return { type: 'track', id: track[1] };

    const playlist = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
    if (playlist) return { type: 'playlist', id: playlist[1] };

    return null;
  }

  // ── Track formatting ──────────────────────────────────────────────────────

  _formatTrack(t, requester = 'AutoPlay') {
    return {
      title:      t.name,
      artist:     t.artists?.map(a => a.name).join(', ') || 'Desconocido',
      duration:   Math.floor((t.duration_ms || 0) / 1000),
      thumbnail:  t.album?.images?.[0]?.url || null,
      spotifyId:  t.id,
      streamUrl:  null,
      requester,
      autoQueued: false,
    };
  }

  // ── Public methods ────────────────────────────────────────────────────────

  async getTrack(id, requester) {
    const data = await this._get(`/tracks/${id}`);
    return this._formatTrack(data, requester);
  }

  async getPlaylistTracks(id, requester) {
    const tracks = [];
    let path = `/playlists/${id}/tracks?limit=100`;

    while (path) {
      // Usar OAuth para poder acceder a playlists del usuario
      const data = await this._get(path, true);
      for (const item of data.items) {
        if (item.track?.id) {
          tracks.push(this._formatTrack(item.track, requester));
        }
      }
      path = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
    }

    return tracks;
  }

  async searchTrackId(query) {
    try {
      const data = await this._get(`/search?q=${encodeURIComponent(query)}&type=track&limit=1`);
      return data.tracks?.items?.[0]?.id || null;
    } catch {
      return null;
    }
  }

  async getRecommendations(track) {
    try {
      const artist = track.artist?.split(',')[0]?.trim() || track.title;
      const data = await this._get(
        `/search?q=${encodeURIComponent(artist)}&type=track&limit=10`
      );

      return (data.tracks?.items || [])
        .filter(t => t.id !== track.spotifyId)
        .slice(0, 5)
        .map(t => ({
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
