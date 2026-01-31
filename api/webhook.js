const crypto = require('crypto');

module.exports = async (req, res) => {
    // 1. Buscamos el secreto en la URL (?s=...) o en la variable de entorno
    const { s } = req.query;
    const ZOOM_WEBHOOK_SECRET = (s || process.env.ZOOM_WEBHOOK_SECRET_TOKEN || "").trim();
    const GAS_URL = (process.env.GOOGLE_SCRIPT_URL || process.env.GAS_URL || "").trim();

    const data = req.body;

    // 2. VALIDACIÓN DE URL (CRC)
    if (data && data.event === "endpoint.url_validation") {
        if (!ZOOM_WEBHOOK_SECRET) {
            return res.status(400).send("Falta el Secret Token para validar.");
        }
        const plainToken = data.payload.plainToken;
        const hash = crypto.createHmac("sha256", ZOOM_WEBHOOK_SECRET).update(plainToken).digest("hex");

        console.log('✅ URL Validada usando el secreto:', s ? 'Proporcionado en URL' : 'Variable de entorno');

        return res.status(200).json({
            plainToken: plainToken,
            signature: hash,
            encryptedToken: hash
        });
    }

    // 3. DETECTAR EVENTOS
    let action = null;
    if (data && (data.event === "meeting.participant_joined" || data.event === "participant.joined")) {
        action = "JOIN";
    } else if (data && (data.event === "meeting.participant_left" || data.event === "participant.left")) {
        action = "LEFT";
    }

    if (action && data.payload.object.participant) {
        const participant = data.payload.object.participant;
        const payload = {
            action: action,
            name: participant.user_name,
            email: participant.email || 'Invitado sin correo',
            meeting_id: data.payload.object.id,
            topic: data.payload.object.topic,
            event_ts: data.event_ts,
            timestamp: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
        };

        res.status(200).json({ status: "received" });

        if (GAS_URL) {
            try {
                await fetch(GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (err) {
                console.error('❌ Error API:', err.message);
            }
        }
    } else {
        res.status(200).json({ status: "ignored" });
    }
};
