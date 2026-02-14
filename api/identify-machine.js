export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const { image_base64, user_context } = req.body || {};
    if (!image_base64) return res.status(400).send("Missing image_base64");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).send("Missing OPENAI_API_KEY env var");

    // Build a conservative, clinical prompt (neck fusion + shoulder history)
    const prompt = `
You are a conservative, safety-first gym assistant.
User constraints:
- Neck fusion (2 vertebrae) + chronic neck/trap pain
- History of multiple LEFT shoulder surgeries
Task:
1) Identify the gym machine/station in the image (best guess).
2) Determine movement pattern (e.g., row_horizontal, pulldown_vertical, chest_press, leg_press, scapular_health, biceps_iso, triceps_iso, core_anti).
3) Determine likely target zones (Hebrew): גב, חזה, רגליים, שכמות, יד קדמית, יד אחורית, ליבה, כתפיים.
4) Give step-by-step safe usage instructions (short but clear).
5) Give safety notes specific to neck/shoulder (avoid behind-neck, avoid shrugging, limit ROM if pain).
Return STRICT JSON:
{
  "machine_name": string,
  "confidence": number,   // 0-1
  "pattern": string,
  "zones": string[],
  "how_to": string,
  "safety": string,
  "suggested_zone": string,
  "suggested_pattern": string
}
If uncertain: machine_name="unknown", confidence<=0.4, and focus on safe general options.
`;

    const imgDataUrl = `data:image/jpeg;base64,${image_base64}`;

    // OpenAI Responses API with image input (base64 data URL). 2
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_text", text: JSON.stringify(user_context || {}) },
              { type: "input_image", image_url: imgDataUrl }
            ]
          }
        ]
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(500).send(t || "OpenAI request failed");
    }

    const data = await r.json();

    // Responses API returns text in output; safest extraction:
    const outputText =
      data.output_text ||
      (data.output && data.output[0] && data.output[0].content && data.output[0].content[0] && data.output[0].content[0].text) ||
      null;

    if (!outputText) return res.status(500).send("No output_text from OpenAI");

    // outputText should already be JSON string due to response_format
    const parsed = JSON.parse(outputText);
    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).send(e?.message || String(e));
  }
}
