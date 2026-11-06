const { LinuxTargetHelper } = require('app-builder-lib/out/targets/LinuxTargetHelper');
const AppImageTarget = require('app-builder-lib/out/targets/AppImageTarget').default;
const pkg = require('../package.json');

test('the locked builder generates a sandboxed AppImage desktop launch command', async () => {
  const packager = {
    config: pkg.build,
    platformSpecificBuildOptions: pkg.build.linux,
    appInfo: { productName: pkg.name, buildVersion: pkg.version, description: pkg.description },
    executableName: pkg.name,
    fileAssociations: []
  };
  const target = new AppImageTarget('AppImage', packager, new LinuxTargetHelper(packager), 'dist');
  const desktop = await target.desktopEntry.value;
  expect(desktop.split('\n').find(line => line.startsWith('Exec=')))
    .toBe('Exec=AppRun --enable-sandbox %U');
  expect(desktop).not.toContain('--no-sandbox');
});
