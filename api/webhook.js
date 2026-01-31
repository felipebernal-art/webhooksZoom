const crypto = require('crypto');
const https = require('https');

module.exports = async (req, res) => {
    console.log('--- Nueva Petición Recibida ---');
    console.log('Método:', req.method);
    console.log('Evento:', req.body ? req.body.event : 'Sin evento');

    try {
        if (req.method === 'GET') {
            return res.status(200).send('🚀 Servidor activo. Variables cargadas: ' +
                (process.env.ZOOM_WEBHOOK_SECRET_TOKEN ? 'Secret ✅' : 'Secret ❌') + ' | ' +
                (process.env.GOOGLE_SCRIPT_URL ? 'Google Script ✅' : 'Google Script ❌'));
        }

        const secretToken = (process.env.ZOOM_WEBHOOK_SECRET_TOKEN || '').trim();

        // 1. Manejar Validación de Zoom (CRC)
        if (req.body.event === 'endpoint.url_validation') {
            if (!secretToken) {
                console.error('CRÍTICO: No existe la variable ZOOM_WEBHOOK_SECRET_TOKEN');
                return res.status(500).send('Configuración incompleta en Vercel');
            }

            const plainToken = req.body.payload.plainToken;
            const signature = crypto
                .createHmac('sha256', secretToken)
                .update(plainToken)
                .digest('hex');

            console.log('--- DIAGNÓSTICO DE VALIDACIÓN ---');
            console.log('PlainToken:', plainToken);
            console.log('Secret en Vercel (COMPLETO):', secretToken);
            console.log('Signature generada:', signature);

            // Forzamos el Content-Type y enviamos solo lo necesario
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).send(JSON.stringify({
                plainToken: plainToken,
                signature: signature
            }));
        }

        // 2. Manejar Participantes (Solo si es POST y no es validación)
        if (req.body.event === 'participant.joined') {
            const part = req.body.payload.object.participant;
            const data = {
                name: part.user_name,
                email: part.email,
                meeting_id: req.body.payload.object.id,
                topic: req.body.payload.object.topic,
                timestamp: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
            };

            console.log('👤 Participante entró:', data.name);

            if (process.env.GOOGLE_SCRIPT_URL) {
                const url = new URL(process.env.GOOGLE_SCRIPT_URL);
                const options = {
                    hostname: url.hostname,
                    path: url.pathname + url.search,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                };

                const reqGoogle = https.request(options);
                reqGoogle.write(JSON.stringify(data));
                reqGoogle.end();
            }
        }

        return res.status(200).json({ status: 'ok' });

    } catch (err) {
        console.error('❌ Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
