const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to fix Agora conflict: aosl.xcframework
 * This happens when both react-native-agora and agora-react-native-rtm are used.
 * We resolve this by removing the duplicate framework from one of the pods in a pre_install hook.
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

      // Remove any existing Agora fix blocks to avoid duplication/conflicts
      const oldFixPattern = /# Agora Conflict Fix:[\s\S]*?(?=post_install|pre_install|end\n|$)/g;
      podfileContent = podfileContent.replace(oldFixPattern, '');
      
      // Also remove the specific pre_install hook if it exists from previous attempts
      const oldPreInstallPattern = /pre_install do \|installer\|[\s\S]*?# Fix Agora aosl\.xcframework conflict[\s\S]*?end\n/g;
      podfileContent = podfileContent.replace(oldPreInstallPattern, '');

      const agoraPreInstallBlock = `
  pre_install do |installer|
    # Fix Agora aosl.xcframework conflict between AgoraRtm and AgoraInfra_iOS
    installer.pod_targets.each do |pod|
      if pod.name == 'AgoraRtm' || pod.name == 'AgoraRtmKit'
        puts "Fixing Agora conflict for #{pod.name}: removing aosl.xcframework"
        pod.spec_consumer.instance_variable_get(:@spec).attributes_hash['vendored_frameworks'].reject! { |f| f.include?('aosl.xcframework') } rescue nil
      end
    end
  end
`;

      // Find a good place to insert the pre_install block
      // We want it before the target 'TownWall' do ... end block ends, or at the top.
      // Usually after platform :ios, ... is a good spot.
      if (!podfileContent.includes('pre_install do |installer|')) {
        podfileContent = podfileContent.replace(
          /target 'TownWall' do/,
          `target 'TownWall' do\n${agoraPreInstallBlock}`
        );
      } else if (!podfileContent.includes('Fix Agora aosl.xcframework conflict')) {
        // If there is already a pre_install block, append our fix inside it
        podfileContent = podfileContent.replace(
          /pre_install do \|installer\|/,
          `pre_install do |installer|\n    # Fix Agora aosl.xcframework conflict between AgoraRtm and AgoraInfra_iOS
    installer.pod_targets.each do |pod|
      if pod.name == 'AgoraRtm' || pod.name == 'AgoraRtmKit'
        puts "Fixing Agora conflict for #{pod.name}: removing aosl.xcframework"
        pod.spec_consumer.instance_variable_get(:@spec).attributes_hash['vendored_frameworks'].reject! { |f| f.include?('aosl.xcframework') } rescue nil
      end
    end`
        );
      }

      fs.writeFileSync(podfilePath, podfileContent);
      return config;
    },
  ]);
};

module.exports = withAgoraFix;
