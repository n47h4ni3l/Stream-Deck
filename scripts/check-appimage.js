// Inspect the actual AppImage. Extraction and launcher dispatch use a disposable
// directory and a harmless argument-recording executable, never the real app.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

function checkAppImage(image) {
  assert.ok(image, 'Pass an AppImage path');
  const source = path.resolve(image);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdeck-appimage-check-'));
  // A downloaded AppImage may lack executable permissions. Do not alter it.
  const executable = path.join(tmp, 'inspect.AppImage');
  const env = { ...process.env };
  for (const key of ['LD_PRELOAD', 'ELECTRON_RUN_AS_NODE', 'APPIMAGE', 'APPDIR',
    'APPIMAGE_EXTRACT_AND_RUN', 'APPIMAGE_EXIT_AFTER_INSTALL', 'BASH_ENV']) delete env[key];
  function run(file, args, commandEnv = env) {
    const result = spawnSync(file, args, {
      cwd: tmp, env: commandEnv, encoding: 'utf8', timeout: 30000
    });
    assert.ifError(result.error);
    assert.strictEqual(result.status, 0, `${file}: ${result.stderr}\n${result.stdout}`);
  }
  try {
    fs.copyFileSync(source, executable);
    fs.chmodSync(executable, 0o700);
    run(executable, ['--appimage-extract', '*.desktop']);
    run(executable, ['--appimage-extract', 'AppRun']);
    const appDir = path.join(tmp, 'squashfs-root');
    const entries = fs.readdirSync(appDir).filter(file => file.endsWith('.desktop'));
    assert.deepStrictEqual(entries, ['streamdeck-launcher.desktop'], 'Unexpected AppImage desktop files');
    const desktop = fs.readFileSync(path.join(appDir, entries[0]), 'utf8');
    const commands = desktop.split(/\r?\n/).filter(line => line.startsWith('Exec='));
    assert.deepStrictEqual(commands, ['Exec=AppRun --enable-sandbox %U'],
      'AppImage desktop entry must enable sandboxing instead of inheriting the builder default');
    const appRun = fs.readFileSync(path.join(appDir, 'AppRun'), 'utf8');
    assert.ok(!/--(?:no-sandbox|disable-(?:setuid|namespace|gpu)-sandbox)/.test(appRun),
      'AppRun must not add a sandbox-disabling flag');
    run('desktop-file-validate', [path.join(appDir, entries[0])]);

    // Simulate desktop integration dispatch through the actual packaged AppRun.
    // The generated Exec syntax is deliberately checked exactly above.
    const argsFile = path.join(tmp, 'arguments');
    fs.writeFileSync(path.join(appDir, 'streamdeck-launcher'),
      '#!/bin/bash\nprintf \'%s\\0\' "$@" > "$STREAMDECK_ARG_LOG"\n', { mode: 0o700 });
    const fixtureUrl = 'https://example.invalid/desktop-fixture';
    const args = commands[0].slice('Exec='.length).split(' ').slice(1, -1);
    run(path.join(appDir, 'AppRun'), [...args, fixtureUrl], {
      ...env, APPDIR: appDir, APPIMAGE: source, DEBUG: '', STREAMDECK_ARG_LOG: argsFile
    });
    assert.deepStrictEqual(fs.readFileSync(argsFile, 'utf8').split('\0').filter(Boolean),
      ['--enable-sandbox', fixtureUrl], 'Packaged AppRun changed the desktop launch arguments');
    return {
      desktopFile: entries[0], exec: commands[0].slice('Exec='.length),
      appRunSha256: crypto.createHash('sha256').update(appRun).digest('hex'),
      desktopDispatch: ['--enable-sandbox', fixtureUrl]
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try { console.log(JSON.stringify(checkAppImage(process.argv[2]), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { checkAppImage };
