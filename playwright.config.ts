import { defineConfig } from '@playwright/test';

const testPort = '3187';
const isolatedDataDir = './e2e-data';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    url: `http://127.0.0.1:${testPort}`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      HOST: '127.0.0.1',
      PORT: testPort,
      IDEAL_DATA_DIR: isolatedDataDir,
      GESTIONPRO_DATA_DIR: isolatedDataDir,
    },
  },
});
