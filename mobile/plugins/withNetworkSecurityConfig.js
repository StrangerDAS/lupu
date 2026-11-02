const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to configure Android Network Security Policy:
 * 1. Restricts cleartext traffic globally in main/release AndroidManifest and enables networkSecurityConfig.
 * 2. In release/production (src/main/res/xml/network_security_config.xml), cleartextTrafficPermitted is false.
 * 3. In development/debug (src/debug/res/xml/network_security_config.xml), cleartext is permitted only for
 *    local development domains (10.0.2.2 for Android emulator, localhost, 127.0.0.1).
 */
const withNetworkSecurityConfig = (config) => {
  // 1. AndroidManifest mod for main application
  config = withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (mainApplication && mainApplication.$) {
      // Remove any global usesCleartextTraffic from main manifest
      delete mainApplication.$['android:usesCleartextTraffic'];
      // Point to network_security_config XML
      mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    }
    return config;
  });

  // 2. Dangerous mod to write XML configuration files safely during expo prebuild
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      // ── Main (Production / Default) Config ──
      const mainResXmlDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(mainResXmlDir, { recursive: true });
      const mainConfigXml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Production: All cleartext HTTP is strictly prohibited. Production API must use HTTPS. -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;
      fs.writeFileSync(path.join(mainResXmlDir, 'network_security_config.xml'), mainConfigXml);

      // ── Debug (Development Only) Config ──
      const debugResXmlDir = path.join(projectRoot, 'android', 'app', 'src', 'debug', 'res', 'xml');
      fs.mkdirSync(debugResXmlDir, { recursive: true });
      const debugConfigXml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Development: Permitted only for local emulator (10.0.2.2) and localhost testing -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
    </domain-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;
      fs.writeFileSync(path.join(debugResXmlDir, 'network_security_config.xml'), debugConfigXml);

      // Also support debugOptimized if present
      const debugOptResXmlDir = path.join(projectRoot, 'android', 'app', 'src', 'debugOptimized', 'res', 'xml');
      if (fs.existsSync(path.join(projectRoot, 'android', 'app', 'src', 'debugOptimized'))) {
        fs.mkdirSync(debugOptResXmlDir, { recursive: true });
        fs.writeFileSync(path.join(debugOptResXmlDir, 'network_security_config.xml'), debugConfigXml);
      }

      return config;
    },
  ]);

  return config;
};

module.exports = withNetworkSecurityConfig;
