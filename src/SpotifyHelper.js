'use strict';

class SpotifyHelper {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this._token = null;
    this._tokenExpiry = 0;
  }

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

  parseUrl(url) {
    const track = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (track) return { type: 'track', id: track[1] };

    const playlist = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
    if (playlist) return { type: 'playlist', id: playlist[1] };

    return null;
  }

  _formatTrack(t, requester = 'AutoPlay') {
    return {
      title: t.name,
      artist: t.artists?.map(a => a.name).join(', ') || 'Desconocido',
      duration: Math.floor((t.duration_ms || 0) / 1000),
      thumbnail: t.album?.images?.[0]?.url || null,
      spotifyId: t.id,
      streamUrl: null,
      requester,
      autoQueued: false,
    };
  }

  async getTrack(id, requester) {
    const data = await this._get(`/tracks/${id}`);
    return this._formatTrack(data, requester);
  }

  async getPlaylistTracks(id, requester) {
    const tracks = [];
    let path =
      `/playlists/${id}/tracks?limit=100` +
      `&fields=next,items(track(id,name,artists,duration_ms,album(images)))`;

    while (path) {
      const data = await this._get(path);
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
      const data = await this._get(
        `/search?q=${encodeURIComponent(query)}&type=track&limit=1`
      );
      return data.tracks?.items?.[0]?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Busca canciones del mismo género usando el artista del último track.
   * Reemplaza /recommendations que Spotify eliminó en noviembre 2024.
   */
  async getRecommendations(track) {
    try {
      // Buscar más canciones del mismo artista
      const artist = track.artist?.split(',')[0]?.trim() || track.title;
      const data = await this._get(
        `/search?q=${encodeURIComponent(artist)}&type=track&limit=10`
      );

      const tracks = (data.tracks?.items || [])
        .filter(t => t.id !== track.spotifyId) // excluir la canción actual
        .slice(0, 5)
        .map(t => ({
          ...this._formatTrack(t, 'AutoPlay 🎵'),
          autoQueued: true,
        }));

      return tracks;
    } catch (err) {
      console.error('[Spotify] Recommendations error:', err.message);
      return [];
    }
  }
}

module.exports = new SpotifyHelper();
