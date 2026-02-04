# Google Play Billing Implementation Guide for Flutter

## Complete Guide to Implementing Subscriptions with Server-Side Verification

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Google Play Console Setup](#google-play-console-setup)
5. [Flutter Client Implementation](#flutter-client-implementation)
6. [Express Server Implementation](#express-server-implementation)
7. [Real-Time Developer Notifications (RTDN)](#real-time-developer-notifications-rtdn)
8. [Security Best Practices](#security-best-practices)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides a complete implementation of Google Play Billing for subscriptions in a Flutter application with server-side validation. The architecture ensures all purchase verification happens on your Express server, preventing client-side tampering and ensuring payment security.

### Key Components

- **Flutter App (Client)**: Initiates purchases, displays products, handles UI
- **Google Play Billing**: Manages payment processing and subscription lifecycle
- **Express Server**: Verifies purchase tokens, manages subscription state
- **Google Cloud Pub/Sub**: Delivers real-time notifications for subscription events
- **Google Play Developer API**: Server-side verification and subscription management

### Purchase Flow

```
User → Flutter App → Google Play Billing → Purchase Token
         ↓
Express Server → Google Play Developer API → Verification
         ↓
Database Update → Send Response to Client
```

---

## Architecture

### System Architecture Diagram

```
┌─────────────────┐
│   Flutter App   │
│   (Client)      │
└────────┬────────┘
         │
         │ 1. Initiate Purchase
         ↓
┌─────────────────────┐
│  Google Play Store  │
│  Billing Library    │
└────────┬────────────┘
         │
         │ 2. Purchase Token
         ↓
┌─────────────────────┐
│  Express Server     │
│  (Backend)          │
└────────┬────────────┘
         │
         │ 3. Verify Token
         ↓
┌─────────────────────────────┐
│  Google Play Developer API  │
└────────┬────────────────────┘
         │
         │ 4. Validation Response
         ↓
┌─────────────────────┐
│  Database           │
│  (Subscription DB)  │
└─────────────────────┘

         ┌──────────────────┐
         │  Cloud Pub/Sub   │
         │  (Webhooks)      │
         └────────┬─────────┘
                  │
                  │ 5. Real-time Events
                  ↓
         ┌──────────────────┐
         │  Express Server  │
         │  (Webhook Handler)│
         └──────────────────┘
```

### Security Model

**Never trust the client.** All subscription validation and entitlement checks must occur server-side:

- Client receives purchase token from Google Play
- Client sends token to your server
- Server verifies token with Google Play Developer API
- Server updates subscription status in database
- Server returns entitlement status to client

---

## Prerequisites

### Required Accounts and Tools

1. **Google Play Console Account**
   - Developer account ($25 one-time fee)
   - App published (at least to internal testing)

2. **Google Cloud Platform Account**
   - Project created and linked to Play Console
   - Billing enabled
   - Service account with appropriate permissions

3. **Development Environment**
   - Flutter SDK (3.0+)
   - Node.js (16+) for Express server
   - Android Studio with Android SDK

4. **Required Permissions**
   - `android.permission.INTERNET` in AndroidManifest.xml
   - `com.android.vending.BILLING` permission (auto-added by plugin)

---

## Google Play Console Setup

### Step 1: Create Your App

1. Go to [Google Play Console](https://play.google.com/console)
2. Create or select your app
3. Complete the app content and store listing requirements

### Step 2: Create Subscription Products

1. Navigate to **Monetize → Products → Subscriptions**
2. Click **Create subscription**
3. Configure your subscription:

```
Product ID: premium_monthly
Name: Premium Monthly Subscription
Description: Access to all premium features
Price: $9.99/month
Billing Period: 1 month
Free Trial: 7 days (optional)
Grace Period: 3 days (recommended)
```

**Important Fields:**

- **Product ID**: Unique identifier (e.g., `premium_monthly`, `premium_yearly`)
- **Base Plans**: Define pricing, billing period, and renewal type
- **Offers**: Optional promotional pricing (free trials, introductory pricing)

### Step 3: Create a Service Account

This is crucial for server-side API access.

1. Go to **Setup → API Access** in Play Console
2. Click **Create new service account**
3. Follow link to Google Cloud Console
4. In Google Cloud Console:
   - Click **+ CREATE SERVICE ACCOUNT**
   - Name: `play-billing-server`
   - Click **Create and Continue**
   - Grant role: **Service Account User**
   - Click **Done**

5. Create and download JSON key:
   - Click on the created service account
   - Go to **Keys** tab
   - Click **Add Key → Create new key**
   - Select **JSON**
   - Download and **securely store** the JSON file

6. Back in Play Console:
   - Click **Done**
   - Find your service account and click **Grant access**
   - Grant permissions:
     - **Admin (all permissions)** or
     - At minimum: **View financial data, Manage orders and subscriptions**

### Step 4: Enable Google Play Developer API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Navigate to **APIs & Services → Library**
4. Search for **Google Play Android Developer API**
5. Click **Enable**

### Step 5: Configure Real-Time Developer Notifications

1. In Play Console, go to **Monetize → Monetization setup**
2. Scroll to **Real-time developer notifications**
3. You'll configure the Pub/Sub topic here (we'll create it in the RTDN section)

---

## Flutter Client Implementation

### Step 1: Add Dependencies

Add to `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  in_app_purchase: ^3.1.13
  http: ^1.2.0
  shared_preferences: ^2.2.2
```

Run:
```bash
flutter pub get
```

### Step 2: Configure Android

Update `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Internet permission for API calls -->
    <uses-permission android:name="android.permission.INTERNET"/>
    
    <!-- Billing permission (automatically added by plugin, but good to verify) -->
    <uses-permission android:name="com.android.vending.BILLING" />
    
    <application
        android:label="Your App"
        android:icon="@mipmap/ic_launcher">
        <!-- Your activities -->
    </application>
</manifest>
```

### Step 3: Create Billing Service

Create `lib/services/billing_service.dart`:

```dart
import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class BillingService {
  static final BillingService _instance = BillingService._internal();
  factory BillingService() => _instance;
  BillingService._internal();

  final InAppPurchase _inAppPurchase = InAppPurchase.instance;
  late StreamSubscription<List<PurchaseDetails>> _subscription;
  
  // Your subscription product IDs
  static const String premiumMonthly = 'premium_monthly';
  static const String premiumYearly = 'premium_yearly';
  
  static const Set<String> _productIds = {
    premiumMonthly,
    premiumYearly,
  };

  // Your Express server URL
  static const String serverUrl = 'https://your-server.com/api';
  
  List<ProductDetails> _products = [];
  bool _isAvailable = false;
  bool _purchasePending = false;
  String? _queryProductError;

  // Getters
  List<ProductDetails> get products => _products;
  bool get isAvailable => _isAvailable;
  bool get purchasePending => _purchasePending;

  /// Initialize the billing service
  Future<void> initialize() async {
    // Check if billing is available
    _isAvailable = await _inAppPurchase.isAvailable();
    
    if (!_isAvailable) {
      debugPrint('In-app purchase is not available');
      return;
    }

    // Set up purchase listener
    final Stream<List<PurchaseDetails>> purchaseUpdated =
        _inAppPurchase.purchaseStream;
    
    _subscription = purchaseUpdated.listen(
      (List<PurchaseDetails> purchaseDetailsList) {
        _handlePurchaseUpdates(purchaseDetailsList);
      },
      onDone: () {
        _subscription.cancel();
      },
      onError: (error) {
        debugPrint('Purchase stream error: $error');
      },
    );

    // Load products
    await loadProducts();
    
    // Restore past purchases (important for subscriptions)
    await restorePurchases();
  }

  /// Load available products from Google Play
  Future<void> loadProducts() async {
    if (!_isAvailable) return;

    try {
      final ProductDetailsResponse response =
          await _inAppPurchase.queryProductDetails(_productIds);

      if (response.notFoundIDs.isNotEmpty) {
        debugPrint('Products not found: ${response.notFoundIDs}');
      }

      if (response.error != null) {
        _queryProductError = response.error!.message;
        debugPrint('Error loading products: ${response.error}');
        return;
      }

      _products = response.productDetails;
      debugPrint('Loaded ${_products.length} products');
      
      for (var product in _products) {
        debugPrint('Product: ${product.id} - ${product.title} - ${product.price}');
      }
    } catch (e) {
      debugPrint('Exception loading products: $e');
    }
  }

  /// Purchase a subscription
  Future<bool> purchaseSubscription(ProductDetails product) async {
    if (!_isAvailable) {
      throw Exception('Billing not available');
    }

    _purchasePending = true;

    try {
      final PurchaseParam purchaseParam = PurchaseParam(
        productDetails: product,
      );

      // For subscriptions, use buyNonConsumable
      final bool success = await _inAppPurchase.buyNonConsumable(
        purchaseParam: purchaseParam,
      );

      return success;
    } catch (e) {
      _purchasePending = false;
      debugPrint('Purchase error: $e');
      rethrow;
    }
  }

  /// Handle purchase updates from the purchase stream
  Future<void> _handlePurchaseUpdates(
      List<PurchaseDetails> purchaseDetailsList) async {
    
    for (final PurchaseDetails purchaseDetails in purchaseDetailsList) {
      debugPrint('Purchase status: ${purchaseDetails.status}');
      
      if (purchaseDetails.status == PurchaseStatus.pending) {
        _purchasePending = true;
      } else {
        _purchasePending = false;
        
        if (purchaseDetails.status == PurchaseStatus.error) {
          _handleError(purchaseDetails.error!);
        } else if (purchaseDetails.status == PurchaseStatus.purchased ||
            purchaseDetails.status == PurchaseStatus.restored) {
          
          // Verify purchase on server
          final bool valid = await _verifyPurchase(purchaseDetails);
          
          if (valid) {
            debugPrint('Purchase verified successfully');
            // Grant entitlement (update local state, UI, etc.)
            await _grantEntitlement(purchaseDetails);
          } else {
            debugPrint('Purchase verification failed');
            // Handle verification failure
            _handleError(IAPError(
              source: 'verification',
              code: 'verification_failed',
              message: 'Could not verify purchase with server',
            ));
          }
        }

        // Always complete the purchase (important!)
        if (purchaseDetails.pendingCompletePurchase) {
          await _inAppPurchase.completePurchase(purchaseDetails);
          debugPrint('Purchase completed');
        }
      }
    }
  }

  /// Verify purchase with your Express server
  Future<bool> _verifyPurchase(PurchaseDetails purchaseDetails) async {
    try {
      // Extract purchase token
      String? purchaseToken;
      
      if (Platform.isAndroid) {
        final androidDetails =
            purchaseDetails as GooglePlayPurchaseDetails;
        purchaseToken = androidDetails.billingClientPurchase.purchaseToken;
      }

      if (purchaseToken == null) {
        debugPrint('No purchase token available');
        return false;
      }

      // Send to your server for verification
      final response = await http.post(
        Uri.parse('$serverUrl/verify-purchase'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'purchaseToken': purchaseToken,
          'productId': purchaseDetails.productID,
          'userId': await _getUserId(), // Your user ID
        }),
      ).timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['valid'] == true;
      } else {
        debugPrint('Server verification failed: ${response.statusCode}');
        return false;
      }
    } catch (e) {
      debugPrint('Verification error: $e');
      return false;
    }
  }

  /// Get user ID (implement based on your auth system)
  Future<String> _getUserId() async {
    // TODO: Return your authenticated user's ID
    // This could come from Firebase Auth, your own auth system, etc.
    return 'user_123';
  }

  /// Grant entitlement to user
  Future<void> _grantEntitlement(PurchaseDetails purchaseDetails) async {
    // Update local state
    // Show success UI
    // Update user preferences
    // Notify other parts of the app
    debugPrint('Granting entitlement for ${purchaseDetails.productID}');
  }

  /// Restore past purchases
  Future<void> restorePurchases() async {
    if (!_isAvailable) return;

    try {
      await _inAppPurchase.restorePurchases();
      debugPrint('Purchases restored');
    } catch (e) {
      debugPrint('Restore purchases error: $e');
    }
  }

  /// Check subscription status with server
  Future<bool> checkSubscriptionStatus() async {
    try {
      final response = await http.post(
        Uri.parse('$serverUrl/check-subscription'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': await _getUserId(),
        }),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['isActive'] == true;
      }
      return false;
    } catch (e) {
      debugPrint('Subscription check error: $e');
      return false;
    }
  }

  /// Handle errors
  void _handleError(IAPError error) {
    debugPrint('IAP Error: ${error.code} - ${error.message}');
    // Show error to user
    // Log to analytics
  }

  /// Dispose
  void dispose() {
    _subscription.cancel();
  }
}
```

### Step 4: Create UI for Subscriptions

Create `lib/screens/subscription_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../services/billing_service.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({Key? key}) : super(key: key);

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  final BillingService _billingService = BillingService();
  bool _isLoading = true;
  bool _isSubscribed = false;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    await _billingService.initialize();
    await _checkSubscriptionStatus();
    setState(() {
      _isLoading = false;
    });
  }

  Future<void> _checkSubscriptionStatus() async {
    final isActive = await _billingService.checkSubscriptionStatus();
    setState(() {
      _isSubscribed = isActive;
    });
  }

  Future<void> _handlePurchase(ProductDetails product) async {
    try {
      setState(() {
        _isLoading = true;
      });

      await _billingService.purchaseSubscription(product);

      // Wait a moment for processing
      await Future.delayed(const Duration(seconds: 2));
      
      // Check status again
      await _checkSubscriptionStatus();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Subscription activated!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleRestore() async {
    try {
      setState(() {
        _isLoading = true;
      });

      await _billingService.restorePurchases();
      
      // Wait for processing
      await Future.delayed(const Duration(seconds: 2));
      
      await _checkSubscriptionStatus();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Purchases restored'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Restore failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Premium Subscription'),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _handleRestore,
            child: const Text(
              'Restore',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _isSubscribed
              ? _buildSubscribedView()
              : _buildProductsList(),
    );
  }

  Widget _buildSubscribedView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.check_circle,
            size: 100,
            color: Colors.green[600],
          ),
          const SizedBox(height: 24),
          const Text(
            'You\'re Subscribed!',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Enjoy all premium features',
            style: TextStyle(fontSize: 16),
          ),
        ],
      ),
    );
  }

  Widget _buildProductsList() {
    final products = _billingService.products;

    if (products.isEmpty) {
      return const Center(
        child: Text('No subscription plans available'),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: products.length,
      itemBuilder: (context, index) {
        final product = products[index];
        return _buildProductCard(product);
      },
    );
  }

  Widget _buildProductCard(ProductDetails product) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              product.title,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              product.description,
              style: const TextStyle(fontSize: 14),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  product.price,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.blue,
                  ),
                ),
                ElevatedButton(
                  onPressed: _billingService.purchasePending
                      ? null
                      : () => _handlePurchase(product),
                  child: const Text('Subscribe'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
```

### Step 5: Initialize in Main App

Update `lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'services/billing_service.dart';
import 'screens/subscription_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize billing service
  await BillingService().initialize();
  
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Subscription App',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const SubscriptionScreen(),
    );
  }
}
```

---

## Express Server Implementation

### Step 1: Project Setup

Initialize your Node.js project:

```bash
mkdir subscription-server
cd subscription-server
npm init -y
npm install express googleapis body-parser dotenv
npm install --save-dev nodemon
```

### Step 2: Environment Configuration

Create `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Google Play Configuration
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
GOOGLE_PACKAGE_NAME=com.yourcompany.yourapp

# Database Configuration (adjust based on your DB)
DATABASE_URL=postgresql://user:password@localhost:5432/subscriptions

# Pub/Sub Configuration
PUBSUB_TOPIC=projects/your-project-id/topics/play-billing
PUBSUB_SUBSCRIPTION=projects/your-project-id/subscriptions/play-billing-sub
```

**Important:** Copy your service account JSON key file to the project directory and name it `service-account-key.json`. Add it to `.gitignore`.

### Step 3: Google Play API Client

Create `src/utils/playApi.js`:

```javascript
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class PlayApiClient {
  constructor() {
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    
    this.auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    this.androidPublisher = google.androidpublisher({
      version: 'v3',
      auth: this.auth,
    });

    this.packageName = process.env.GOOGLE_PACKAGE_NAME;
  }

  /**
   * Verify a subscription purchase
   * @param {string} subscriptionId - The subscription product ID
   * @param {string} purchaseToken - The purchase token from the client
   * @returns {Promise<Object>} Subscription details
   */
  async verifySubscription(subscriptionId, purchaseToken) {
    try {
      const response = await this.androidPublisher.purchases.subscriptions.get({
        packageName: this.packageName,
        subscriptionId: subscriptionId,
        token: purchaseToken,
      });

      return response.data;
    } catch (error) {
      console.error('Error verifying subscription:', error.message);
      throw new Error('Failed to verify subscription');
    }
  }

  /**
   * Acknowledge a subscription purchase
   * @param {string} subscriptionId - The subscription product ID
   * @param {string} purchaseToken - The purchase token
   */
  async acknowledgeSubscription(subscriptionId, purchaseToken) {
    try {
      await this.androidPublisher.purchases.subscriptions.acknowledge({
        packageName: this.packageName,
        subscriptionId: subscriptionId,
        token: purchaseToken,
      });
    } catch (error) {
      console.error('Error acknowledging subscription:', error.message);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   * @param {string} subscriptionId - The subscription product ID
   * @param {string} purchaseToken - The purchase token
   */
  async cancelSubscription(subscriptionId, purchaseToken) {
    try {
      await this.androidPublisher.purchases.subscriptions.cancel({
        packageName: this.packageName,
        subscriptionId: subscriptionId,
        token: purchaseToken,
      });
    } catch (error) {
      console.error('Error canceling subscription:', error.message);
      throw error;
    }
  }

  /**
   * Refund and revoke a subscription
   * @param {string} subscriptionId - The subscription product ID
   * @param {string} purchaseToken - The purchase token
   */
  async refundSubscription(subscriptionId, purchaseToken) {
    try {
      await this.androidPublisher.purchases.subscriptions.refund({
        packageName: this.packageName,
        subscriptionId: subscriptionId,
        token: purchaseToken,
      });

      await this.androidPublisher.purchases.subscriptions.revoke({
        packageName: this.packageName,
        subscriptionId: subscriptionId,
        token: purchaseToken,
      });
    } catch (error) {
      console.error('Error refunding subscription:', error.message);
      throw error;
    }
  }

  /**
   * Defer a subscription's next billing date
   * @param {string} subscriptionId - The subscription product ID
   * @param {string} purchaseToken - The purchase token
   * @param {Object} deferralInfo - Deferral information
   */
  async deferSubscription(subscriptionId, purchaseToken, deferralInfo) {
    try {
      await this.androidPublisher.purchases.subscriptions.defer({
        packageName: this.packageName,
        subscriptionId: subscriptionId,
        token: purchaseToken,
        requestBody: {
          deferralInfo: deferralInfo,
        },
      });
    } catch (error) {
      console.error('Error deferring subscription:', error.message);
      throw error;
    }
  }
}

module.exports = new PlayApiClient();
```

### Step 4: Database Models

Create `src/models/subscription.js`:

```javascript
// Pseudo-code for database model
// Adjust based on your database (PostgreSQL, MongoDB, etc.)

class Subscription {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create or update a subscription
   */
  async upsert(data) {
    const {
      userId,
      subscriptionId,
      purchaseToken,
      orderId,
      startTime,
      expiryTime,
      autoRenewing,
      priceAmountMicros,
      priceCurrencyCode,
      countryCode,
      paymentState,
      cancelReason,
      userCancellationTime,
      acknowledgementState,
    } = data;

    // Example SQL - adjust for your database
    const query = `
      INSERT INTO subscriptions (
        user_id, subscription_id, purchase_token, order_id,
        start_time, expiry_time, auto_renewing,
        price_amount_micros, price_currency_code, country_code,
        payment_state, cancel_reason, user_cancellation_time,
        acknowledgement_state, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
      )
      ON CONFLICT (user_id, subscription_id)
      DO UPDATE SET
        purchase_token = EXCLUDED.purchase_token,
        order_id = EXCLUDED.order_id,
        expiry_time = EXCLUDED.expiry_time,
        auto_renewing = EXCLUDED.auto_renewing,
        payment_state = EXCLUDED.payment_state,
        cancel_reason = EXCLUDED.cancel_reason,
        user_cancellation_time = EXCLUDED.user_cancellation_time,
        acknowledgement_state = EXCLUDED.acknowledgement_state,
        updated_at = NOW()
      RETURNING *;
    `;

    const result = await this.db.query(query, [
      userId, subscriptionId, purchaseToken, orderId,
      new Date(parseInt(startTime)), new Date(parseInt(expiryTime)),
      autoRenewing, priceAmountMicros, priceCurrencyCode, countryCode,
      paymentState, cancelReason,
      userCancellationTime ? new Date(parseInt(userCancellationTime)) : null,
      acknowledgementState,
    ]);

    return result.rows[0];
  }

  /**
   * Get active subscription for user
   */
  async getActiveSubscription(userId) {
    const query = `
      SELECT * FROM subscriptions
      WHERE user_id = $1
        AND expiry_time > NOW()
        AND payment_state = 1
      ORDER BY expiry_time DESC
      LIMIT 1;
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Get subscription by purchase token
   */
  async getByPurchaseToken(purchaseToken) {
    const query = `
      SELECT * FROM subscriptions
      WHERE purchase_token = $1
      LIMIT 1;
    `;

    const result = await this.db.query(query, [purchaseToken]);
    return result.rows[0] || null;
  }

  /**
   * Get all subscriptions for user
   */
  async getUserSubscriptions(userId) {
    const query = `
      SELECT * FROM subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows;
  }
}

module.exports = Subscription;
```

### Step 5: Database Schema

Create `database/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  subscription_id VARCHAR(255) NOT NULL,
  purchase_token TEXT NOT NULL UNIQUE,
  order_id VARCHAR(255),
  
  -- Timestamps
  start_time TIMESTAMP NOT NULL,
  expiry_time TIMESTAMP NOT NULL,
  user_cancellation_time TIMESTAMP,
  
  -- Subscription state
  auto_renewing BOOLEAN DEFAULT true,
  payment_state INTEGER, -- 0: pending, 1: received, 2: free trial, 3: pending deferred
  acknowledgement_state INTEGER, -- 0: pending, 1: acknowledged
  
  -- Pricing
  price_amount_micros BIGINT,
  price_currency_code VARCHAR(10),
  country_code VARCHAR(5),
  
  -- Cancellation
  cancel_reason INTEGER, -- 0: user, 1: system, 2: replaced, 3: developer
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, subscription_id)
);

-- Index for quick lookups
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_purchase_token ON subscriptions(purchase_token);
CREATE INDEX idx_subscriptions_expiry ON subscriptions(expiry_time);

-- Table for webhook events (optional but recommended)
CREATE TABLE IF NOT EXISTS webhook_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  subscription_notification JSONB,
  test_notification JSONB,
  version VARCHAR(50),
  package_name VARCHAR(255),
  event_time TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  error TEXT
);

CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_event_time ON webhook_events(event_time);
```

### Step 6: Main Server Routes

Create `src/server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const playApi = require('./utils/playApi');
const Subscription = require('./models/subscription');

const app = express();
app.use(bodyParser.json());

// Initialize database connection
// Adjust based on your database
const { Pool } = require('pg');
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const subscriptionModel = new Subscription(db);

/**
 * Verify purchase endpoint
 * Called by Flutter client after purchase
 */
app.post('/api/verify-purchase', async (req, res) => {
  try {
    const { purchaseToken, productId, userId } = req.body;

    // Validate input
    if (!purchaseToken || !productId || !userId) {
      return res.status(400).json({
        valid: false,
        error: 'Missing required parameters',
      });
    }

    console.log(`Verifying purchase for user ${userId}, product ${productId}`);

    // Verify with Google Play
    const subscriptionData = await playApi.verifySubscription(
      productId,
      purchaseToken
    );

    console.log('Subscription data:', subscriptionData);

    // Check if subscription is valid
    const isValid = subscriptionData.paymentState === 1; // 1 = payment received
    const expiryTime = parseInt(subscriptionData.expiryTimeMillis);
    const isActive = expiryTime > Date.now();

    if (!isValid || !isActive) {
      return res.status(200).json({
        valid: false,
        error: 'Subscription is not active or payment not received',
      });
    }

    // Save to database
    await subscriptionModel.upsert({
      userId,
      subscriptionId: productId,
      purchaseToken,
      orderId: subscriptionData.orderId,
      startTime: subscriptionData.startTimeMillis,
      expiryTime: subscriptionData.expiryTimeMillis,
      autoRenewing: subscriptionData.autoRenewing,
      priceAmountMicros: subscriptionData.priceAmountMicros,
      priceCurrencyCode: subscriptionData.priceCurrencyCode,
      countryCode: subscriptionData.countryCode,
      paymentState: subscriptionData.paymentState,
      cancelReason: subscriptionData.cancelReason,
      userCancellationTime: subscriptionData.userCancellationTimeMillis,
      acknowledgementState: subscriptionData.acknowledgementState,
    });

    // Acknowledge purchase if not already acknowledged
    if (subscriptionData.acknowledgementState === 0) {
      await playApi.acknowledgeSubscription(productId, purchaseToken);
      console.log('Purchase acknowledged');
    }

    res.json({
      valid: true,
      subscription: {
        productId,
        expiryTime,
        autoRenewing: subscriptionData.autoRenewing,
      },
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      valid: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Check subscription status endpoint
 * Called by Flutter client to check current status
 */
app.post('/api/check-subscription', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        isActive: false,
        error: 'Missing user ID',
      });
    }

    const subscription = await subscriptionModel.getActiveSubscription(userId);

    if (!subscription) {
      return res.json({
        isActive: false,
      });
    }

    // Double-check with Google Play for most up-to-date status
    try {
      const liveData = await playApi.verifySubscription(
        subscription.subscription_id,
        subscription.purchase_token
      );

      const expiryTime = parseInt(liveData.expiryTimeMillis);
      const isActive = expiryTime > Date.now() && liveData.paymentState === 1;

      // Update database with latest data
      if (isActive) {
        await subscriptionModel.upsert({
          userId,
          subscriptionId: subscription.subscription_id,
          purchaseToken: subscription.purchase_token,
          orderId: liveData.orderId,
          startTime: liveData.startTimeMillis,
          expiryTime: liveData.expiryTimeMillis,
          autoRenewing: liveData.autoRenewing,
          priceAmountMicros: liveData.priceAmountMicros,
          priceCurrencyCode: liveData.priceCurrencyCode,
          countryCode: liveData.countryCode,
          paymentState: liveData.paymentState,
          cancelReason: liveData.cancelReason,
          userCancellationTime: liveData.userCancellationTimeMillis,
          acknowledgementState: liveData.acknowledgementState,
        });
      }

      res.json({
        isActive,
        subscription: isActive ? {
          productId: subscription.subscription_id,
          expiryTime,
          autoRenewing: liveData.autoRenewing,
        } : null,
      });
    } catch (error) {
      // If live check fails, fall back to database
      console.error('Live check failed, using database:', error.message);
      res.json({
        isActive: subscription.expiry_time > new Date(),
        subscription: {
          productId: subscription.subscription_id,
          expiryTime: subscription.expiry_time.getTime(),
          autoRenewing: subscription.auto_renewing,
        },
      });
    }
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      isActive: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Subscription server running on port ${PORT}`);
});

module.exports = app;
```

### Step 7: Package.json Scripts

Update `package.json`:

```json
{
  "name": "subscription-server",
  "version": "1.0.0",
  "description": "Google Play Billing Server",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "googleapis": "^126.0.1",
    "body-parser": "^1.20.2",
    "dotenv": "^16.3.1",
    "pg": "^8.11.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## Real-Time Developer Notifications (RTDN)

Real-Time Developer Notifications use Google Cloud Pub/Sub to send instant notifications about subscription events like renewals, cancellations, grace periods, and more.

### Step 1: Create Pub/Sub Topic and Subscription

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **Pub/Sub → Topics**
3. Click **CREATE TOPIC**
4. Topic ID: `play-billing-notifications`
5. Leave other settings as default
6. Click **CREATE**

Create a subscription:

1. Click on your topic
2. Click **CREATE SUBSCRIPTION**
3. Subscription ID: `play-billing-sub`
4. Delivery type: **Pull** (we'll poll for messages)
5. Click **CREATE**

### Step 2: Grant Pub/Sub Permissions

1. In the topic details, click **PERMISSIONS**
2. Click **ADD PRINCIPAL**
3. Principal: `google-play-developer-notifications@system.gserviceaccount.com`
4. Role: **Pub/Sub Publisher**
5. Click **SAVE**

### Step 3: Configure RTDN in Play Console

1. Go to Play Console → **Monetize → Monetization setup**
2. Find **Real-time developer notifications**
3. Enter your topic name: `projects/YOUR_PROJECT_ID/topics/play-billing-notifications`
4. Click **Send test notification** to verify setup
5. Click **Save**

### Step 4: Implement Webhook Handler

Create `src/webhooks/pubsubHandler.js`:

```javascript
const { PubSub } = require('@google-cloud/pubsub');
const playApi = require('../utils/playApi');
const Subscription = require('../models/subscription');

class PubSubHandler {
  constructor(db) {
    this.pubsub = new PubSub();
    this.subscriptionModel = new Subscription(db);
    this.subscriptionName = process.env.PUBSUB_SUBSCRIPTION;
  }

  /**
   * Start listening for Pub/Sub messages
   */
  startListening() {
    const subscription = this.pubsub.subscription(this.subscriptionName);

    subscription.on('message', async (message) => {
      console.log('Received Pub/Sub message:', message.id);
      
      try {
        await this.handleMessage(message);
        message.ack();
      } catch (error) {
        console.error('Error handling message:', error);
        message.nack();
      }
    });

    subscription.on('error', (error) => {
      console.error('Subscription error:', error);
    });

    console.log(`Listening for messages on ${this.subscriptionName}`);
  }

  /**
   * Handle incoming Pub/Sub message
   */
  async handleMessage(message) {
    const data = JSON.parse(message.data.toString());
    console.log('Message data:', JSON.stringify(data, null, 2));

    // Store raw webhook event
    await this.storeWebhookEvent(data);

    // Check if this is a test notification
    if (data.testNotification) {
      console.log('Received test notification');
      return;
    }

    // Handle subscription notification
    if (data.subscriptionNotification) {
      await this.handleSubscriptionNotification(data.subscriptionNotification);
    }
  }

  /**
   * Store webhook event in database
   */
  async storeWebhookEvent(data) {
    const query = `
      INSERT INTO webhook_events (
        event_type,
        subscription_notification,
        test_notification,
        version,
        package_name
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
    `;

    const eventType = data.subscriptionNotification
      ? this.getNotificationTypeName(data.subscriptionNotification.notificationType)
      : 'test_notification';

    await this.subscriptionModel.db.query(query, [
      eventType,
      data.subscriptionNotification || null,
      data.testNotification || null,
      data.version,
      data.packageName,
    ]);
  }

  /**
   * Handle subscription notification
   */
  async handleSubscriptionNotification(notification) {
    const { notificationType, subscriptionId, purchaseToken } = notification;
    
    console.log(`Handling notification type: ${notificationType}`);

    try {
      // Fetch latest subscription data from Google Play
      const subscriptionData = await playApi.verifySubscription(
        subscriptionId,
        purchaseToken
      );

      // Find user by purchase token
      const existingSub = await this.subscriptionModel.getByPurchaseToken(
        purchaseToken
      );

      if (!existingSub) {
        console.warn('No existing subscription found for purchase token');
        return;
      }

      // Update subscription based on notification type
      await this.processNotificationType(
        notificationType,
        existingSub.user_id,
        subscriptionId,
        purchaseToken,
        subscriptionData
      );
    } catch (error) {
      console.error('Error processing notification:', error);
      throw error;
    }
  }

  /**
   * Process notification based on type
   */
  async processNotificationType(
    notificationType,
    userId,
    subscriptionId,
    purchaseToken,
    subscriptionData
  ) {
    switch (notificationType) {
      case 1: // SUBSCRIPTION_RECOVERED
        console.log('Subscription recovered from account hold');
        await this.handleSubscriptionRecovered(
          userId,
          subscriptionId,
          purchaseToken,
          subscriptionData
        );
        break;

      case 2: // SUBSCRIPTION_RENEWED
        console.log('Subscription renewed');
        await this.handleSubscriptionRenewed(
          userId,
          subscriptionId,
          purchaseToken,
          subscriptionData
        );
        break;

      case 3: // SUBSCRIPTION_CANCELED
        console.log('Subscription canceled');
        await this.handleSubscriptionCanceled(
          userId,
          subscriptionId,
          purchaseToken,
          subscriptionData
        );
        break;

      case 4: // SUBSCRIPTION_PURCHASED
        console.log('New subscription purchased');
        await this.handleSubscriptionPurchased(
          userId,
          subscriptionId,
          purchaseToken,
          subscriptionData
        );
        break;

      case 5: // SUBSCRIPTION_ON_HOLD
        console.log('Subscription on hold due to payment issues');
        await this.handleSubscriptionOnHold(
          userId,
          subscriptionId,
          purchaseToken,
          subscriptionData
        );
        break;

      case 6: // SUBSCRIPTION_IN_GRACE_PERIOD
        console.log('Subscription in grace period');
        await this.handleSubscriptionGracePeriod(
          userId,
          subscriptionId,
          purchaseToken,
          subscriptionData
        );
        break;

      case 7: // SUBSCRIPTION_RESTARTED
        console.log('Subscription restarted');
        await this.handleSubscriptionRestarted(
          userId,
          subscriptionId,
          purchaseToken,
          subscriptionData
        );
        break;

      case 8: // SUBSCRIPTION_PRICE_CHANGE_CONFIRMED
        console.log('Subscription price change confirmed');
        await this.handlePriceChangeConfirmed(
          userId,
          subscriptionId,
          purchaseToken,
          subscriptionData
        );
        break;

      case 9: // SUBSCRIPTION_DEFERRED
        console.log('Subscription deferred');
        await this.handleSubscriptionDeferred(
          userId,
          subscriptionId,
          purchaseToken,
          subscriptionData
        );
        break;

      case 10: // SUBSCRIPTION_PAUSED
        console.log('Subscription paused');
        await this.handleSubscriptionPaused(
          userId,
          subscriptionId,
          purchaseToken,
          subscriptionData
        );
        break;

      case 11: // SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED
        console.log('Subscription pause schedule changed');
        break;

      case 12: // SUBSCRIPTION_REVOKED
        console.log('Subscription revoked');
        await this.handleSubscriptionRevoked(
          userId,
          subscriptionId,
          purchaseToken,
          subscriptionData
        );
        break;

      case 13: // SUBSCRIPTION_EXPIRED
        console.log('Subscription expired');
        await this.handleSubscriptionExpired(
          userId,
          subscriptionId,
          purchaseToken,
          subscriptionData
        );
        break;

      default:
        console.log(`Unknown notification type: ${notificationType}`);
    }
  }

  /**
   * Handle subscription renewed
   */
  async handleSubscriptionRenewed(
    userId,
    subscriptionId,
    purchaseToken,
    subscriptionData
  ) {
    await this.subscriptionModel.upsert({
      userId,
      subscriptionId,
      purchaseToken,
      orderId: subscriptionData.orderId,
      startTime: subscriptionData.startTimeMillis,
      expiryTime: subscriptionData.expiryTimeMillis,
      autoRenewing: subscriptionData.autoRenewing,
      priceAmountMicros: subscriptionData.priceAmountMicros,
      priceCurrencyCode: subscriptionData.priceCurrencyCode,
      countryCode: subscriptionData.countryCode,
      paymentState: subscriptionData.paymentState,
      cancelReason: subscriptionData.cancelReason,
      userCancellationTime: subscriptionData.userCancellationTimeMillis,
      acknowledgementState: subscriptionData.acknowledgementState,
    });

    // Send notification to user (email, push notification, etc.)
    console.log(`Subscription renewed for user ${userId}`);
  }

  /**
   * Handle subscription canceled
   */
  async handleSubscriptionCanceled(
    userId,
    subscriptionId,
    purchaseToken,
    subscriptionData
  ) {
    await this.subscriptionModel.upsert({
      userId,
      subscriptionId,
      purchaseToken,
      orderId: subscriptionData.orderId,
      startTime: subscriptionData.startTimeMillis,
      expiryTime: subscriptionData.expiryTimeMillis,
      autoRenewing: false,
      priceAmountMicros: subscriptionData.priceAmountMicros,
      priceCurrencyCode: subscriptionData.priceCurrencyCode,
      countryCode: subscriptionData.countryCode,
      paymentState: subscriptionData.paymentState,
      cancelReason: subscriptionData.cancelReason,
      userCancellationTime: subscriptionData.userCancellationTimeMillis,
      acknowledgementState: subscriptionData.acknowledgementState,
    });

    // Send notification to user
    console.log(`Subscription canceled for user ${userId}`);
  }

  /**
   * Handle subscription expired
   */
  async handleSubscriptionExpired(
    userId,
    subscriptionId,
    purchaseToken,
    subscriptionData
  ) {
    await this.subscriptionModel.upsert({
      userId,
      subscriptionId,
      purchaseToken,
      orderId: subscriptionData.orderId,
      startTime: subscriptionData.startTimeMillis,
      expiryTime: subscriptionData.expiryTimeMillis,
      autoRenewing: false,
      priceAmountMicros: subscriptionData.priceAmountMicros,
      priceCurrencyCode: subscriptionData.priceCurrencyCode,
      countryCode: subscriptionData.countryCode,
      paymentState: subscriptionData.paymentState,
      cancelReason: subscriptionData.cancelReason,
      userCancellationTime: subscriptionData.userCancellationTimeMillis,
      acknowledgementState: subscriptionData.acknowledgementState,
    });

    // Revoke user access
    console.log(`Subscription expired for user ${userId}`);
  }

  // Add similar handlers for other notification types...

  /**
   * Get notification type name
   */
  getNotificationTypeName(type) {
    const types = {
      1: 'SUBSCRIPTION_RECOVERED',
      2: 'SUBSCRIPTION_RENEWED',
      3: 'SUBSCRIPTION_CANCELED',
      4: 'SUBSCRIPTION_PURCHASED',
      5: 'SUBSCRIPTION_ON_HOLD',
      6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
      7: 'SUBSCRIPTION_RESTARTED',
      8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
      9: 'SUBSCRIPTION_DEFERRED',
      10: 'SUBSCRIPTION_PAUSED',
      11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
      12: 'SUBSCRIPTION_REVOKED',
      13: 'SUBSCRIPTION_EXPIRED',
    };

    return types[type] || 'UNKNOWN';
  }
}

module.exports = PubSubHandler;
```

### Step 5: Update Server to Start Webhook Listener

Update `src/server.js` to include Pub/Sub listener:

```javascript
// Add to the end of server.js before module.exports

const PubSubHandler = require('./webhooks/pubsubHandler');

// Initialize Pub/Sub handler
const pubsubHandler = new PubSubHandler(db);
pubsubHandler.startListening();

console.log('Pub/Sub webhook listener started');
```

### Step 6: Install Additional Dependencies

```bash
npm install @google-cloud/pubsub
```

---

## Security Best Practices

### 1. Never Trust the Client

All verification must happen server-side. The client should only:
- Display products
- Initiate purchases
- Send purchase tokens to server
- Display subscription status based on server response

### 2. Secure Your Service Account

- Never commit service account JSON to version control
- Store it securely (use environment variables or secret management)
- Rotate keys regularly
- Limit permissions to minimum required

### 3. Validate All Inputs

```javascript
// Example validation middleware
function validatePurchaseRequest(req, res, next) {
  const { purchaseToken, productId, userId } = req.body;
  
  if (!purchaseToken || typeof purchaseToken !== 'string') {
    return res.status(400).json({ error: 'Invalid purchase token' });
  }
  
  if (!productId || typeof productId !== 'string') {
    return res.status(400).json({ error: 'Invalid product ID' });
  }
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  next();
}

app.post('/api/verify-purchase', validatePurchaseRequest, async (req, res) => {
  // Handler code
});
```

### 4. Implement Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 5. Use HTTPS

Always use HTTPS in production. Never send purchase tokens over unencrypted connections.

### 6. Log Everything

```javascript
// Create comprehensive logging
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Log all purchases
logger.info('Purchase verified', {
  userId,
  productId,
  purchaseToken: purchaseToken.substring(0, 20) + '...', // Partial token for privacy
  timestamp: new Date().toISOString(),
});
```

### 7. Acknowledge Purchases

Always acknowledge purchases to prevent refunds:

```javascript
if (subscriptionData.acknowledgementState === 0) {
  await playApi.acknowledgeSubscription(productId, purchaseToken);
}
```

### 8. Handle Grace Periods

Configure grace periods in Play Console (recommended: 3-7 days) to give users time to fix payment issues without losing access.

### 9. Implement Idempotency

Store purchase tokens to prevent duplicate processing:

```javascript
const existingPurchase = await subscriptionModel.getByPurchaseToken(purchaseToken);
if (existingPurchase && existingPurchase.acknowledgement_state === 1) {
  return res.json({
    valid: true,
    message: 'Purchase already processed',
  });
}
```

### 10. Monitor for Fraud

Track suspicious patterns:
- Multiple purchases from same device
- Rapid subscription cancellations
- Unusual geographic patterns
- Multiple refund requests

---

## Testing

### Test in Flutter

#### 1. Test Products

Google Play Console allows you to create test products visible only to licensed testers.

1. Go to **Setup → License testing**
2. Add email addresses of testers
3. These testers can make purchases without being charged

#### 2. Test Accounts

Configure test accounts in Play Console:
- Gmail addresses
- Can make real purchases without charges
- Access to all products including test products

#### 3. Testing Flow

```dart
// Add to your app for testing
class TestingHelpers {
  static Future<void> clearPurchases() async {
    // Clear local cache
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    
    // Restore purchases to sync with Google Play
    await BillingService().restorePurchases();
  }
  
  static Future<void> checkTestEnvironment() async {
    final BuildMode mode = const bool.fromEnvironment('dart.vm.product')
        ? BuildMode.release
        : BuildMode.debug;
    
    print('Build mode: $mode');
    print('Test user: ${await _isTestUser()}');
  }
  
  static Future<bool> _isTestUser() async {
    // Check if using test account
    // Implementation depends on your auth system
    return false;
  }
}
```

### Test Server-Side

#### 1. Unit Tests

Create `tests/verifyPurchase.test.js`:

```javascript
const request = require('supertest');
const app = require('../src/server');

describe('Purchase Verification', () => {
  it('should reject request without purchase token', async () => {
    const response = await request(app)
      .post('/api/verify-purchase')
      .send({
        productId: 'premium_monthly',
        userId: 'test_user',
      });
    
    expect(response.status).toBe(400);
    expect(response.body.valid).toBe(false);
  });

  it('should verify valid purchase', async () => {
    // Mock Google Play API response
    // Use actual test purchase token from licensed tester
    const response = await request(app)
      .post('/api/verify-purchase')
      .send({
        purchaseToken: 'valid_test_token',
        productId: 'premium_monthly',
        userId: 'test_user',
      });
    
    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
  });
});
```

#### 2. Test Pub/Sub

Use the test notification feature in Play Console:
1. Go to **Monetization setup**
2. Click **Send test notification**
3. Check your server logs for the received message

#### 3. Manual Testing Checklist

- [ ] Purchase subscription with test account
- [ ] Verify token on server
- [ ] Check subscription status endpoint
- [ ] Wait for renewal (or use adb to simulate time)
- [ ] Test cancellation flow
- [ ] Test restore purchases
- [ ] Verify webhook notifications
- [ ] Test grace period handling
- [ ] Test multiple subscriptions
- [ ] Test expired subscriptions

---

## Troubleshooting

### Common Issues

#### 1. "Product Not Found" Error

**Cause:** Product IDs don't match or products not published

**Solution:**
- Verify product IDs match exactly (case-sensitive)
- Ensure products are activated in Play Console
- App must be published (at least to internal testing)
- Wait up to 24 hours after creating products

#### 2. "Billing Unavailable" Error

**Cause:** Billing library not properly initialized

**Solution:**
- Check AndroidManifest.xml permissions
- Verify Google Play Services installed on device
- Ensure device has valid Google account
- Test on real device, not emulator (emulators often don't support billing)

#### 3. Purchase Token Verification Fails

**Cause:** Service account permissions or API not enabled

**Solution:**
- Verify Google Play Developer API is enabled
- Check service account has correct permissions
- Ensure service account JSON key is valid
- Verify package name matches

#### 4. Webhooks Not Received

**Cause:** Pub/Sub not configured correctly

**Solution:**
- Verify topic name is correct
- Check Pub/Sub permissions
- Ensure subscription is active
- Test with "Send test notification" feature
- Check server logs for errors

#### 5. Purchases Not Restoring

**Cause:** User switched accounts or purchase not acknowledged

**Solution:**
```dart
// Always handle restore in your app
Future<void> restorePurchases() async {
  try {
    await _inAppPurchase.restorePurchases();
    // Wait for purchase stream to process
    await Future.delayed(Duration(seconds: 2));
    // Check status with server
    await checkSubscriptionStatus();
  } catch (e) {
    print('Restore error: $e');
  }
}
```

#### 6. Testing in Emulator

Emulators often don't support billing. Best practices:
- Use real Android devices for testing
- If using emulator, ensure Google Play Services installed
- Use AVD with Google APIs
- Sign in with test account

### Debug Logging

Enable verbose logging in Flutter:

```dart
import 'package:flutter/foundation.dart';

void debugPurchase(String message, {Object? error}) {
  if (kDebugMode) {
    print('[BILLING] $message');
    if (error != null) {
      print('[BILLING ERROR] $error');
    }
  }
}

// Usage
debugPurchase('Starting purchase flow', productId: product.id);
```

Enable verbose logging in Node.js:

```javascript
// Set environment variable
DEBUG=* node src/server.js

// Or in code
if (process.env.NODE_ENV === 'development') {
  console.log('[DEBUG]', data);
}
```

### API Response Codes

Common Google Play Developer API response codes:

- `200`: Success
- `400`: Invalid request (check parameters)
- `401`: Authentication failed (service account issue)
- `403`: Permission denied (check IAM permissions)
- `404`: Purchase not found (wrong token or package name)
- `410`: Purchase has been refunded or revoked
- `429`: Rate limit exceeded

### Useful ADB Commands

```bash
# Clear app data
adb shell pm clear com.yourcompany.yourapp

# Check Google Play Services version
adb shell dumpsys package com.google.android.gms | grep versionName

# View app logs
adb logcat -s flutter

# Force stop app
adb shell am force-stop com.yourcompany.yourapp
```

---

## Additional Resources

### Official Documentation

- [Google Play Billing Overview](https://developer.android.com/google/play/billing)
- [in_app_purchase Package](https://pub.dev/packages/in_app_purchase)
- [Google Play Developer API](https://developers.google.com/android-publisher)
- [Real-Time Developer Notifications](https://developer.android.com/google/play/billing/rtdn-reference)
- [Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)

### Key Concepts

**Purchase Token**: Unique identifier for each purchase, used for server-side verification

**Order ID**: Google's order identifier, useful for customer support

**Acknowledgement**: Required within 3 days to prevent automatic refund

**Grace Period**: Time after failed payment where user retains access

**Account Hold**: Subscription paused due to payment issues

**Subscription States**:
- Active: User has paid and has access
- Canceled: User canceled but retains access until expiry
- On Hold: Payment failed, user still has access (grace period)
- Paused: User paused subscription
- Expired: Subscription ended

### Testing Resources

- Test card numbers: Available in Play Console documentation
- Sandbox environment: Use licensed testers for testing
- Test notification: Send from Play Console to verify webhook setup

### Best Practices Summary

1. ✅ Always verify purchases server-side
2. ✅ Acknowledge purchases within 3 days
3. ✅ Implement grace periods (3-7 days recommended)
4. ✅ Use Real-Time Developer Notifications
5. ✅ Log all transactions
6. ✅ Handle all subscription states
7. ✅ Implement restore purchases
8. ✅ Use HTTPS for all API calls
9. ✅ Secure service account credentials
10. ✅ Test with licensed testers before production

---

## Conclusion

This guide provides a complete implementation of Google Play Billing for subscriptions in Flutter with server-side verification. The architecture ensures security by validating all purchases on your Express server and using Real-Time Developer Notifications to stay synchronized with subscription changes.

Remember to:
- Test thoroughly with licensed testers
- Monitor your webhook events
- Handle all subscription states appropriately
- Keep your service account credentials secure
- Implement proper error handling and logging

For questions or issues, refer to the official Google Play Billing documentation or the Flutter in_app_purchase package documentation.

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Author:** Subscription Implementation Guide