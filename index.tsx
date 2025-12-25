import ExceptionsManager from 'react-native/Libraries/Core/ExceptionsManager';

if (__DEV__) {
  ExceptionsManager.handleException = (error, isFatal) => {
    // no-op
  };
}

import 'react-native-url-polyfill/auto';
import './src/__create/polyfills';
global.Buffer = require('buffer').Buffer;

import CreateApp from './App';
import type { ReactNode } from 'react';
import { AppRegistry, LogBox } from 'react-native';
import { DeviceErrorBoundaryWrapper } from './__create/DeviceErrorBoundary';
import AnythingMenu from './src/__create/anything-menu';


function AnythingMenuWrapper({ children }: { children: ReactNode }) {
  return (
    <AnythingMenu>
      {children}
    </AnythingMenu>
  );
};

let WrapperComponentProvider = AnythingMenuWrapper;

if (__DEV__) {
  LogBox.ignoreAllLogs();
  LogBox.uninstall();
  WrapperComponentProvider = ({ children }) => {
    return (
      <DeviceErrorBoundaryWrapper>
        <AnythingMenuWrapper>{children}</AnythingMenuWrapper>
      </DeviceErrorBoundaryWrapper>
    );
  };
}
AppRegistry.setWrapperComponentProvider(() => WrapperComponentProvider);
AppRegistry.registerComponent('main', () => CreateApp);
