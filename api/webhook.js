const crypto = require('crypto');

module.exports = async (req, res) => {
    const ZOOM_WEBHOOK_SECRET = (process.env.ZOOM_WEBHOOK_SECRET_TOKEN || process.env.ZOOM_WEBHOOK_SECRET || "").trim();
    const GAS_URL = (process.env.GOOGLE_SCRIPT_URL || process.env.GAS_URL || "").trim();

    if (req.method === 'GET') {
        return res.status(200).send(`🚀 Live List Server OK.`);
    }

    const data = req.body;

    if (data && data.event === "endpoint.url_validation") {
        const plainToken = data.payload.plainToken;
        const hash = crypto.createHmac("sha256", ZOOM_WEBHOOK_SECRET).update(plainToken).digest("hex");
        return res.status(200).json({ plainToken, signature: hash, encryptedToken: hash });
    }

    let action = null;
    if (data.event === "meeting.participant_joined" || data.event === "participant.joined") {
        action = "JOIN";
    } else if (data.event === "meeting.participant_left" || data.event === "participant.left") {
        action = "LEFT";
    }

    if (action && data.payload.object.participant) {
        const participant = data.payload.object.participant;
        const payload = {
            action: action,
            name: participant.user_name,
            email: participant.email || 'Invitado sin correo',
            meeting_id: data.payload.object.id,
            topic: data.payload.object.topic, // Incluimos el tema
            timestamp: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
        };

        if (GAS_URL) {
            try {
                await fetch(GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (err) {
                console.error('❌ Error enviando a Sheets:', err.message);
            }
        }
    }

    return res.status(200).json({ status: "received" });
};
