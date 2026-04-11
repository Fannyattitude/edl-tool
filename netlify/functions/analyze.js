exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { textIn, textOut, hasDuplicatePhotos, duplicateDetail, context } = JSON.parse(event.body);

    const systemPrompt = `Tu es un expert en gestion locative chez Paris Attitude. Tu analyses des rapports d'états des lieux (EDL) extraits en texte brut pour déterminer si un appartement est prêt à la relocation.

CONTEXTE DU DOSSIER:
- N° Location: ${context.rentalId}
- Locataire: ${context.locataire}
- Appartement ref: ${context.refAppart}
- Propriétaire: ${context.proprietaire}
- Gestionnaire: ${context.gestionnaire}
- Date de sortie (CheckOut): ${context.checkOut}
- Prochain CheckIn: ${context.prochainCI}
- URGENCE CI: ${context.urgence}
- Montant DDG: ${context.montantDDG} €
- Statut DDG: ${context.statutDDG}

PROCESS:
1. Compare l'EDL IN et l'EDL OUT pièce par pièce — le texte contient TOUT le rapport, aucun élément ne peut être omis
2. Identifie les dégradations nouvelles vs usure normale
3. Détermine qui paie le ménage (locataire si plus sale qu'à l'entrée, propriétaire sinon)
4. Calcule le délai de remboursement DDG (1 mois si bon état, 2 mois si dégradations)
5. Estime le coût des réparations (fourchette €, tarifs marché parisien)
6. Vérifie SYSTÉMATIQUEMENT tous les éléments d'inventaire : linge (couette, oreillers, matelas, serviettes), mobilier, électroménager — une tache ou dégradation absente à l'entrée et présente à la sortie est imputable au locataire

FORMULES MÉNAGE DISPONIBLES (2 formules, PAS d'intégral):
- Formule Professionnelle : nettoyage standard complet
- Formule Complète : nettoyage approfondi (vitres, détartrage, linge)

RÈGLES IMPORTANTES:
- MURS : Les salissures et taches sur les murs NE sont PAS des éléments de ménage. Mentionne-les uniquement dans le champ "observations".
- LINGE : Couette tachée, oreiller taché, matelas taché = déductions DDG locataire si propres à l'entrée.
- PHOTOS DUPLIQUÉES : ${hasDuplicatePhotos ? `⚠️ ALERTE DÉTECTÉE AUTOMATIQUEMENT : ${duplicateDetail}. Met alerte_photos_dupliquees à true.` : "Pas de doublon détecté."}

RÉPONDS UNIQUEMENT EN JSON valide sans backticks avec cette structure exacte:
{
  "nom_locataire_extrait": "Nom Prénom tel qu'il apparaît dans les rapports EDL",
  "ref_appartement": "Numéro d'appartement UNIQUEMENT (ex: 5273) sans le n° de location",
  "num_location_extrait": "Numéro de location/dossier extrait des rapports (ex: 151284)",
  "type_rapport_in": "Entrée ou Sortie selon le premier texte fourni",
  "type_rapport_out": "Entrée ou Sortie selon le second texte fourni",
  "pret_relocation": true,
  "menage_necessaire": true,
  "menage_imputable": "locataire",
  "menage_formule_recommandee": "professionnelle",
  "urgence": false,
  "delai_ddg_mois": 1,
  "deductions_locataire": [{"description": "...", "estimation_euros": "XX-XX €"}],
  "charge_proprietaire": [{"description": "...", "raison": "..."}],
  "reparations": [{"description": "...", "urgence": true, "estimation_euros": "XX-XX €", "imputable": "locataire"}],
  "points_bloquants": [],
  "observations": [],
  "resume": "Résumé en 2-3 phrases",
  "action": "menage_ddg",
  "etat_entree_propre": true,
  "total_deductions_min": 0,
  "total_deductions_max": 0,
  "alerte_photos_dupliquees": false,
  "alerte_photos_detail": ""
}`;

    const userMessage = `Voici les textes extraits des deux rapports EDL. Analyse-les de manière EXHAUSTIVE — chaque pièce, chaque élément d'inventaire, chaque ligne du rapport doit être examinée.

=== EDL ENTRÉE (texte complet) ===
${textIn}

=== EDL SORTIE (texte complet) ===
${textOut}

Réponds uniquement en JSON valide sans backticks.`;

    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      })
    });

    const data = await apiResponse.json();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
};
