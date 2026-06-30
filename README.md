# TindaDone POS 🛡️💎

TindaDone is a hybrid mobile Point-of-Sale (POS) system designed for efficiency and security. It combines offline-first speed with a cloud-backed **Hybrid Trial Guard** system and a central **Admin Panel**.

## 🚀 Key Features

- **Cloud-Synced Trial Guard:** 7-day free trial with server-side handshake (Vercel/Upstash).
- **Admin Dashboard & Kill Switch:** Real-time monitoring of trial activations, license generation, and remote device revocation. Devices can be instantly banned and kicked out of the app.
- **Offline Reliability:** Core POS functions work fully offline after activation.
- **Smart Inventory:** Bulk pack support, profit margin calculations, and low-stock alerts.
- **Utang (Credit) Tracker:** Dedicated tracker for customer credit and debt history.
- **Payment Flexibility:** Includes GCash QR code support inside the cart module.
- **Seed Demo Data:** One-click functionality to load sample products, sales, and credit history to test drive the app.

## 💻 Developer Setup (Laptop Sync)

To continue development on your laptop, follow these steps:

### 1. Requirements

- **Node.js** (LTS version)
- **Expo Go** (on your phone for testing)
- **EAS CLI** (`npm i -g eas-cli`)

### 2. Installation

```bash
# Clone the repository
git clone <your-repo-link>

# Install dependencies
npm install
```

### 3. Backend (Admin Panel)

The backend is located in the `/admin-panel` directory and is designed to run on **Vercel**.

- **Important:** Ensure you have your Upstash Redis credentials (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) set in your Vercel Environment Variables.

### 4. Running the App

```bash
npx expo start
```

## 📦 Building for Production

To generate a new installable APK:

```bash
npx eas-cli build -p android --profile preview
```

## 📁 Project Structure

- `/app`: React Native (Expo Router) screens.
- `/lib`: Core logic for license, storage, and calculations.
- `/admin-panel`: Vercel Serverless Functions and Dashboard UI.
- `/constants`: Theme and global styling tokens.
- `/context`: Settings and Global State management.

---

_TindaDone - Secure. Fast. Professional._
