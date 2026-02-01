const crypto = require('crypto');

module.exports = async (req, res) => {
    const { s } = req.query;
    const ZOOM_WEBHOOK_SECRET = (s || process.env.ZOOM_WEBHOOK_SECRET_TOKEN || "").trim();
    
    // URL de tu formulario de respuestas (cambiamos viewform por formResponse)
    const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeHKDY45czHBQ9d4bIvwX17wAnGhiQkhMmFqxRI4gvvwC21NA/formResponse";

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
        
        // Mapeamos los campos de Zoom a los IDs de tu Google Form
        const formParams = new URLSearchParams();
        formParams.append('entry.101963435', participant.user_name);                    // Nombre
        formParams.append('entry.1759790462', participant.email || 'Invitado sin correo');  // Correo
        formParams.append('entry.2034263188', data.payload.object.id);                  // Meeting ID
        formParams.append('entry.2032219750', data.payload.object.topic);               // Tema
        formParams.append('entry.472479858', action);                                   // Accion
        formParams.append('entry.361261917', new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })); // Fecha/Hora
        formParams.append('entry.1294083632', data.event_ts);                           // Event TS
        formParams.append('entry.576761649', participant.user_id);                      // Zoom User ID

        // Enviamos la respuesta a Zoom de inmediato
        res.status(200).json({ status: "sent_to_form" });

        // Enviamos al formulario (Fire and forget, es ultra confiable)
        try {
            fetch(FORM_URL, {
                method: 'POST',
                mode: 'no-cors', // Importante para Google Forms
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formParams.toString()
            }).catch(err => console.error("Error enviando al Form:", err.message));
        } catch (err) {
            console.error("Error crítico:", err.message);
        }
        
    } else {
        res.status(200).json({ status: "ignored" });
    }
};
