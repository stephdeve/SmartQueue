import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/config.dart';

/// Client HTTP Dio avec intercepteur Authorization (Bearer <token>)
class ApiClient {
  final Dio dio;
  ApiClient._(this.dio);

  static Future<ApiClient> create() async {
    final dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 8),
        headers: {
          'Accept': 'application/json',
        },
      ),
    );

    final prefs = await SharedPreferences.getInstance();

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = prefs.getString('token');
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
    ));

    assert(() {
      dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
      ));
      return true;
    }());

    return ApiClient._(dio);
  }
}
