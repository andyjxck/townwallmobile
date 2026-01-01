const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to fix Agora conflict: aosl.xcframework
 * This happens when both react-native-agora and agora-react-native-rtm are used.
 */
const withAgoraFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.projectRoot, 'ios', 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return config;
      }
      
      let podfileContent = fs.readFileSync(podfilePath, 'utf8');

      const agoraFixIdentifier = "# Agora Conflict Fix: aosl.xcframework";
      
      if (podfileContent.includes(agoraFixIdentifier)) {
        return config;
      }

      const agoraFixBlock = `
    ${agoraFixIdentifier}
    installer.pods_project.targets.each do |target|
      if target.name == 'AgoraRtm' || target.name == 'AgoraRtmKit'
        target.build_configurations.each do |config|
          config.build_settings['EXCLUDED_SOURCE_FILE_NAMES'] = 'aosl.xcframework'
        end
      end
    end`;

      if (podfileContent.includes('post_install do |installer|')) {
        podfileContent = podfileContent.replace(
          'post_install do |installer|',
          `post_install do |installer|${agoraFixBlock}`
        );
      } else {
        podfileContent += `
post_install do |installer|${agoraFixBlock}
end
`;
      }

      fs.writeFileSync(podfilePath, podfileContent);
      return config;
    },
  ]);
};

module.exports = withAgoraFix;
