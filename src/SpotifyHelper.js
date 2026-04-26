const fetch = require('node-fetch');

class SpotifyHelper {
  static async getAccessToken() {
    const creds = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const data = await res.json();
    return data.access_token;
  }

  static parseUrl(url) {
    const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
    const playlistMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);

    if (trackMatch) return { type: 'track', id: trackMatch[1] };
    if (playlistMatch) return { type: 'playlist', id: playlistMatch[1] };

    return null;
  }

  static async getTrack(id) {
    const token = await this.getAccessToken();

    const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    return {
      title: `${data.name} ${data.artists[0].name}`
    };
  }
}

module.exports = SpotifyHelper;