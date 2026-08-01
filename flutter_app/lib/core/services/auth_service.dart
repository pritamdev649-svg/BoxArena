import 'dart:developer';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  FirebaseAuth get _auth => FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn.instance;

  // Watch Auth State Changes (Safe check for initialized app)
  Stream<User?> get authStateChanges {
    try {
      if (Firebase.apps.isEmpty) {
        return Stream.value(null); // Fallback mock auth stream
      }
      return _auth.authStateChanges();
    } catch (e) {
      log('Firebase auth state stream access failed: $e');
      return Stream.value(null);
    }
  }

  // Get Current User (Safe check for initialized app)
  User? get currentUser {
    try {
      if (Firebase.apps.isEmpty) return null;
      return _auth.currentUser;
    } catch (e) {
      return null;
    }
  }

  // Google Sign-In
  Future<UserCredential?> signInWithGoogle() async {
    try {
      if (Firebase.apps.isEmpty) {
        log('Firebase is not initialized. Google Sign-In requires active Firebase config.');
        return null;
      }

      // Trigger the Google Sign-In flow using authenticate()
      final GoogleSignInAccount? googleUser = await _googleSignIn.authenticate();
      if (googleUser == null) {
        log('Google Sign-In aborted by user.');
        return null; 
      }

      final GoogleSignInAuthentication googleAuth = googleUser.authentication;

      final AuthCredential credential = GoogleAuthProvider.credential(
        idToken: googleAuth.idToken,
      );

      UserCredential userCredential = await _auth.signInWithCredential(credential);
      log('User signed in with Google successfully: ${userCredential.user?.email}');
      return userCredential;
    } catch (e) {
      log('Error during Google Sign-In: $e');
      return null;
    }
  }

  // Sign Out
  Future<void> signOut() async {
    try {
      await _googleSignIn.signOut();
      if (Firebase.apps.isNotEmpty) {
        await _auth.signOut();
      }
      log('User signed out successfully.');
    } catch (e) {
      log('Error signing out: $e');
    }
  }
}
