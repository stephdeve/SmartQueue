import 'dart:convert';
import 'dart:io' show Platform;
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/config.dart';
import '../../data/api_client.dart';
import '../../services/push_service.dart';

class AuthUser {
  final int id;
  final String name;
  final String email;
  final String role;
  final String? phone;
  const AuthUser({required this.id, required this.name, required this.email, required this.role, this.phone});

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: j['id'] as int,
        name: j['name'] as String,
        email: j['email'] as String,
        role: j['role'] as String,
        phone: j['phone'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'role': role,
        'phone': phone,
      };
}

class AuthRepository {
  final Dio _dio;
  AuthRepository(this._dio);

  static Future<AuthRepository> create() async {
    final api = await ApiClient.create();
    return AuthRepository(api.dio);
  }

  Future<(String token, AuthUser user)> login({required String email, required String password}) async {
    final res = await _dio.post(AppConfig.login, data: {'email': email, 'password': password});
    final data = res.data as Map<String, dynamic>;
    final token = data['token'] as String;
    final user = AuthUser.fromJson(data['user'] as Map<String, dynamic>);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
    await prefs.setString('user', json.encode(user.toJson()));

    // Enregistrement du device FCM (best-effort)
    try {
      final fcm = await PushServiceToken.getFcmToken();
      if (fcm != null && fcm.isNotEmpty) {
        await _dio.post(AppConfig.deviceRegister, data: {
          'fcm_token': fcm,
          'platform': Platform.isAndroid ? 'android' : (Platform.isIOS ? 'ios' : 'web'),
          'push_enabled': true,
        });
      }
    } catch (_) {}
    return (token, user);
  }

  Future<void> logout() async {
    try {
      await _dio.post(AppConfig.logout);
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');
  }

  Future<(String? token, AuthUser?)> current() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    final userStr = prefs.getString('user');
    if (token == null) return (null, null);
    if (userStr == null) return (token, null);
    try {
      final map = json.decode(userStr) as Map<String, dynamic>;
      return (token, AuthUser.fromJson(map));
    } catch (_) {
      return (token, null);
    }
  }
}
