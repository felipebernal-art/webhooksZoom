const crypto = require('crypto');
const axios = require('axios');

module.exports = async (req, res) => {
    try {
        // 0. Manejar peticiones GET (cuando abres la URL en el navegador)
        if (req.method === 'GET') {
            return res.status(200).send('🚀 El servidor del Webhook está activo y listo para Zoom.');
        }

        // 1. Verificar que el cuerpo de la petición existe
        if (!req.body || !req.body.event) {
            return res.status(400).send('No se recibió un evento válido.');
        }

        // 2. Manejar el reto de validación de Zoom (URL Validation)
        if (req.body.event === 'endpoint.url_validation') {
            const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;

            if (!secretToken) {
                console.error('ERROR: Falta la variable ZOOM_WEBHOOK_SECRET_TOKEN en Vercel');
                return res.status(500).json({ message: 'Secret Token missing' });
            }

            const plainToken = req.body.payload.plainToken;
            const hashForValidate = crypto
                .createHmac('sha256', secretToken)
                .update(plainToken)
                .digest('hex');

            console.log('Validación de URL procesada con éxito');
            return res.status(200).json({
                plainToken: plainToken,
                signature: hashForValidate
            });
        }

        // 3. Manejar eventos de participantes
        if (req.body.event === 'participant.joined') {
            const participant = req.body.payload.object.participant;
            const meetingId = req.body.payload.object.id;
            const meetingTopic = req.body.payload.object.topic;

            const dataForSheets = {
                name: participant.user_name,
                email: participant.email,
                meeting_id: meetingId,
                topic: meetingTopic,
                timestamp: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
            };

            // Solo enviamos a Google si tenemos la URL configurada
            if (process.env.GOOGLE_SCRIPT_URL) {
                await axios.post(process.env.GOOGLE_SCRIPT_URL, dataForSheets);
                console.log('✅ Datos enviados a Sheets:', dataForSheets.name);
            } else {
                console.warn('⚠️ GOOGLE_SCRIPT_URL no configurada.');
            }
        }

        // Siempre responder 200 a Zoom para confirmar recepción
        res.status(200).json({ status: 'received' });

    } catch (error) {
        console.error('❌ Error en el Webhook:', error.message);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
};
