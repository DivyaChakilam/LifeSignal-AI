//functions/src/index.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  WriteBatch,
} from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import axios from "axios";

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

const S_TELNYX_API_KEY = defineSecret("TELNYX_API_KEY");
const S_TELNYX_APPLICATION_ID = defineSecret("TELNYX_APPLICATION_ID");
const S_TELNYX_FROM_NUMBER = defineSecret("TELNYX_FROM_NUMBER");

/** Small helper so we use env as a fallback for local emulator/dev. */
function getTelnyx() {
  return {
    apiKey: S_TELNYX_API_KEY.value() || process.env.TELNYX_API_KEY,
    appId: S_TELNYX_APPLICATION_ID.value() || process.env.TELNYX_APPLICATION_ID,
    from: S_TELNYX_FROM_NUMBER.value() || process.env.TELNYX_FROM_NUMBER,
  };
}

const TELNYX_API = "https://api.telnyx.com/v2";

/** Telnyx-friendly E.164: + and 7–14 more digits (8–15 total) */
function isE164(phone?: string | null): boolean {
  if (!phone) return false;
  return /^\+[0-9]{7,14}$/.test(phone);
}

function toMillis(ts?: any): number {
  try {
    if (ts == null) return 0;

    // Firestore Timestamp-like
    if (typeof ts?.toMillis === "function") return ts.toMillis();
    if (typeof ts?.toDate === "function") return ts.toDate().getTime();

    // Already a Date or number
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === "number") return ts;

    return 0;
  } catch {
    return 0;
  }
}

/** Batch helper to avoid the 500-writes limit. */
async function commitOrRotate(batch: WriteBatch, ops: { count: number }) {
  if (ops.count >= 450) {
    await batch.commit();
    ops.count = 0;
    return db.batch();
  }
  return batch;
}

/** ---------------------------
 *  Sync EC profile to linked docs
 *  --------------------------- */
export const syncEmergencyContactProfile = onDocumentWritten(
  "users/{ecUid}",
  async (event) => {
    const emergencyContactUid = String(event.params.ecUid);

    let before: any = {};
    if (event.data?.before.exists) before = event.data.before.data() as any;
    let after: any = null;
    if (event.data?.after.exists) after = event.data.after.data() as any;
    if (!after) return; // ignore deletes

    const watched = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "relationship",
      "photoUrl",
    ];

    const changed = watched.some((k) => before[k] !== after[k]);
    if (!changed) return;

    const nowTs = FieldValue.serverTimestamp();

    // 1) Update all /users/{mainUserUid}/emergency_contact/* links for this EC
    const linksSnap = await db
      .collectionGroup("emergency_contact")
      .where("emergencyContactUid", "==", emergencyContactUid)
      .get();

    const mainUserUids = new Set<string>();
    let batch = db.batch();
    const ops = { count: 0 };

    for (const link of linksSnap.docs) {
      const mainUserUid = link.ref.parent.parent?.id;
      if (mainUserUid) mainUserUids.add(mainUserUid);

      const patch: any = {
        updatedAt: nowTs,
      };
      for (const k of watched) {
        patch[`profile.${k}`] = after[k] ?? null;
      }

      batch.update(link.ref, patch);
      ops.count++;
      batch = await commitOrRotate(batch, ops);
    }

    if (ops.count) await batch.commit();

    // 2) Optional mirror top-level collection
    const topSnap = await db
      .collection("emergencyContacts")
      .where("emergencyContactUid", "==", emergencyContactUid)
      .get();

    if (!topSnap.empty) {
      let b = db.batch();
      const o = { count: 0 };

      for (const doc of topSnap.docs) {
        const patch: any = {
          updatedAt: nowTs,
        };
        for (const k of watched) {
          patch[k] = after[k] ?? null;
        }
        b.update(doc.ref, patch);
        o.count++;
        b = await commitOrRotate(b, o);
      }

      if (o.count) await b.commit();
    }

    logger.info("syncEmergencyContactProfile updated", {
      emergencyContactUid,
      linkedUsers: Array.from(mainUserUids),
    });
  }
);

/** Find ACTIVE emergency contacts, sorted by how many notifications
 *  they got in the current window (for round-robin behaviour).
 */
async function getActiveEmergencyContacts(
  mainUserUid: string
): Promise<
  Array<{
    id: string;
    phone: string;
    emergencyContactUid?: string;
    sentCountInWindow?: number;
    lastNotifiedAt?: any;
    createdAt?: any;
    notificationSettings?: any;
  }>
> {
  const snap = await db
    .collection(`users/${mainUserUid}/emergency_contact`)
    .where("status", "==", "ACTIVE")
    .get();

  const contacts = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((c) => isE164((c as any).phone));

  contacts.sort((a: any, b: any) => {
    const aCount = Number(a.sentCountInWindow || 0);
    const bCount = Number(b.sentCountInWindow || 0);
    if (aCount !== bCount) return aCount - bCount;

    const aCreated = toMillis(a.createdAt);
    const bCreated = toMillis(b.createdAt);
    return aCreated - bCreated;
  });

  return contacts;
}

/** Collect ACTIVE EC UIDs for push targeting */
async function getActiveEmergencyContactUids(
  mainUserUid: string
): Promise<string[]> {
  const snap = await db
    .collection(`users/${mainUserUid}/emergency_contact`)
    .where("status", "==", "ACTIVE")
    .get();

  const uids = snap.docs
    .map((d) => (d.data() as any).emergencyContactUid)
    .filter((x) => typeof x === "string" && x.trim().length > 0);

  return Array.from(new Set(uids));
}

/** Return all non-empty FCM tokens under users/{uid}/devices */
async function getFcmTokensForUser(uid: string): Promise<string[]> {
  try {
    const snap = await db.collection(`users/${uid}/devices`).get();

    const tokens = snap.docs
      .map((d) => {
        const data = d.data() as any;
        // Support both field names: "token" and "fcmToken"
        return data.fcmToken || data.token;
      })
      .filter((t) => typeof t === "string" && t.length > 0);

    return Array.from(new Set(tokens));
  } catch (err: any) {
    logger.error("getFcmTokensForUser error", { uid, error: err?.message });
    return [];
  }
}

/** Send a single push payload to a list of tokens. */
async function sendPushToTokens(
  tokens: string[],
  notification: { title: string; body: string },
  data: Record<string, string>
) {
  if (!tokens.length) return;

  const message = {
    notification,
    data,
    tokens,
  };

  try {
    const resp = await messaging.sendEachForMulticast(message);
    logger.info("sendPushToTokens result", {
      successCount: resp.successCount,
      failureCount: resp.failureCount,
    });
  } catch (err: any) {
    logger.error("sendPushToTokens error", err?.message);
  }
}

/** ------------------------------------------------------
 *  Telnyx webhook — call status / DTMF / etc
 *  ------------------------------------------------------ */
export const telnyxWebhook = onRequest(
  {
    region: "us-central1",
    secrets: [S_TELNYX_API_KEY, S_TELNYX_APPLICATION_ID, S_TELNYX_FROM_NUMBER],
  },
  async (req, res) => {
    try {
      const { apiKey } = getTelnyx();
      const event = req.body?.data?.record || req.body?.data || req.body;

      const eventType = event?.event_type || event?.type;
      const callControlId =
        event?.payload?.call_control_id || event?.call_control_id;
      const clientStateRaw =
        event?.payload?.client_state || event?.client_state || null;

      let clientState: any = null;
      if (clientStateRaw) {
        try {
          const decoded = Buffer.from(clientStateRaw, "base64").toString(
            "utf-8"
          );
          clientState = JSON.parse(decoded);
        } catch (err: any) {
          logger.error("Failed to decode client_state", err?.message);
        }
      }

      logger.info("telnyxWebhook received", {
        eventType,
        callControlId,
        clientState,
      });

      // If user presses 1 on keypad, mark escalation acknowledged
      if (eventType === "call.dtmf.received") {
        const digit = event?.payload?.digit || event?.digit;
        if (digit === "1" && clientState?.mainUserUid) {
          const { mainUserUid } = clientState;

          try {
            await db
              .collection("users")
              .doc(mainUserUid)
              .set(
                {
                  lastEscalationAcknowledgedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );

            logger.info("Escalation acknowledged via Telnyx DTMF", {
              mainUserUid,
            });
          } catch (err: any) {
            logger.error(
              "Failed to mark escalation acknowledged",
              err?.message
            );
          }
        }
      }

      // When the call is answered, speak a short message
      if (eventType === "call.answered" && callControlId && apiKey) {
        await axios.post(
          `${TELNYX_API}/calls/${callControlId}/actions/speak`,
          {
            language: "en-US",
            voice: "female",
            payload:
              "This is an automated Life Signal alert. Please check on the user and press 1 to acknowledge.",
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          }
        );
      }

      res.status(200).json({ ok: true });
    } catch (e: any) {
      logger.error("telnyxWebhook error", e?.response?.data || e?.message);
      res.status(500).json({ ok: false });
    }
  }
);

/** ------------------------------------------------------
 *  Notification config helpers (main user + EC)
 *  ------------------------------------------------------ */

type NotificationMode = "PUSH_ONLY" | "PUSH_PLUS_CALL" | "CALL_ONLY";

/**
 * Main user's built-in notification config (timings, batch size, etc).
 * This matches your original structure.
 */
interface MainNotificationConfig {
  mode: NotificationMode;
  pushIntervalMin: number; // how often we send a batch (minutes)
  pushBatchSize: number; // number of pushes in a "set"
  callDelayMin: number; // N-minute delay before calling (for PUSH_PLUS_CALL)
}

/**
 * Extra user-configurable push counts from your UI:
 * - pushOnlyCount: how many push rounds for "Push Only"
 * - pushThenCallCount: how many push rounds before calling in "Push → Then Call"
 */
interface UserPushConfig {
  pushOnlyCount: number;
  pushThenCallCount: number;
}

/** Emergency contact notification config, independent of user push counts. */
interface EcNotificationConfig extends MainNotificationConfig {
  escalationDelayMin: number; // when to start EC escalation at all (minutes)
}

function normalizeNotificationMode(
  raw: any,
  fallback: NotificationMode
): NotificationMode {
  if (!raw || typeof raw !== "string") return fallback;
  const v = raw.toLowerCase().replace(/\s+/g, "");

  if (v === "pushonly") return "PUSH_ONLY";
  if (v === "push+call" || v === "pushandcall" || v === "push_plus_call") {
    return "PUSH_PLUS_CALL";
  }
  if (v === "callonly" || v === "call") return "CALL_ONLY";

  return fallback;
}

/**
 * Main user's notification settings.
 *
 * Expected Firestore shape (example):
 *  users/{uid}.mainNotification = {
 *    mode: "Push only" | "Push+call" | "Call",
 *    pushIntervalMin: 10,
 *    pushBatchSize: 3,
 *    callDelayMin: 20
 *  }
 *
 * Plus:
 *  users/{uid}.pushOnlyCount?: number
 *  users/{uid}.pushThenCallCount?: number
 */
function resolveMainNotificationConfig(
  u: any
): MainNotificationConfig & UserPushConfig {
  const cfg = u?.mainNotification || {};

  // Normalize mode
  const mode = normalizeNotificationMode(cfg.mode, "PUSH_PLUS_CALL");

  // Interval + batch logic (original behavior)
  const pushIntervalMin = Number(cfg.pushIntervalMin ?? 10) || 10;
  const pushBatchSize = Number(cfg.pushBatchSize ?? 1) || 1;
  const callDelayMin = Number(cfg.callDelayMin ?? 20) || 20;

  // NEW — user-selected push counts from the UI, with defaults
  const pushOnlyCount = Number(u.pushOnlyCount ?? 3) || 3;
  const pushThenCallCount = Number(u.pushThenCallCount ?? 3) || 3;

  return {
    mode,
    pushIntervalMin,
    pushBatchSize,
    callDelayMin,
    pushOnlyCount,
    pushThenCallCount,
  };
}

/**
 * Emergency contact’s escalation/notification config.
 *
 * Expected Firestore shape on the EC link doc:
 *  users/{mainUserUid}/emergency_contact/{id}.notificationSettings = {
 *    mode: "Push only" | "Push+call" | "Call",
 *    pushIntervalMin: 10,
 *    pushBatchSize: 3,
 *    callDelayMin: 20,
 *    escalationDelayMin: 30 // when to start EC escalation at all
 *  }
 *
 * All fields are optional; defaults are taken from the product spec.
 */
function resolveEcNotificationConfig(linkDoc: any): EcNotificationConfig {
  const cfg = linkDoc?.notificationSettings || {};

  const mode = normalizeNotificationMode(cfg.mode, "PUSH_PLUS_CALL");
  const pushIntervalMin = Number(cfg.pushIntervalMin ?? 10) || 10;
  const pushBatchSize = Number(cfg.pushBatchSize ?? 3) || 3;
  const callDelayMin = Number(cfg.callDelayMin ?? 20) || 20;
  const escalationDelayMin = Number(cfg.escalationDelayMin ?? 30) || 30;

  return {
    mode,
    pushIntervalMin,
    pushBatchSize,
    callDelayMin,
    escalationDelayMin,
  };
}

/** ------------------------------------------------------
 *  Core Escalation Job (shared by HTTP + Scheduler)
 *  ------------------------------------------------------ */
async function runEscalationScanJob(input: { cooldownMin?: number } = {}) {
  const { apiKey, appId, from } = getTelnyx();
  if (!apiKey) throw new Error("TELNYX_API_KEY is not set");

  const now = Date.now();

  const usersSnap = await db
    .collection("users")
    .where("checkinEnabled", "==", true)
    .limit(200)
    .get();

  const processed: string[] = [];
  let telnyxCallsQueued = 0;

  for (const doc of usersSnap.docs) {
    const mainUserUid = doc.id;
    const u: any = doc.data() || {};
    const userRef = doc.ref;

    // Compute check-in due time
    const lastCheckinAtMs =
      (u.lastCheckinAt?.toDate?.()?.getTime?.() as number | undefined) ?? 0;
    const intervalMin = Number(u.checkinInterval ?? 60);
    const dueAtMs = lastCheckinAtMs + intervalMin * 60_000;

    if (now < dueAtMs) {
      // Not overdue yet.
      continue;
    }

    // If user checked in again after a previous missed cycle, reset state.
    let missedStartedAtMs = toMillis(u.missedStartedAt);
    const userUpdates: Record<string, any> = {};

    if (!missedStartedAtMs || lastCheckinAtMs > missedStartedAtMs) {
      missedStartedAtMs = now;
      userUpdates.missedStartedAt = FieldValue.serverTimestamp();
      userUpdates.mainNotifyRounds = 0;
      userUpdates.mainLastNotifiedAt = null;
      userUpdates.mainCallPlaced = false;
      userUpdates.ecNotifyRounds = 0;
      userUpdates.ecLastNotifiedAt = null;
      userUpdates.ecCallPlaced = false;
    }

    const elapsedMin = (now - missedStartedAtMs) / 60_000;

    // Local state (updated and persisted at end)
    let mainNotifyRounds = Number(u.mainNotifyRounds ?? 0);
    let mainLastNotifiedAtMs = toMillis(u.mainLastNotifiedAt);
    let mainCallPlaced = Boolean(u.mainCallPlaced);

    let ecNotifyRounds = Number(u.ecNotifyRounds ?? 0);
    let ecLastNotifiedAtMs = toMillis(u.ecLastNotifiedAt);
    let ecCallPlaced = Boolean(u.ecCallPlaced);

    // Main user configuration (includes your custom counts)
    const mainCfg = resolveMainNotificationConfig(u);
    const mainUserPhone = isE164(u.phone) ? String(u.phone) : null;

    const mainUserName =
      (u.firstName || u.lastName)
        ? `${u.firstName || ""} ${u.lastName || ""}`.trim()
        : "a user";

    // Helper to send a batch of pushes to the main user.
    const sendPushBatchToMainUser = async (batchSize: number) => {
      const tokens = await getFcmTokensForUser(mainUserUid);
      if (!tokens.length) return;

      for (let i = 0; i < batchSize; i++) {
        await sendPushToTokens(
          tokens,
          {
            title: "Life Signal: missed check-in",
            body: "You missed a scheduled check-in. Please open the app and check in.",
          },
          {
            type: "missed_checkin_main_user",
            mainUserUid,
          }
        );
      }
    };

    // ----------------------------
    // STEP 1: Notify main user
    // ----------------------------

    if (mainCfg.mode === "CALL_ONLY") {
      // Call immediately when the missed cycle begins
      if (!mainCallPlaced && mainUserPhone && appId) {
        const clientState = Buffer.from(
          JSON.stringify({
            mainUserUid,
            emergencyContactUid: null,
            reason: "main_user_missed_checkin",
          })
        ).toString("base64");

        await axios.post(
          `${TELNYX_API}/calls`,
          {
            connection_id: appId,
            to: mainUserPhone,
            from,
            client_state: clientState,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        mainCallPlaced = true;
        userUpdates.mainCallPlaced = true;
        telnyxCallsQueued++;
      }
    } else {
      // PUSH_ONLY or PUSH_PLUS_CALL

      // ----------------------------
      // PUSH-ONLY MODE
      // ----------------------------
      if (mainCfg.mode === "PUSH_ONLY") {
        if (mainNotifyRounds < mainCfg.pushOnlyCount) {
          const minutesSinceLastMainPush = mainLastNotifiedAtMs
            ? (now - mainLastNotifiedAtMs) / 60_000
            : Infinity;

          if (
            minutesSinceLastMainPush >= mainCfg.pushIntervalMin ||
            mainNotifyRounds === 0
          ) {
            await sendPushBatchToMainUser(mainCfg.pushBatchSize);
            mainNotifyRounds += 1;
            mainLastNotifiedAtMs = now;

            userUpdates.mainNotifyRounds = mainNotifyRounds;
            userUpdates.mainLastNotifiedAt = FieldValue.serverTimestamp();
          }
        }
        // No call in PUSH_ONLY mode — just stop after pushOnlyCount rounds
      }

      // ----------------------------
      // PUSH → THEN CALL
      // ----------------------------
      if (mainCfg.mode === "PUSH_PLUS_CALL") {
        // Send push rounds up to pushThenCallCount
        if (mainNotifyRounds < mainCfg.pushThenCallCount) {
          const minutesSinceLastMainPush = mainLastNotifiedAtMs
            ? (now - mainLastNotifiedAtMs) / 60_000
            : Infinity;

          if (
            minutesSinceLastMainPush >= mainCfg.pushIntervalMin ||
            mainNotifyRounds === 0
          ) {
            await sendPushBatchToMainUser(mainCfg.pushBatchSize);
            mainNotifyRounds += 1;
            mainLastNotifiedAtMs = now;

            userUpdates.mainNotifyRounds = mainNotifyRounds;
            userUpdates.mainLastNotifiedAt = FieldValue.serverTimestamp();
          }
        }

        // After X push rounds → place call to main user (your desired behavior)
        if (
          mainNotifyRounds >= mainCfg.pushThenCallCount &&
          !mainCallPlaced &&
          mainUserPhone &&
          appId
        ) {
          const clientState = Buffer.from(
            JSON.stringify({
              mainUserUid,
              emergencyContactUid: null,
              reason: "main_user_missed_checkin",
            })
          ).toString("base64");

          await axios.post(
            `${TELNYX_API}/calls`,
            {
              connection_id: appId,
              to: mainUserPhone,
              from,
              client_state: clientState,
            },
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
            }
          );

          mainCallPlaced = true;
          userUpdates.mainCallPlaced = true;
          telnyxCallsQueued++;
        }
      }
    }

    // ----------------------------
    // STEP 2: Escalate to EC after
    //         3 main rounds / 30 min
    //         or EC custom delay
    // ----------------------------

    // Determine primary ACTIVE EC
    const activeContacts = await getActiveEmergencyContacts(mainUserUid);
    const primaryEc = activeContacts[0];

    if (primaryEc && primaryEc.phone && isE164(primaryEc.phone)) {
      const ecCfg = resolveEcNotificationConfig(primaryEc);
      const ecPhone = String(primaryEc.phone);
      const emergencyContactUid = primaryEc.emergencyContactUid || null;

      // When should escalation begin?
      const escalationShouldStart =
        elapsedMin >= ecCfg.escalationDelayMin ||
        mainNotifyRounds >= 3; // 3 rounds ~ 30 minutes by default

      if (escalationShouldStart) {
        const ecMinutesSinceLastPush = ecLastNotifiedAtMs
          ? (now - ecLastNotifiedAtMs) / 60_000
          : Infinity;

        // Helper to send push batch to EC(s)
        const sendPushBatchToEmergencyContacts = async (
          batchSize: number
        ) => {
          const ecUids = await getActiveEmergencyContactUids(mainUserUid);
          if (!ecUids.length) return;

          const allTokens = (
            await Promise.all(ecUids.map((id) => getFcmTokensForUser(id)))
          ).flat();

          if (!allTokens.length) return;

          for (let i = 0; i < batchSize; i++) {
            await sendPushToTokens(
              allTokens,
              {
                title: "Life Signal: missed check-in",
                body: `${mainUserName} missed a check-in. Please check on them and acknowledge the alert.`,
              },
              {
                type: "escalation_emergency_contact",
                mainUserUid,
              }
            );
          }
        };

        if (ecCfg.mode === "CALL_ONLY") {
          // Call immediately once escalation starts
          if (!ecCallPlaced && appId) {
            const clientState = Buffer.from(
              JSON.stringify({
                mainUserUid,
                emergencyContactUid,
                reason: "escalation",
              })
            ).toString("base64");

            await axios.post(
              `${TELNYX_API}/calls`,
              {
                connection_id: appId,
                to: ecPhone,
                from,
                client_state: clientState,
              },
              {
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
              }
            );

            ecCallPlaced = true;
            userUpdates.ecCallPlaced = true;
            telnyxCallsQueued++;
          }
        } else if (ecCfg.mode === "PUSH_ONLY") {
          // Push every pushIntervalMin until the main user has checked in again
          if (
            ecMinutesSinceLastPush >= ecCfg.pushIntervalMin ||
            ecNotifyRounds === 0
          ) {
            await sendPushBatchToEmergencyContacts(ecCfg.pushBatchSize);
            ecNotifyRounds += 1;
            ecLastNotifiedAtMs = now;
            userUpdates.ecNotifyRounds = ecNotifyRounds;
            userUpdates.ecLastNotifiedAt = FieldValue.serverTimestamp();
          }
        } else {
          // PUSH_PLUS_CALL for EC
          if (
            ecMinutesSinceLastPush >= ecCfg.pushIntervalMin ||
            ecNotifyRounds === 0
          ) {
            await sendPushBatchToEmergencyContacts(ecCfg.pushBatchSize);
            ecNotifyRounds += 1;
            ecLastNotifiedAtMs = now;
            userUpdates.ecNotifyRounds = ecNotifyRounds;
            userUpdates.ecLastNotifiedAt = FieldValue.serverTimestamp();
          }

          if (!ecCallPlaced && elapsedMin >= ecCfg.callDelayMin && appId) {
            const clientState = Buffer.from(
              JSON.stringify({
                mainUserUid,
                emergencyContactUid,
                reason: "escalation",
              })
            ).toString("base64");

            await axios.post(
              `${TELNYX_API}/calls`,
              {
                connection_id: appId,
                to: ecPhone,
                from,
                client_state: clientState,
              },
              {
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
              }
            );

            ecCallPlaced = true;
            userUpdates.ecCallPlaced = true;
            telnyxCallsQueued++;
          }
        }
      }
    } else {
      logger.warn("No ACTIVE emergency contact with valid E.164 phone", {
        mainUserUid,
      });
    }

    if (Object.keys(userUpdates).length > 0) {
      await userRef.set(userUpdates, { merge: true });
      processed.push(mainUserUid);
    }
  }

  const escalationsQueued = telnyxCallsQueued;

  return {
    processed,
    telnyxCallsQueued,
    escalationsQueued,
    dueEscProcessed: 0,
  };
}

/** ------------------------------------------------------
 *  HTTP endpoint — manual/automation trigger of the job
 *  ------------------------------------------------------ */
export const runEscalationScan = onRequest(
  {
    region: "us-central1",
    secrets: [S_TELNYX_API_KEY, S_TELNYX_APPLICATION_ID, S_TELNYX_FROM_NUMBER],
  },
  async (req, res) => {
    try {
      const cooldownMin = Number(req.query.cooldownMin ?? 10);
      const out = await runEscalationScanJob({ cooldownMin });
      logger.info("runEscalationScan summary", out);
      res.status(200).json({ ok: true, ...out });
    } catch (err: any) {
      logger.error("runEscalationScan HTTP error", err?.message);
      res.status(500).json({ ok: false, error: err?.message });
    }
  }
);

/** ------------------------------------------------------
 *  SCHEDULED function — KEEP THE ORIGINAL NAME
 *  ------------------------------------------------------ */
export const checkMissedCheckins = onSchedule(
  {
    region: "us-central1",
    schedule: "every 5 minutes",
    timeZone: "Etc/UTC",
    secrets: [S_TELNYX_API_KEY, S_TELNYX_APPLICATION_ID, S_TELNYX_FROM_NUMBER],
  },
  async () => {
    try {
      const out = await runEscalationScanJob({});
      logger.info("checkMissedCheckins summary", out);
    } catch (err: any) {
      logger.error("checkMissedCheckins failed", err?.message);
    }
  }
);
