from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client
import os
import json
import requests
from dotenv import load_dotenv


load_dotenv()

app = FastAPI()

# React(localhost:5173)에서의 요청을 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


class ApplicationCreate(BaseModel):
    company_name: str
    position: str | None = None
    apply_date: str | None = None
    next_schedule_date: str | None = None
    next_schedule_label: str | None = None


@app.get("/")
def root():
    return {"message": "JobRetro API 서버 정상 작동 중"}


@app.get("/applications")
def get_applications():
    result = supabase.table("applications").select("*").order("created_at", desc=True).execute()
    return result.data


@app.post("/applications")
def create_application(app_data: ApplicationCreate):
    result = supabase.table("applications").insert({
        "company_name": app_data.company_name,
        "position": app_data.position,
        "apply_date": app_data.apply_date,
        "next_schedule_date": app_data.next_schedule_date,
        "next_schedule_label": app_data.next_schedule_label,
        "status": "지원함",
    }).execute()
    return result.data

class StatusUpdate(BaseModel):
    status: str


@app.patch("/applications/{application_id}/status")
def update_status(application_id: str, data: StatusUpdate):
    result = (
        supabase.table("applications")
        .update({"status": data.status})
        .eq("id", application_id)
        .execute()
    )
    return result.data

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

SYSTEM_PROMPT = """당신은 취준생의 면접/서류 회고를 구조화하는 도우미입니다.
사용자의 입력에서 다음 정보를 추출해 JSON으로만 응답하세요.

추출 항목:
- stage: 아래 중 하나만 선택 → ["서류", "1차면접", "2차면접", "최종면접", "기타"]
- result: 아래 중 하나만 선택 → ["합격", "불합격", "진행중", "미정"]
- reason_tags: 아래 목록 중에서만 선택 (복수 가능, 배열) → ["기술역량", "협업경험", "지원동기", "커뮤니케이션", "직무적합성", "기타"]
- summary: 회고를 한 문장으로 요약 (과장 없이)

반드시 JSON 형식으로만 응답하세요. 다른 설명은 붙이지 마세요."""


class ReflectionCreate(BaseModel):
    application_id: str
    raw_text: str


@app.get("/applications/{application_id}/reflections")
def get_reflections(application_id: str):
    result = (
        supabase.table("stage_results")
        .select("*")
        .eq("application_id", application_id)
        .order("recorded_at", desc=True)
        .execute()
    )
    return result.data


@app.post("/reflections")
def create_reflection(data: ReflectionCreate):
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={GEMINI_API_KEY}",
        json={
            "contents": [{"parts": [{"text": data.raw_text}]}],
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "generationConfig": {"responseMimeType": "application/json"},
        },
    )

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="AI 분석 실패")

    ai_result = response.json()
    text = ai_result["candidates"][0]["content"]["parts"][0]["text"]
    parsed = json.loads(text)

    result = (
        supabase.table("stage_results")
        .insert({
            "application_id": data.application_id,
            "stage": parsed.get("stage"),
            "result": parsed.get("result"),
            "reason_tags": ",".join(parsed.get("reason_tags", [])),
            "memo": parsed.get("summary"),
            "raw_text": data.raw_text,
        })
        .execute()
    )
    return result.data


@app.delete("/reflections/{reflection_id}")
def delete_reflection(reflection_id: str):
    supabase.table("stage_results").delete().eq("id", reflection_id).execute()
    return {"deleted": True}

@app.get("/report")
def get_report():
    reflections = supabase.table("stage_results").select("*").execute().data

    if len(reflections) < 3:
        return {
            "enough_data": False,
            "message": f"아직 회고가 {len(reflections)}개예요. 3개 이상 쌓이면 패턴 분석을 볼 수 있어요.",
        }

    stage_counts = {}
    result_counts = {}
    tag_counts = {}

    for r in reflections:
        stage = r.get("stage") or "기타"
        result = r.get("result") or "미정"
        stage_counts[stage] = stage_counts.get(stage, 0) + 1
        result_counts[result] = result_counts.get(result, 0) + 1
        for t in (r.get("reason_tags") or "").split(","):
            t = t.strip()
            if t:
                tag_counts[t] = tag_counts.get(t, 0) + 1

    stats_text = f"""- 총 회고 수: {len(reflections)}건
- 단계별 회고 분포: {stage_counts}
- 결과별 분포: {result_counts}
- 약점 태그 빈도: {tag_counts}"""

    prompt = f"""아래는 한 취준생이 남긴 지원 회고 통계입니다. 이 데이터를 바탕으로 회고 인사이트를 작성해주세요.

[통계]
{stats_text}

작성 규칙:
- 숫자를 다시 계산하거나 새로 만들지 말고, 주어진 숫자만 인용하세요.
- 단정적 표현("~때문입니다") 대신 완곡한 표현("~가능성이 있어요")을 쓰세요.
- 4문장 이내로 작성하세요.
- 다음에 무엇을 준비하면 좋을지 한 줄 제안을 포함하세요."""

    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={GEMINI_API_KEY}",
        json={"contents": [{"parts": [{"text": prompt}]}]},
    )

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="리포트 생성 실패")

    ai_result = response.json()
    summary_text = ai_result["candidates"][0]["content"]["parts"][0]["text"]

    stats_snapshot = {
        "stage_counts": stage_counts,
        "result_counts": result_counts,
        "tag_counts": tag_counts,
    }

    supabase.table("analysis_reports").insert({
        "summary_text": summary_text,
        "stats_snapshot": stats_snapshot,
    }).execute()

    return {"enough_data": True, "summary": summary_text, "stats": stats_snapshot}