export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metodo non consentito"
    });
  }

  try {
    const body = req.body || {};

    // Campo invisibile anti-bot
    if (body.website) {
      return res.status(200).json({
        ok: true
      });
    }

    // Controllo campi obbligatori a risposta singola
    for (const key of ["q1", "q2", "q3", "q4", "q7"]) {
      if (!body[key]) {
        return res.status(400).json({
          error: "Campi mancanti"
        });
      }
    }

    // Controllo domande a risposta multipla
    if (
      !Array.isArray(body.q5) ||
      body.q5.length === 0 ||
      !Array.isArray(body.q6) ||
      body.q6.length === 0
    ) {
      return res.status(400).json({
        error: "Campi mancanti"
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      console.error(
        "Variabili SUPABASE_URL o SUPABASE_SECRET_KEY mancanti"
      );

      return res.status(500).json({
        error: "Configurazione database mancante"
      });
    }

    const payload = {
      q1: String(body.q1).slice(0, 120),
      q2: String(body.q2).slice(0, 80),
      q3: String(body.q3).slice(0, 80),
      q4: String(body.q4).slice(0, 80),

      q5: body.q5
        .slice(0, 12)
        .map(value =>
          String(value).slice(0, 120)
        ),

      q6: body.q6
        .slice(0, 12)
        .map(value =>
          String(value).slice(0, 120)
        ),

      q7: String(body.q7).slice(0, 120),

      q8: String(
        body.q8 || ""
      ).slice(0, 1200)
    };

    const response = await fetch(
      `${supabaseUrl}/rest/v1/questionario_vocalflash`,
      {
        method: "POST",

        headers: {
          apikey: supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          "Content-Type":
            "application/json",

          Prefer:
            "return=minimal"
        },

        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "Errore Supabase:",
        response.status,
        errorText
      );

      return res.status(500).json({
        error:
          "Errore durante il salvataggio"
      });
    }

    return res.status(200).json({
      ok: true
    });

  } catch (error) {

    console.error(
      "Errore questionario-submit:",
      error
    );

    return res.status(500).json({
      error: "Errore interno"
    });
  }
}
