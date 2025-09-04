import * as admin from "firebase-admin";
import {setGlobalOptions} from "firebase-functions/v2";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

setGlobalOptions({maxInstances: 10});

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Scheduled function to check missed check-ins and send push notifications.
 * Runs every 15 minutes.
 */
export const checkMissedCheckins = onSchedule(
  "every 15 minutes",
  async () => {
    try {
      const now = Date.now();

      // Fetch all users
      const usersSnapshot = await db.collection("users").get();

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;

        const lastCheckin = userData.lastCheckin as number | undefined;
        const interval =
          userData.checkinInterval || 2 * 60 * 60 * 1000; // default 2 hrs
        const fcmToken = userData.fcmToken as string | undefined;

        if (!lastCheckin || !fcmToken) {
          continue; // skip users without check-ins or no token
        }

        // If missed check-in
        if (now - lastCheckin > interval) {
          const message = {
            token: fcmToken,
            notification: {
              title: "Missed Check-In",
              body: "You missed your last check-in. " +
                    "Please check in now!",
            },
            data: {
              userId,
              type: "missed_checkin",
            },
          };

          try {
            await messaging.send(message);
            logger.info(
              `✅ Notification sent to user ${userId}`
            );
          } catch (err) {
            logger.error(
              `❌ Failed to send notification to ${userId}`,
              err
            );
          }
        }
      }
    } catch (err) {
      logger.error("Error checking missed check-ins", err);
    }
  }
);
