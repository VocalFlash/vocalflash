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


    /*
     * Colonne della nuova versione
     * del questionario.
     */

    const columns = [
      {
        key: "created_at",
        label: "Data"
      },

      {
        key: "q1",
        label: "Uso WhatsApp"
      },

      {
        key: "q2",
        label: "Vocali al giorno"
      },

      {
        key: "q3",
        label: "Recupero informazioni"
      },

      {
        key: "q4",
        label: "Informazioni distribuite"
      },

      {
        key: "q5",
        label: "Dimenticanze / sospesi"
      },

      {
        key: "q6",
        label: "Funzioni desiderate"
      },

      {
        key: "q7",
        label: "Autonomia assistente"
      },

      {
        key: "q8",
        label: "Disponibilità a pagare"
      },

      {
        key: "q9",
        label: "Problema principale"
      }
    ];


    /*
     * Costruzione CSV.
     *
     * csvCell gestisce automaticamente
     * anche q6, che è un array.
     */

    const csv = [

      columns
        .map(column =>
          csvCell(column.label)
        )
        .join(","),

      ...data.map(row =>

        columns
          .map(column =>
            csvCell(
              row[column.key]
            )
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
      'attachment; filename="risposte-questionario-whatsapp.csv"'
    );


    /*
     * BOM UTF-8:
     * aiuta Excel ad aprire correttamente
     * accenti e caratteri come €.
     */

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
