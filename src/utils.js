'use strict';

/**
 * Converts seconds to a human-readable duration string.
 * @param {number} secs
 * @returns {string}  e.g. "3:45" or "1:02:30"
 */
function formatDuration(secs) {
  if (!secs || isNaN(secs)) return '?:??';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

module.exports = { formatDuration };
