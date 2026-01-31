const crypto = require('crypto');

module.exports = async (req, res) => {
    const { s } = req.query;
    const ZOOM_WEBHOOK_SECRET = (s || process.env.ZOOM_WEBHOOK_SECRET_TOKEN || "").trim();
    const GAS_URL = (process.env.GOOGLE_SCRIPT_URL || process.env.GAS_URL || "").trim();

    const data = req.body;

    // 1. VALIDACIÓN DE URL (CRC)
    if (data && data.event === "endpoint.url_validation") {
        const plainToken = data.payload.plainToken;
        const hash = crypto.createHmac("sha256", ZOOM_WEBHOOK_SECRET).update(plainToken).digest("hex");
        return res.status(200).json({
            plainToken: plainToken,
            signature: hash,
            encryptedToken: hash
        });
    }

    // 2. DETECTAR EVENTOS
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

        // 3. ENVIAR A GOOGLE (Esperamos a que termine antes de responder a Zoom)
        if (GAS_URL) {
            try {
                console.log(`📤 Enviando ${action} de ${payload.name} a Google...`);

                const response = await fetch(GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    console.log('✅ Google Sheets recibió los datos correctamente.');
                } else {
                    console.error('⚠️ Google Sheets respondió con error:', response.status);
                }
            } catch (err) {
                console.error('❌ Error de conexión con Google:', err.message);
            }
        }

        // 4. RESPONDER A ZOOM (Al final para asegurar la ejecución)
        return res.status(200).json({ status: "received" });
    }

    return res.status(200).json({ status: "ignored" });
};
