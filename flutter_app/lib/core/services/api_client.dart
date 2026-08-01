import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:app/core/constants/app_constants.dart';
import 'package:app/core/providers/profile_provider.dart';

class ApiException implements Exception {
  final String message;
  ApiException(this.message);

  @override
  String toString() => message;
}

class ApiClient {
  final Ref _ref;

  ApiClient(this._ref);

  String _prettyPrintJson(dynamic object) {
    try {
      return const JsonEncoder.withIndent('  ').convert(object);
    } catch (_) {
      return object.toString();
    }
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final url = Uri.parse('${AppConstants.apiBaseUrl}$path');
    final headers = _getHeaders();
    print('[ApiClient] POST $url\nRequest Body:\n${_prettyPrintJson(body)}');
    
    try {
      final response = await http.post(
        url,
        headers: headers,
        body: json.encode(body),
      );
      return _handleResponse(response);
    } on ApiException {
      rethrow;
    } catch (e) {
      print('[ApiClient] POST $path failed: $e');
      throw Exception('Connection failed: $e');
    }
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async {
    final url = Uri.parse('${AppConstants.apiBaseUrl}$path');
    final headers = _getHeaders();
    print('[ApiClient] PATCH $url\nRequest Body:\n${_prettyPrintJson(body)}');
    
    try {
      final response = await http.patch(
        url,
        headers: headers,
        body: json.encode(body),
      );
      return _handleResponse(response);
    } on ApiException {
      rethrow;
    } catch (e) {
      print('[ApiClient] PATCH $path failed: $e');
      throw Exception('Connection failed: $e');
    }
  }

  Future<Map<String, dynamic>> get(String path) async {
    final url = Uri.parse('${AppConstants.apiBaseUrl}$path');
    final headers = _getHeaders();
    print('[ApiClient] GET $url');
    
    try {
      final response = await http.get(url, headers: headers);
      return _handleResponse(response);
    } on ApiException {
      rethrow;
    } catch (e) {
      print('[ApiClient] GET $path failed: $e');
      throw Exception('Connection failed: $e');
    }
  }

  Map<String, String> _getHeaders() {
    final headers = {
      'Content-Type': 'application/json',
    };
    final profile = _ref.read(profileProvider);
    if (profile?.accessToken != null) {
      headers['Authorization'] = 'Bearer ${profile!.accessToken}';
      print('[ApiClient] Authorization token attached');
    }
    return headers;
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    dynamic decoded;
    try {
      decoded = json.decode(response.body);
      print('[ApiClient] Response code: ${response.statusCode}\nResponse Body:\n${_prettyPrintJson(decoded)}');
    } catch (_) {
      print('[ApiClient] Response code: ${response.statusCode}\nRaw Response Body: ${response.body}');
      throw ApiException('Request failed with status: ${response.statusCode}');
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      return {'data': decoded};
    } else {
      var message = 'Request failed';
      if (decoded is Map) {
        final error = decoded['error'];
        if (error is Map) {
          message = error['message'] ?? 'Request failed';
          final details = error['details'];
          if (details is List && details.isNotEmpty) {
            final detailMsgs = details.map((d) {
              if (d is Map) {
                return d['message'] ?? '';
              }
              return '';
            }).where((m) => m.isNotEmpty).join(', ');
            if (detailMsgs.isNotEmpty) {
              message = detailMsgs;
            }
          }
        }
      }
      throw ApiException(message);
    }
  }
}

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient(ref));
