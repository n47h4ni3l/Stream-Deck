const { execFile } = require('child_process');
const { hostEnvironment, executablePath } = require('./browser-dependencies');
const { identityMatches } = require('./browser-adapters');

// Only application identity and PlaybackStatus are read. Never request Metadata,
// track IDs, titles or URLs, and never persist observations.
function gdbus(args, env = process.env) {
  return new Promise((resolve, reject) => execFile('gdbus', ['call', '--session', '--timeout', '1', ...args], {
    env: hostEnvironment(env), timeout: 1400, maxBuffer: 65536, encoding: 'utf8'
  }, (error, stdout) => error ? reject(new Error('Session media query unavailable')) : resolve(stdout.trim())));
}
function variantString(text) {
  const match = /^\(\s*<\s*(['"])([a-zA-Z0-9 ._-]{1,100})\1\s*>\s*,\s*\)$/.exec(text);
  if (!match) throw new Error('Unsupported media property');
  return match[2];
}
function createReader(env = process.env, call = args => gdbus(args, env)) {
  const bus = ['--dest', 'org.freedesktop.DBus', '--object-path', '/org/freedesktop/DBus'];
  async function owner(name) {
    const text = await call([...bus, '--method', 'org.freedesktop.DBus.GetNameOwner', name]);
    const match = /^\(\s*'(:[\d.]+)'\s*,\s*\)$/.exec(text);
    if (!match) throw new Error('Media owner unavailable');
    return match[1];
  }
  return {
    async names() {
      const text = await call([...bus, '--method', 'org.freedesktop.DBus.ListNames']);
      if (!/^\(/.test(text)) throw new Error('Session bus unavailable');
      return [...new Set(text.match(/org\.mpris\.MediaPlayer2\.[\w.-]+/g) || [])];
    },
    async player(name) {
      const unique = await owner(name);
      const get = (iface, property) => call(['--dest', unique, '--object-path', '/org/mpris/MediaPlayer2',
        '--method', 'org.freedesktop.DBus.Properties.Get', iface, property]).then(variantString);
      const [identity, status] = await Promise.all([get('org.mpris.MediaPlayer2', 'Identity'), get('org.mpris.MediaPlayer2.Player', 'PlaybackStatus')]);
      if (!['Playing', 'Paused', 'Stopped'].includes(status) || await owner(name) !== unique) throw new Error('Media observation changed');
      return { identity, status };
    }
  };
}
async function checkPlaybackTools(env = process.env) {
  if (!executablePath('gdbus', env)) throw new Error('Playback detection requires gdbus (GLib command-line tools). Install it through supported OS tools; no system packages were changed.');
  try { await createReader(env).names(); }
  catch { throw new Error('The user session bus is unavailable. Run setup in a working Desktop Mode/session; no security settings were changed.'); }
}
class PlaybackMonitor {
  constructor({ adapter, blocker, reader = createReader(), onState = () => {}, now = Date.now,
    interval = 2500, maxAge = 8000, timers = { setTimeout, clearTimeout, setInterval, clearInterval } }) {
    Object.assign(this, { adapter, blocker, reader, onState, now, interval, maxAge, timers });
    this.id = null; this.running = false; this.generation = 0; this.lastObservation = 0;
    this.status = { state: 'stopped', blocking: false, scope: 'browser-wide' };
  }
  publish(state) {
    this.status = { state, blocking: this.id !== null, scope: 'browser-wide', browser: this.adapter && this.adapter.label };
    this.onState(this.status);
  }
  release() {
    if (this.id !== null) {
      try { this.blocker.stop(this.id); } finally { this.id = null; }
    }
  }
  start() {
    if (this.running) return;
    if (!this.adapter) { this.publish('unsupported'); return; }
    this.running = true; this.generation++;
    this.publish('checking');
    this.watchdog = this.timers.setInterval(() => {
      if (this.running && this.id !== null && this.now() - this.lastObservation >= this.maxAge) {
        this.release(); this.publish('unavailable');
      }
    }, 500);
    if (this.watchdog.unref) this.watchdog.unref();
    this.tick();
  }
  async tick() {
    if (!this.running || this.pending) return;
    const generation = this.generation, token = {}, started = this.now();
    this.pending = token;
    try {
      const names = (await this.reader.names()).filter(name => this.adapter.prefix.test(name));
      if (names.length > 16) throw new Error('Too many media players');
      const results = await Promise.all(names.map(name => this.reader.player(name).catch(() => null)));
      if (!this.running || generation !== this.generation) return;
      if (this.now() - started >= this.maxAge) throw new Error('Expired media observation');
      const matched = results.filter(item => item && identityMatches(this.adapter, item.identity));
      const playing = matched.some(item => item.status === 'Playing');
      this.lastObservation = started;
      if (playing && this.id === null) this.id = this.blocker.start('prevent-display-sleep');
      if (!playing) this.release();
      this.publish(playing ? 'playing' : matched.length ? 'idle' : results.some(item => item === null) ? 'unavailable' : 'waiting');
    } catch {
      if (this.running && generation === this.generation) { this.release(); this.publish('unavailable'); }
    } finally {
      if (this.pending === token) this.pending = null;
      if (this.running && generation === this.generation) {
        this.timer = this.timers.setTimeout(() => this.tick(), Math.max(0, this.interval - (this.now() - started)));
        if (this.timer.unref) this.timer.unref();
      }
    }
  }
  stop() {
    this.running = false; this.generation++; this.pending = null;
    this.timers.clearTimeout(this.timer); this.timers.clearInterval(this.watchdog);
    this.release(); this.publish('stopped');
  }
}
module.exports = { PlaybackMonitor, createReader, variantString, gdbus, checkPlaybackTools };
