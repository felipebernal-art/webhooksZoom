const crypto = require('crypto');
const axios = require('axios');

module.exports = async (req, res) => {
    // 1. Manejar el reto de validación de Zoom (URL Validation)
    if (req.body.event === 'endpoint.url_validation') {
        const plainToken = req.body.payload.plainToken;
        const hashForValidate = crypto
            .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN)
            .update(plainToken)
            .digest('hex');

        return res.status(200).json({
            plainToken: plainToken,
            signature: hashForValidate
        });
    }

    // 2. Manejar eventos de participantes
    // Eventos sugeridos: 'participant.joined'
    if (req.body.event === 'participant.joined') {
        const participant = req.body.payload.object.participant;
        const meetingId = req.body.payload.object.id;
        const meetingTopic = req.body.payload.object.topic;

        const dataForSheets = {
            name: participant.user_name,
            email: participant.email,
            meeting_id: meetingId,
            topic: meetingTopic,
            timestamp: new Date().toISOString()
        };

        try {
            // Enviamos los datos al Webhook de Google Apps Script
            await axios.post(process.env.GOOGLE_SCRIPT_URL, dataForSheets);
            console.log('Datos enviados a Sheets:', dataForSheets.name);
        } catch (error) {
            console.error('Error enviando a Sheets:', error.message);
        }
    }

    // Siempre responder 200 a Zoom para confirmar recepción
    res.status(200).send('OK');
};
