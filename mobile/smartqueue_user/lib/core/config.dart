// Centralise la configuration de l'app (URLs, chemins, options)
class AppConfig {
  // Base API Laravel. Adapter selon votre backend (10.0.2.2 = localhost Android emulator)
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api',
  );

  // URL WebSocket (ex: ws://10.0.2.2:6001). Adapter à votre stack temps réel
  static const String wsUrl = String.fromEnvironment(
    'WS_URL',
    defaultValue: 'ws://10.0.2.2:6001',
  );

  // Auth
  static const login = '/auth/login';
  static const register = '/auth/register';
  static const logout = '/auth/logout';
  static const deviceRegister = '/auth/devices/register';

  // Établissements et services (public)
  static const establishments = '/establishments'; // ?lat&lng&radius&per_page
  static String establishmentById(int id) => '/establishments/$id';
  static String servicesByEst(int id) => '/establishments/$id/services';
  static String serviceDetail(int id) => '/services/$id';
  static String serviceAffluence(int id) => '/services/$id/affluence';
  static String serviceRecommendations(int id) => '/services/$id/recommendations';

  // Tickets (auth:sanctum)
  static const createTicket = '/tickets';
  static const activeTickets = '/tickets/active';
  static const historyTickets = '/tickets/history';
  static String ticketById(int id) => '/tickets/$id';
}
