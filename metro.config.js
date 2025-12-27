const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const fs = require('node:fs');
const { FileStore } = require('metro-cache');
const { reportErrorToRemote } = require('./__create/report-error-to-remote');
const {
  handleResolveRequestError,
  VIRTUAL_ROOT,
  VIRTUAL_ROOT_UNRESOLVED,
} = require('./__create/handle-resolve-request-error');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

fs.mkdirSync(VIRTUAL_ROOT_UNRESOLVED, { recursive: true });
config.watchFolders = [...config.watchFolders, VIRTUAL_ROOT, VIRTUAL_ROOT_UNRESOLVED];

// Add web-specific alias configuration through resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    // Wildcard alias for Expo Google Fonts
    if (moduleName.startsWith('@expo-google-fonts/') && moduleName !== '@expo-google-fonts/dev') {
      return context.resolveRequest(context, '@expo-google-fonts/dev', platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    return handleResolveRequestError({ error, context, platform, moduleName });
  }
};

const cacheDir = path.join(__dirname, 'caches');

config.cacheStores = () => [
  new FileStore({
    root: path.join(cacheDir, '.metro-cache'),
  }),
];
config.resetCache = false;
config.fileMapCacheDirectory = cacheDir;
config.reporter = {
  ...config.reporter,
  update: (event) => {
    config.reporter?.update(event);
    const reportableErrors = [
      'error',
      'bundling_error',
      'cache_read_error',
      'hmr_client_error',
      'transformer_load_failed',
    ];
    for (const errorType of reportableErrors) {
      if (event.type === errorType) {
        reportErrorToRemote({ error: event.error }).catch((reportError) => {
          // no-op
        });
      }
    }
    return event;
  },
};

const originalGetTransformOptions = config.transformer.getTransformOptions;

config.transformer = {
  ...config.transformer,
  getTransformOptions: async (entryPoints, options) => {
    if (options.dev === false) { 
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.mkdirSync(cacheDir);
    }
    return await originalGetTransformOptions(entryPoints, options)
  },
}

module.exports = config;
