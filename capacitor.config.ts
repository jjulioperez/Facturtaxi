import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.facturtaxi.app",
  appName: "Facturtaxi",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
