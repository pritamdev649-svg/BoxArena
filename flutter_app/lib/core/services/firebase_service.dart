import 'dart:developer';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class FirebaseService {
  static final FirebaseService _instance = FirebaseService._internal();
  factory FirebaseService() => _instance;
  FirebaseService._internal();

  FirebaseMessaging get _messaging => FirebaseMessaging.instance;

  Future<void> init() async {
    // Initialize Firebase
    await Firebase.initializeApp();

    // Request permissions (primarily for iOS, but good practice for Android 13+)
    NotificationSettings settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      log('User granted notification permission');
    } else {
      log('User declined or has not accepted notification permission');
    }

    // Configure foreground notifications behavior
    await _messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    // Setup background handler
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Setup foreground message listener
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      log('Received foreground message: ${message.notification?.title}');
      // Handle foreground message (e.g. show local notification / dialog)
    });

    // Handle when user taps notification to open the app
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      log('Notification caused app to open: ${message.data}');
      // Navigate to correct screen based on message data
    });
  }

  // Get FCM Token to register with backend
  Future<String?> getFcmToken() async {
    try {
      if (Firebase.apps.isEmpty) {
        return null;
      }
      String? token = await _messaging.getToken();
      log('FCM Token: $token');
      return token;
    } catch (e) {
      log('Error getting FCM Token: $e');
      return null;
    }
  }
}

// Background Message Handler
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Make sure Firebase is initialized for background processes
  await Firebase.initializeApp();
  log('Handling background message: ${message.messageId}');
}
