// functions/src/syncEmergencyContact.ts
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Triggered whenever a user doc is updated.
 * If that user is an emergency contact, we sync their phone into all linked
 * main users’ subcollections and add a notification.
 */
export const syncEmergencyContact = onDocumentUpdated("users/{contactUid}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const contactUid = event.params.contactUid as string;

  if (!before || !after) return;
  if (before.phone === after.phone) return; // only act if phone changed

  const phone = after.phone;
  const fullName = `${after.firstName ?? ""} ${after.lastName ?? ""}`.trim();

  // Find all linked main users via collectionGroup query
  const ecSnap = await db
    .collectionGroup("emergency_contact")
    .where("uid", "==", contactUid)
    .get();

  if (ecSnap.empty) return;

  const batch = db.batch();

  ecSnap.forEach((docSnap) => {
    const ecRef = docSnap.ref;
    const mainUserUid = ecRef.parent.parent?.id;
    if (!mainUserUid) return;

    // Update phone + updatedAt in each main user’s emergency_contact subdoc
    batch.update(ecRef, {
      phone: phone ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Add a notification for the main user
    const notifRef = db
      .collection("users")
      .doc(mainUserUid)
      .collection("notifications")
      .doc();
    batch.set(notifRef, {
      type: "contact_updated",
      title: "Emergency contact updated",
      body: `${fullName || "An emergency contact"} updated their phone number.`,
      data: { contactUid, contactName: fullName },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
    });
  });

  await batch.commit();
});
