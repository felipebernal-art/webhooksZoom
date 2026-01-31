const crypto = require('crypto');

export default async function handler(req) {
    // 0. Variables de entorno (Probamos ambos nombres por si acaso)
    const ZOOM_WEBHOOK_SECRET = (process.env.ZOOM_WEBHOOK_SECRET_TOKEN || process.env.ZOOM_WEBHOOK_SECRET || "").trim();
    const GAS_URL = (process.env.GOOGLE_SCRIPT_URL || process.env.GAS_URL || "").trim();

    // Diagnóstico para el navegador (GET)
    if (req.method === 'GET') {
        return new Response(`🚀 Servidor OK. Secret: ${ZOOM_WEBHOOK_SECRET ? '✅' : '❌'} | Google: ${GAS_URL ? '✅' : '❌'}`, { status: 200 });
    }

    // Leer el cuerpo de la petición
    const rawBody = await req.text();
    let data = {};
    try {
        data = JSON.parse(rawBody);
    } catch (e) {
        return new Response("Invalid JSON", { status: 400 });
    }

    // 1. VALIDACIÓN DE URL (CRC)
    if (data.event === "endpoint.url_validation") {
        const plainToken = data.payload.plainToken;
        const hash = crypto.createHmac("sha256", ZOOM_WEBHOOK_SECRET).update(plainToken).digest("hex");

        console.log('✅ Validando con:', plainToken);

        // Devolvemos ambos campos para asegurar compatibilidad total
        return new Response(JSON.stringify({
            plainToken: plainToken,
            signature: hash,
            encryptedToken: hash
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    }

    // 2. PROCESAR PARTICIPANTE
    if (data.event === "participant.joined") {
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

    return new Response(JSON.stringify({ status: "received" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}

export const config = {
    runtime: 'edge', // Esto lo hace ultra rápido y compatible con el código de Next.js
};
