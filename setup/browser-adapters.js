const path = require('path');
const { parseCommand } = require('./browser-dependencies');
const adapters = {
  chromium: { label: 'Chromium', identities: ['chromium', 'ungoogledchromium'], classes: ['chromium', 'chromium-browser', 'ungoogled-chromium'], prefix: /^org\.mpris\.MediaPlayer2\.chromium(?:[._-]|$)/ },
  chrome: { label: 'Google Chrome', identities: ['googlechrome', 'googlechromebeta', 'googlechromeunstable'], classes: ['google-chrome', 'google-chrome-beta', 'google-chrome-unstable'], prefix: /^org\.mpris\.MediaPlayer2\.(?:chromium|chrome)(?:[._-]|$)/ },
  brave: { label: 'Brave', identities: ['brave', 'bravebrowser'], classes: ['brave-browser', 'brave'], prefix: /^org\.mpris\.MediaPlayer2\.(?:chromium|brave)(?:[._-]|$)/ },
  firefox: { label: 'Firefox', identities: ['firefox', 'firefoxesr', 'mozillafirefox'], classes: ['firefox', 'firefox-esr'], prefix: /^org\.mpris\.MediaPlayer2\.firefox(?:[._-]|$)/ }
};
const flatpaks = { 'io.github.ungoogled_software.ungoogled_chromium': 'chromium', 'org.chromium.Chromium': 'chromium',
  'com.google.Chrome': 'chrome', 'com.brave.Browser': 'brave', 'org.mozilla.firefox': 'firefox' };
function browserAdapter(command) {
  let args;
  try { args = Array.isArray(command) ? command : parseCommand(command || ''); } catch { return null; }
  const executable = path.basename(args[0] || '').toLowerCase();
  let key;
  if (executable === 'flatpak') key = flatpaks[args.find(arg => Object.hasOwn(flatpaks, arg))];
  else key = Object.keys(adapters).find(name => adapters[name].classes.includes(executable));
  return key ? { key, ...adapters[key] } : null;
}
function identityMatches(adapter, identity) {
  return Boolean(adapter && typeof identity === 'string' && adapter.identities.includes(identity.toLowerCase().replace(/[\s_-]/g, '')));
}
module.exports = { browserAdapter, identityMatches };
