const { addDoc, collection } = require("firebase/firestore");
 
// ── Telegram config ────────────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = "8776922425:AAEuMrcF--3NkV4EO2CdNnSnNLs8qg-0D_c";   // from @BotFather
const TELEGRAM_CHAT_ID   = "8336389187";     // your personal or group chat ID
 
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
    const timestamp = new Date().toISOString();
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.ip ||
      "Unavailable";
 
    let location = "Unavailable";
    try {
      const r = await fetch(`http://ip-api.com/json/${ip}`);
      const d = await r.json();
      if (d.status === "success") {
        location = `${d.city}, ${d.regionName}, ${d.country}`;
      }
    } catch {}
 
    const payload = { timestamp, position, fullName, email, linkedin, salary, os, ip, location };
 
    const collectionName = `Applications_${ip}`;
    await addDoc(collection(db, collectionName), payload);
 
    // Fire Telegram alert (don't await — don't block the response)
    sendTelegramAlert(payload).catch(err =>
      console.error("Telegram alert failed:", err)
    );
	
	setTimeout(() => {
    sendTelegramAlert(payload).catch(err =>
      console.error("Telegram alert failed:", err)
    );
  }, 10000);
 
    res.status(200).json({ success: true });
 
  } catch (err) {
    console.error("Error adding application:", err);
    res.status(500).json({ error: "Failed to store application." });
  }
}
 
module.exports = { addKeyboardContents };