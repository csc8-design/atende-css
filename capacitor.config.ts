import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.engwe.atendecss',
  appName: 'Atende CSS · ENGWE',
  webDir: 'dist',
  server: {
    // url: 'https://SEU-DOMINIO', // defina o domínio publicado do Atende CSS
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a5c2e',
    },
    SplashScreen: {
      launchAutoHide: true,
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
