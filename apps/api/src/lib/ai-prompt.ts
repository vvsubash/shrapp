export function buildExtractionPrompt(
  employeeNames: string[],
  locationNames: string[],
): string {
  const empList = employeeNames.map((n) => `- ${n}`).join("\n");
  const locList = locationNames.map((n) => `- ${n}`).join("\n");

  return `You are extracting a daily labour attendance register from a photograph.

Known employees (snap to these when you are confident, otherwise return the raw text you see):
${empList}

Known work locations:
${locList}

Extract the date from the top of the register, then each numbered row.
Return ONLY valid JSON matching this schema:

{
  "work_date": "YYYY-MM-DD",
  "rows": [
    {
      "row_num": <integer>,
      "name_raw": "<ocr'd name as written>",
      "matched_name": "<name from known list, or null>",
      "location_raw": "<ocr'd location as written>",
      "matched_location": "<location from known list, or null>"
    }
  ]
}

Rules:
- If a row is illegible, set name_raw to "[illegible]" and still include it.
- Do not invent names that are not visible in the image.
- Do not add rows that are not in the register.
- Return ONLY the JSON object. No prose, no code fences.`;
}
