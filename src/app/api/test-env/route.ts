import path from "path";
import fs from "fs";

export async function GET() {
  const serviceAccountPath = path.resolve(process.cwd(), "serviceAccountKey.json");
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

  console.log("✅ JSON key length:", serviceAccount.private_key.length);
  console.log("✅ JSON key starts with:", serviceAccount.private_key.slice(0, 30));
  console.log("✅ JSON key ends with:", serviceAccount.private_key.slice(-30));

  return new Response("Service account key loaded from JSON");
}
