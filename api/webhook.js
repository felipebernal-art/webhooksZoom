const crypto = require('crypto');

module.exports = async (req, res) => {
    const { s } = req.query;
    const ZOOM_WEBHOOK_SECRET = (s || process.env.ZOOM_WEBHOOK_SECRET_TOKEN || "").trim();
    
    // URL de tu formulario (asegúrate de que termine en /formResponse)
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
        
        // Mapeamos los campos con tus IDs entry.XXXXX
        const formParams = new URLSearchParams();
        formParams.append('entry.101963435', participant.user_name || "");
        formParams.append('entry.1759790462', participant.email || 'Invitado sin correo');
        formParams.append('entry.2034263188', data.payload.object.id || "");
        formParams.append('entry.2032219750', data.payload.object.topic || "");
        formParams.append('entry.472479858', action);
        formParams.append('entry.361261917', new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }));
        formParams.append('entry.1294083632', data.event_ts || "");
        formParams.append('entry.576761649', participant.user_id || "");

        try {
            // USAMOS AWAIT: Esperamos a que el formulario reciba el dato ANTES de responder a Zoom
            // Esto evita que Vercel mate el proceso antes de tiempo.
            const response = await fetch(FORM_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formParams.toString()
            });

            if (response.ok || response.status === 0 || response.status === 200) {
                console.log(`✅ Formulario actualizado para: ${participant.user_name}`);
            } else {
                console.error(`⚠️ Google Forms respondió con status: ${response.status}`);
            }
        } catch (err) {
            console.error("❌ Error enviando al Form:", err.message);
        }

        // Respondemos a Zoom al final del proceso
        return res.status(200).json({ status: "success" });
        
    } else {
        return res.status(200).json({ status: "ignored" });
    }
};
