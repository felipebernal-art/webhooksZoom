const crypto = require('crypto');

module.exports = async (req, res) => {
    const ZOOM_WEBHOOK_SECRET = (process.env.ZOOM_WEBHOOK_SECRET_TOKEN || process.env.ZOOM_WEBHOOK_SECRET || "").trim();
    const GAS_URL = (process.env.GOOGLE_SCRIPT_URL || process.env.GAS_URL || "").trim();

    // 0. Registrar cualquier petición para diagnóstico
    if (req.method === 'POST') {
        console.log('--- EVENTO RECIBIDO ---');
        console.log('Tipo de evento:', req.body ? req.body.event : 'Sin evento');
    }

    if (req.method === 'GET') {
        return res.status(200).send(`🚀 Servidor OK. Secret: ${ZOOM_WEBHOOK_SECRET ? '✅' : '❌'} | Google: ${GAS_URL ? '✅' : '❌'}`);
    }

    const data = req.body;

    // 1. VALIDACIÓN DE URL (CRC)
    if (data && data.event === "endpoint.url_validation") {
        const plainToken = data.payload.plainToken;
        const hash = crypto.createHmac("sha256", ZOOM_WEBHOOK_SECRET).update(plainToken).digest("hex");
        console.log('✅ URL Validada con éxito');
        return res.status(200).json({
            plainToken: plainToken,
            signature: hash,
            encryptedToken: hash
        });
    }

    // 2. PROCESAR PARTICIPANTE (Aceptamos ambos formatos por si acaso)
    if (data && (data.event === "meeting.participant_joined" || data.event === "participant.joined")) {
        const participant = data.payload.object.participant;
        const payloadForSheets = {
            name: participant.user_name,
            email: participant.email || 'Invitado sin correo',
            meeting_id: data.payload.object.id,
            topic: data.payload.object.topic,
            timestamp: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
        };

        console.log('👤 PARTICIPANTE DETECTADO:', payloadForSheets.name);

        if (GAS_URL) {
            try {
                const response = await fetch(GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadForSheets)
                });
                console.log('✅ Respuesta de Google Sheets:', response.status);
            } catch (err) {
                console.error('❌ Error enviando a Sheets:', err.message);
            }
        }
    }

    return res.status(200).json({ status: "received" });
};
