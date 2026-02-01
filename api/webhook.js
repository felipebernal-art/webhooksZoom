const crypto = require('crypto');

module.exports = async (req, res) => {
    const { s } = req.query;
    const ZOOM_WEBHOOK_SECRET = (s || process.env.ZOOM_WEBHOOK_SECRET_TOKEN || "").trim();
    const GAS_URL = (process.env.GOOGLE_SCRIPT_URL || process.env.GAS_URL || "").trim();

    const data = req.body;

    // 1. VALIDACIÓN CRC (ZOOM)
    if (data && data.event === "endpoint.url_validation") {
        const plainToken = data.payload.plainToken;
        const hash = crypto.createHmac("sha256", ZOOM_WEBHOOK_SECRET).update(plainToken).digest("hex");
        return res.status(200).json({ plainToken, signature: hash, encryptedToken: hash });
    }

    // 2. PROCESAMIENTO DE EVENTOS
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
            zoom_user_id: participant.user_id,
            timestamp: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
        };

        const startTime = Date.now();
        console.log(`🚀 [${action}] Iniciando envío para: ${payload.name}`);

        if (GAS_URL) {
            try {
                // Ponemos un timeout de 15 segundos para el fetch
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);

                const response = await fetch(GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                const duration = Date.now() - startTime;

                if (response.ok) {
                    console.log(`✅ Google respondió OK en ${duration}ms para ${payload.name}`);
                } else {
                    console.error(`⚠️ Google dio error ${response.status} en ${duration}ms`);
                }
            } catch (err) {
                const duration = Date.now() - startTime;
                console.error(`❌ ERROR CRÍTICO tras ${duration}ms:`, err.message);
            }
        }

        return res.status(200).json({ status: "received" });
    }

    return res.status(200).json({ status: "ignored" });
};
