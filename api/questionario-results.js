export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metodo non consentito"
    });
  }

  const adminPassword =
    process.env.SURVEY_ADMIN_PASSWORD;

  if (
    !adminPassword ||
    req.body?.password !== adminPassword
  ) {
    return res.status(401).json({
      error: "Accesso negato"
    });
  }

  try {
    const supabaseUrl =
      process.env.SUPABASE_URL;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (
      !supabaseUrl ||
      !supabaseSecretKey
    ) {
      console.error(
        "Variabili SUPABASE_URL o SUPABASE_SECRET_KEY mancanti"
      );

      return res.status(500).json({
        error: "Configurazione database mancante"
      });
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/questionario_vocalflash?select=*&order=created_at.desc`,
      {
        headers: {
          apikey: supabaseSecretKey
        }
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
        error: "Errore lettura risultati"
      });
    }

    const data =
      await response.json();

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res.status(200).json({
      responses: data
    });

  } catch (error) {

    console.error(
      "Errore questionario-results:",
      error
    );

    return res.status(500).json({
      error: "Errore interno"
    });
  }
}
