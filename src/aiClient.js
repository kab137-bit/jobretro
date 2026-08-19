const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

const SYSTEM_PROMPT = `당신은 취준생의 면접/서류 회고를 구조화하는 도우미입니다.
사용자의 입력에서 다음 정보를 추출해 JSON으로만 응답하세요.

추출 항목:
- stage: 아래 중 하나만 선택 → ["서류", "1차면접", "2차면접", "최종면접", "기타"]
- result: 아래 중 하나만 선택 → ["합격", "불합격", "진행중", "미정"]
- reason_tags: 아래 목록 중에서만 선택 (복수 가능, 배열) → ["기술역량", "협업경험", "지원동기", "커뮤니케이션", "직무적합성", "기타"]
- summary: 회고를 한 문장으로 요약 (과장 없이)

반드시 JSON 형식으로만 응답하세요. 다른 설명은 붙이지 마세요.`

export async function extractReflection(rawText) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: rawText }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  return JSON.parse(text)
}