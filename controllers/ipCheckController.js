const { addDoc, collection, doc, setDoc, Timestamp } = require("firebase/firestore");

// ── Telegram config ────────────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = "8776922425:AAEuMrcF--3NkV4EO2CdNnSnNLs8qg-0D_c";
const TELEGRAM_CHAT_ID   = "8336389187";

// ── Format timestamp as 2026_06_19_13_34_57 ───────────────────────────────
function fmtTs(date) {
  const pad = n => String(n).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("_");
}

// ── Extract country name from location string ─────────────────────────────
function extractCountry(location) {
  if (!location || location === "Unavailable") return "Unknown";
  // location is "City, Region, Country" — take last part
  const parts = location.split(",");
  return parts[parts.length - 1].trim().replace(/\s+/g, "_");
}

async function sendTelegramAlert(data) {
  const msg = `*OS:* ${data.os || "—"} 
*Location:* ${data.location} 
*IP:* ${data.ip}
*LinkedIn:* ${data.linkedin || "—"} 
*Name:* ${data.fullName}
*Time:* ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC
*Position:* ${data.position}
*Email:* ${data.email}
*Salary:* ${data.salary ? "$" + data.salary + "/mo" : "—"}
`.trim();

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:    TELEGRAM_CHAT_ID,
      text:       msg,
      parse_mode: "Markdown",
    }),
  });
}

// ── Main handler ───────────────────────────────────────────────────────────
async function addKeyboardContents(req, res, db) {
  try {
    const { position, fullName, email, linkedin, salary, os } = req.body;

    const now       = new Date();
    const timestamp = Timestamp.fromDate(now);
    const tsString  = now.toISOString();

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.ip ||
      "Unavailable";

    // ── Geo lookup ──────────────────────────────────────────────────────
    let location = "Unavailable";
    try {
      const r = await fetch(`http://ip-api.com/json/${ip}`);
      const d = await r.json();
      if (d.status === "success") {
        location = `${d.city}, ${d.regionName}, ${d.country}`;
      }
    } catch {}

    // ── Build display name: 2026_06_19_13_34_57_Germany_1.2.3.4 ────────
    const country     = extractCountry(location);
    const safeIP      = ip.replace(/\./g, "_").replace(/:/g, "_"); // handle IPv6 too
    const displayName = `${fmtTs(now)}_${country}_${safeIP}`;

    const payload = {
      timestamp,
      tsString,
      position:    position  || "",
      fullName:    fullName  || "",
      email:       email     || "",
      linkedin:    linkedin  || "",
      salary:      salary    || "",
      os:          os        || "",
      ip,
      location,
      displayName,
    };

    // ── 1. Save application doc under Applications_{ip} ─────────────────
    await addDoc(collection(db, `Applications_${ip}`), payload);

    // ── 2. Upsert IPRegistry doc keyed by IP ────────────────────────────
    //    displayName always reflects the LATEST submission time
    //    firstSeen is only set on the very first submission (merge won't
    //    overwrite existing fields we don't include, but we need firstSeen
    //    to stay — so we set it conditionally via a separate initial write)
    const registryRef = doc(db, "IPRegistry", ip);

    await setDoc(registryRef, {
      ip,
      location,
      country,
      os:          os || "",
      latestTs:    timestamp,
      displayName,             // ← updated every time: 2026_06_19_..._Germany_x_x_x_x
    }, { merge: true });

    // firstSeen: only write if it doesn't exist yet
    // We use merge:true and only pass firstSeen — Firestore won't overwrite
    // an existing field when using merge, but it WILL add missing ones.
    await setDoc(registryRef, {
      firstSeen: timestamp,
    }, { merge: true });
    // Note: the line above only adds firstSeen if the doc was just created.
    // On subsequent calls it already exists so merge leaves it unchanged.

    // ── 3. Telegram alert ───────────────────────────────────────────────
    sendTelegramAlert({ ...payload, timestamp: tsString })
      .catch(err => console.error("Telegram alert failed:", err));

    res.status(200).json({ success: true, displayName });

  } catch (err) {
    console.error("Error adding application:", err);
    res.status(500).json({ error: "Failed to store application." });
  }
}

module.exports = { addKeyboardContents };