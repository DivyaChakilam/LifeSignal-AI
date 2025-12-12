# LifeSignal AI

LifeSignal AI is a safety-focused Progressive Web App (PWA) that helps users stay safe by monitoring regular check-ins and automatically alerting trusted emergency contacts if a check-in is missed.

The app is designed for individuals who want an added layer of personal safety, especially when living alone, traveling, or managing health-related risks.

---

## 🔑 Core Functionality

- ⏱️ **Scheduled Check-ins**  
  Users set check-in intervals to confirm they are safe.

- 🚨 **Missed Check-in Detection**  
  If a user misses a check-in, the system automatically starts an alert flow.

- 📲 **Smart Notifications**  
  Push notifications are sent to the user first. If there is no response, escalation begins.

- 👥 **Emergency Contact Escalation**  
  Trusted emergency contacts receive notifications (and optional calls) when escalation occurs.

- ⚙️ **Custom Notification Preferences**  
  Users can choose:
  - Push only
  - Push → then call
  - Call immediately  
  and configure how many push attempts occur before escalation.

- 🔐 **Personal & App Settings**
  - Profile management
  - Regional settings (language & timezone)
  - Security (password changes, account deletion)
  - Privacy & consent controls

---

## 🛡️ Security & Privacy

LifeSignal AI uses industry-standard security practices:

- Firebase Authentication for secure user accounts
- Firestore with encryption at rest and in transit
- Secure Google Cloud infrastructure
- Explicit user consent for sensitive data such as location
- No selling or sharing of personal data with third parties

---

## 🧱 Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS
- **Backend:** Firebase (Auth, Firestore, Cloud Functions)
- **Notifications:** Firebase Cloud Messaging (FCM)
- **Calls:** Telnyx (for escalation calls)
- **AI / Logic:** Genkit
- **Platform:** Progressive Web App (PWA)

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js 20+
- npm
- Firebase project configured

### Install dependencies
```bash
npm install
