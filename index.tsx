import ExceptionsManager from 'react-native/Libraries/Core/ExceptionsManager';

if (__DEV__) {
  ExceptionsManager.handleException = (error, isFatal) => {
    // no-op
  };
}

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
