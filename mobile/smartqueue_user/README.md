# SmartQueue User (Flutter)

Application mobile utilisateur pour la gestion intelligente des files d’attente.

## Stack
- Flutter 3.x (Material 3)
- Riverpod (état)
- Dio (HTTP)
- Geolocator (géoloc)
- qr_code_scanner (QR)
- Firebase Messaging + flutter_local_notifications (push)
- WebSocket (web_socket_channel)

## Démarrage rapide
1) Prérequis: Flutter SDK, Android SDK / Xcode.
2) Installer les dépendances:
```bash
flutter pub get
```
3) Lancer (Android):
```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api --dart-define=WS_URL=ws://10.0.2.2:6001
```
4) Lancer (iOS/simulateur) – adapter l’IP (ex: votre Mac):
```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8000/api --dart-define=WS_URL=ws://192.168.1.10:6001
```

> Par défaut, l’app utilise `API_BASE_URL` et `WS_URL` via `String.fromEnvironment` (voir `lib/core/config.dart`).

## Permissions & plateformes
### Android
- `android/app/src/main/AndroidManifest.xml` inclut INTERNET, CAMERA, ACCESS_FINE/COARSE_LOCATION.

### iOS
Dans `ios/Runner/Info.plist`, ajouter:
```xml
<key>NSCameraUsageDescription</key>
<string>Scanner des QR Codes pour rejoindre une file</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Localiser les établissements proches</string>
```

## Push (Firebase)
- Ajouter `google-services.json` (Android) / `GoogleService-Info.plist` (iOS).
- `PushService.init()` est appelé au démarrage et reste tolérant si non configuré.

## Structure
- `lib/core`: thème, router, config
- `lib/data`: Dio, modèles, repositories
- `lib/services`: géoloc, push, websocket
- `lib/features`: écrans (Accueil, Services, Détails, Ticket, Suivi, QR, Notifications, Historique, Profil)

## API attendue (Laravel)
- GET `/establishments/nearby?lat&lng`
- GET `/establishments/{id}/services`
- GET `/services/{id}`
- POST `/tickets` `{ service_id }`
- GET `/tickets/me`, GET `/tickets/{id}`

## Notes
- Le scanner QR nécessite un appareil/simulateur avec caméra.
- Les notifications push requièrent la configuration Firebase.
