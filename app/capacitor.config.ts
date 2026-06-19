import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.groovymark.greenhouse',
  appName: 'Greenhouse',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Allows the app to call your VPS over http/https.
    cleartext: true,
  },
  plugins: {
    StatusBar: { style: 'LIGHT', backgroundColor: '#1f4a2c' },
  },
};

export default config;
