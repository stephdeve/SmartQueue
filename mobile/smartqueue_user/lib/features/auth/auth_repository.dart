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
    final data = res.data is Map ? (res.data as Map).cast<String, dynamic>() : <String, dynamic>{};

    // Extract token from common shapes
    String? token;
    if (data['token'] is String) token = data['token'] as String;
    if (token == null && data['access_token'] is String) token = data['access_token'] as String;
    if (token == null && data['authorization'] is Map) {
      final auth = (data['authorization'] as Map).cast<String, dynamic>();
      if (auth['token'] is String) token = auth['token'] as String;
    }
    if (token == null && data['data'] is Map) {
      final d = (data['data'] as Map).cast<String, dynamic>();
      if (d['token'] is String) token = d['token'] as String;
      if (token == null && d['access_token'] is String) token = d['access_token'] as String;
    }
    if (token == null || token.isEmpty) {
      throw Exception('Réponse de l\'API inattendue: token manquant.');
    }

    // Extract user map from common shapes
    Map<String, dynamic>? u;
    if (data['user'] is Map) u = (data['user'] as Map).cast<String, dynamic>();
    if (u == null && data['data'] is Map) {
      final d = (data['data'] as Map).cast<String, dynamic>();
      if (d['user'] is Map) {
        u = (d['user'] as Map).cast<String, dynamic>();
      } else {
        // Some APIs return the user directly under data
        u = d;
      }
    }

    AuthUser user;
    try {
      if (u != null) {
        user = AuthUser.fromJson(u);
      } else {
        // Minimal fallback user if backend doesn't return user details
        user = AuthUser(id: -1, name: email.split('@').first, email: email, role: 'user');
      }
    } catch (_) {
      // Tolerant fallback mapping for differing field names
      final rawId = u?['id'];
      final id = (rawId is int)
          ? rawId
          : int.tryParse(rawId?.toString() ?? '') ?? -1;
      final name = (u?['name'] as String?) ?? (u?['full_name'] as String?) ?? (u?['username'] as String?) ?? email.split('@').first;
      final mail = (u?['email'] as String?) ?? email;
      final role = (u?['role'] as String?) ?? 'user';
      final phone = u?['phone'] as String?;
      user = AuthUser(id: id, name: name, email: mail, role: role, phone: phone);
    }

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
