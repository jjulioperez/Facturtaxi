/**
 * @format
 */

// Polyfills necesarios para reutilizar node-forge/@signpdf (firma PAdES) y
// @supabase/supabase-js tal cual en React Native. Deben cargarse antes que
// cualquier otro import que los use.
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;
import 'react-native-url-polyfill/auto';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
