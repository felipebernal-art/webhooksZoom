const crypto = require('crypto');

module.exports = async (req, res) => {
    // 0. Variables de entorno (Probamos ambos nombres por si acaso)
    const ZOOM_WEBHOOK_SECRET = (process.env.ZOOM_WEBHOOK_SECRET_TOKEN || process.env.ZOOM_WEBHOOK_SECRET || "").trim();
    const GAS_URL = (process.env.GOOGLE_SCRIPT_URL || process.env.GAS_URL || "").trim();

    // Diagnóstico para el navegador (GET)
    if (req.method === 'GET') {
        return res.status(200).send(`🚀 Servidor OK. Secret: ${ZOOM_WEBHOOK_SECRET ? '✅' : '❌'} | Google: ${GAS_URL ? '✅' : '❌'}`);
    }

    // En Vercel Node.js estándar, req.body ya viene parseado
    const data = req.body;

    // 1. VALIDACIÓN DE URL (CRC)
    if (data && data.event === "endpoint.url_validation") {
        const plainToken = data.payload.plainToken;
        const hash = crypto.createHmac("sha256", ZOOM_WEBHOOK_SECRET).update(plainToken).digest("hex");

        console.log('✅ Validando con:', plainToken);

        // Devolvemos la respuesta que Zoom espera
        return res.status(200).json({
            plainToken: plainToken,
            signature: hash,
            encryptedToken: hash
        });
    }

    // 2. PROCESAR PARTICIPANTE
    if (data && data.event === "participant.joined") {
        const participant = data.payload.object.participant;
        const payloadForSheets = {
            name: participant.user_name,
            email: participant.email || 'Invitado sin correo',
            meeting_id: data.payload.object.id,
            topic: data.payload.object.topic,
            timestamp: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
        };

        console.log('👤 Registrando a:', payloadForSheets.name);

        if (GAS_URL) {
            try {
                // Fetch está disponible de forma nativa en Node.js 18+ en Vercel
                await fetch(GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadForSheets)
                });
                console.log('✅ Enviado a Google Sheets');
            } catch (err) {
                console.error('❌ Error enviando a Sheets:', err.message);
            }
        }
    }

    return res.status(200).json({ status: "received" });
};
