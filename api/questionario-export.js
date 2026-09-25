function csvCell(value) {
  const text = Array.isArray(value)
    ? value.join(" | ")
    : String(value ?? "");

  return `"${text.replace(/"/g, '""')}"`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const adminPassword =
    process.env.SURVEY_ADMIN_PASSWORD;

  if (
    !adminPassword ||
    req.body?.password !== adminPassword
  ) {
    return res.status(401).end();
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

      return res.status(500).end();
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

      return res.status(500).end();
    }

    const data =
      await response.json();

    const columns = [
      "created_at",
      "q1",
      "q2",
      "q3",
      "q4",
      "q5",
      "q6",
      "q7",
      "q8"
    ];

    const csv = [
      columns.join(","),

      ...data.map(row =>
        columns
          .map(column =>
            csvCell(row[column])
          )
          .join(",")
      )
    ].join("\n");

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="risposte-vocalflash.csv"'
    );

    return res
      .status(200)
      .send("\ufeff" + csv);

  } catch (error) {

    console.error(
      "Errore questionario-export:",
      error
    );

    return res
      .status(500)
      .end();
  }
}
