/* global __dirname */
const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

// Chemin du fichier Firebase Android (google-services.json).
// Requis pour que FCM s'initialise dans le build natif : sans lui,
// getExpoPushTokenAsync / getDevicePushTokenAsync échoue avec
// "Default FirebaseApp is not initialized".
// Surchageable via la variable d'env GOOGLE_SERVICES_JSON (utile sur EAS).
const androidGoogleServices =
  process.env.GOOGLE_SERVICES_JSON || './google-services.json';
const iosGoogleServices =
  process.env.GOOGLE_SERVICES_INFO_PLIST || './GoogleService-Info.plist';

const hasAndroidFirebase = fs.existsSync(
  path.resolve(__dirname, androidGoogleServices),
);
const hasIosFirebase = fs.existsSync(
  path.resolve(__dirname, iosGoogleServices),
);

module.exports = {
  ...appJson.expo,
  ios: {
    ...appJson.expo.ios,
    ...(hasIosFirebase ? { googleServicesFile: iosGoogleServices } : {}),
  },
  android: {
    ...appJson.expo.android,
    // N'ajoute la clé que si le fichier existe, pour ne pas casser les builds
    // (prebuild / EAS) quand google-services.json n'est pas encore fourni.
    ...(hasAndroidFirebase ? { googleServicesFile: androidGoogleServices } : {}),
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '',
      },
    },
  },
};