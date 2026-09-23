import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cbmaq.atendepro',
  appName: 'AtendePro',
  webDir: 'dist',
  server: {
    url: 'https://atendimento.cbmaq.com.br',
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
