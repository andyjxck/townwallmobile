import * as SplashScreen from 'expo-splash-screen';

// Prevent splash screen from hiding automatically as early as possible
SplashScreen.preventAutoHideAsync().catch(() => {});

// Global safety fallback: Force hide splash screen after 6 seconds
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, 6000);

import 'react-native-url-polyfill/auto';
global.Buffer = require('buffer').Buffer;

import CreateApp from './App';
import type { ReactNode } from 'react';
import { AppRegistry, LogBox } from 'react-native';
import { DeviceErrorBoundaryWrapper } from './__create/DeviceErrorBoundary';


let WrapperComponentProvider: any = ({ children }: { children: ReactNode }) => children;

if (__DEV__) {
  LogBox.ignoreAllLogs();
  LogBox.uninstall();
  WrapperComponentProvider = ({ children }: { children: ReactNode }) => {
    return (
      <DeviceErrorBoundaryWrapper>
        {children}
      </DeviceErrorBoundaryWrapper>
    );
  };
}
AppRegistry.setWrapperComponentProvider(() => WrapperComponentProvider);
AppRegistry.registerComponent('main', () => CreateApp);
