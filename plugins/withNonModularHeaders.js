const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to allow non-modular headers in iOS.
 * This is often required when using static frameworks with certain dependencies like LiveKit/WebRTC.
 */
const withNonModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.projectRoot, 'ios', 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return config;
      }
      
      let podfileContent = fs.readFileSync(podfilePath, 'utf8');

      const fixString = "config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'";
      
      if (podfileContent.includes(fixString)) {
        return config;
      }

      const postInstallBlock = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end`;

      if (podfileContent.includes('post_install do |installer|')) {
        podfileContent = podfileContent.replace(
          'post_install do |installer|',
          `post_install do |installer|${postInstallBlock}`
        );
      } else {
        podfileContent += `
post_install do |installer|${postInstallBlock}
end
`;
      }

      fs.writeFileSync(podfilePath, podfileContent);
      return config;
    },
  ]);
};

module.exports = withNonModularHeaders;
