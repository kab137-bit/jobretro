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

from fastapi import Depends, Header

def get_current_user(authorization: str = Header(None)):
    print("받은 Authorization 헤더:", authorization)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요해요")

    token = authorization.replace("Bearer ", "")
    try:
        user = supabase.auth.get_user(token)
        print("인증된 사용자:", user.user.id)
        return user.user.id
    except Exception as e:
        print("토큰 검증 실패:", str(e))
        raise HTTPException(status_code=401, detail="유효하지 않은 로그인 정보예요")
class ApplicationCreate(BaseModel):
    company_name: str
    position: str | None = None
    apply_date: str | None = None
    next_schedule_date: str | None = None
    next_schedule_label: str | None = None
    source: str | None = None
    job_post_url: str | None = None


@app.get("/")
def root():
    return {"message": "JobRetro API 서버 정상 작동 중"}


@app.get("/applications")
def get_applications(user_id: str = Depends(get_current_user)):
    result = (
        supabase.table("applications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@app.post("/applications")
def create_application(app_data: ApplicationCreate, user_id: str = Depends(get_current_user)):
    result = supabase.table("applications").insert({
        "user_id": user_id,
        "company_name": app_data.company_name,
        "position": app_data.position,
        "apply_date": app_data.apply_date,
        "next_schedule_date": app_data.next_schedule_date,
        "next_schedule_label": app_data.next_schedule_label,
        "source": app_data.source,
        "job_post_url": app_data.job_post_url,
        "status": "지원함",
    }).execute()
    return result.data

class StatusUpdate(BaseModel):
    status: str


@app.patch("/applications/{application_id}/status")
def update_status(application_id: str, data: StatusUpdate, user_id: str = Depends(get_current_user)):
    result = (
        supabase.table("applications")
        .update({"status": data.status})
        .eq("id", application_id)
        .execute()
    )
    return result.data


@app.delete("/applications/{application_id}")
def delete_application(application_id: str, user_id: str = Depends(get_current_user)):
    supabase.table("stage_results").delete().eq("application_id", application_id).execute()
    supabase.table("applications").delete().eq("id", application_id).execute()
    return {"deleted": True}


@app.put("/applications/{application_id}")
def update_application(application_id: str, app_data: ApplicationCreate, user_id: str = Depends(get_current_user)):
    result = (
        supabase.table("applications")
        .update({
            "company_name": app_data.company_name,
            "position": app_data.position,
            "apply_date": app_data.apply_date,
            "next_schedule_date": app_data.next_schedule_date,
            "next_schedule_label": app_data.next_schedule_label,
            "source": app_data.source,
        })
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
def get_reflections(application_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase.table("stage_results")
        .select("*")
        .eq("application_id", application_id)
        .eq("user_id", user_id)
        .order("recorded_at", desc=True)
        .execute()
    )
    return result.data

@app.post("/reflections")
def create_reflection(data: ReflectionCreate, user_id: str = Depends(get_current_user)):
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={GEMINI_API_KEY}",
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
            "user_id": user_id,
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
def delete_reflection(reflection_id: str, user_id: str = Depends(get_current_user)):
    supabase.table("stage_results").delete().eq("id", reflection_id).execute()
    return {"deleted": True}


class ReflectionCreate(BaseModel):
    application_id: str
    raw_text: str


class ReflectionUpdate(BaseModel):
    raw_text: str

@app.put("/reflections/{reflection_id}")
def update_reflection(reflection_id: str, data: ReflectionUpdate, user_id: str = Depends(get_current_user)):
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={GEMINI_API_KEY}",
        json={
            "contents": [{"parts": [{"text": data.raw_text}]}],
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "generationConfig": {"responseMimeType": "application/json"},
        },
    )

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="AI 재분석 실패")

    ai_result = response.json()
    text = ai_result["candidates"][0]["content"]["parts"][0]["text"]
    parsed = json.loads(text)

    result = (
        supabase.table("stage_results")
        .update({
            "stage": parsed.get("stage"),
            "result": parsed.get("result"),
            "reason_tags": ",".join(parsed.get("reason_tags", [])),
            "memo": parsed.get("summary"),
            "raw_text": data.raw_text,
        })
        .eq("id", reflection_id)
        .execute()
    )
    return result.data

@app.get("/report")
def get_report(user_id: str = Depends(get_current_user)):
    reflections = supabase.table("stage_results").select("*").eq("user_id", user_id).execute().data

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

    prompt = f"""아래는 한 취준생이 남긴 지원 회고 통계입니다.

[통계]
{stats_text}

다음 두 가지를 각각 작성하세요:

1. summary: 회고 인사이트. 4문장 이내. 숫자는 주어진 것만 인용. 완곡한 표현 사용. 다음 준비 제안은 summary에 포함하지 말 것.
2. checklist: 다음 면접 전 준비하면 좋을 구체적 행동 2~3개. 각 항목은 15자 이내의 짧은 행동 문구.

반드시 아래와 정확히 같은 키 이름으로 된 JSON 객체 하나만 응답하세요. summary와 checklist 두 키가 모두 반드시 포함되어야 합니다.

{{"summary": "...", "checklist": ["...", "..."]}}"""

    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={GEMINI_API_KEY}",
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json"},
        },
    )

    if response.status_code != 200:
        print("Gemini 에러 응답:", response.status_code, response.text)
        raise HTTPException(status_code=500, detail=f"리포트 생성 실패: {response.text}")

    ai_result = response.json()
    parsed_report = json.loads(ai_result["candidates"][0]["content"]["parts"][0]["text"])
    summary_text = parsed_report.get("summary", "")
    checklist = parsed_report.get("checklist", [])

    stats_snapshot = {
        "stage_counts": stage_counts,
        "result_counts": result_counts,
        "tag_counts": tag_counts,
    }

    supabase.table("analysis_reports").insert({
        "user_id": user_id,
        "summary_text": summary_text,
        "stats_snapshot": stats_snapshot,
    }).execute()

    return {
        "enough_data": True,
        "summary": summary_text,
        "checklist": checklist,
        "stats": stats_snapshot,
    }

class RehearsalGenerate(BaseModel):
    tag: str


@app.post("/rehearsal/generate")
def generate_rehearsal_question(data: RehearsalGenerate, user_id: str = Depends(get_current_user)):
    related = (
        supabase.table("stage_results")
        .select("raw_text")
        .eq("user_id", user_id)
        .ilike("reason_tags", f"%{data.tag}%")
        .limit(3)
        .execute()
        .data
    )
    source_texts = [r["raw_text"] for r in related if r.get("raw_text")]
    examples = "\n".join([f"- {t}" for t in source_texts])

    prompt = f"""당신은 면접관입니다. 지원자가 과거 '{data.tag}' 관련 질문에서 아래와 같은 아쉬움을 스스로 남겼습니다.

[지원자가 남긴 회고]
{examples if examples else "(참고할 회고가 없어 일반적인 질문으로 작성)"}

이 회고 내용을 참고해서, 지원자가 아쉬워했던 바로 그 지점을 정확히 파고드는 모의 면접 질문을 하나 작성하세요.
일반적인 질문이 아니라, 위 회고에서 언급된 구체적 상황이나 표현을 반영한 질문이어야 합니다.
한 문장으로, 실제 면접관의 자연스러운 어조로 작성하세요. 질문 텍스트만 응답하세요."""

    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={GEMINI_API_KEY}",
        json={"contents": [{"parts": [{"text": prompt}]}]},
    )
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="질문 생성 실패")

    ai_result = response.json()
    question = ai_result["candidates"][0]["content"]["parts"][0]["text"].strip()

    result = supabase.table("rehearsals").insert({
        "user_id": user_id,
        "tag": data.tag,
        "question": question,
    }).execute()

    response_data = result.data[0]
    response_data["source_reflections"] = source_texts
    return response_data

class RehearsalFollowup(BaseModel):
    rehearsal_id: str
    answer: str


@app.post("/rehearsal/followup")
def generate_followup(data: RehearsalFollowup, user_id: str = Depends(get_current_user)):
    rehearsal = supabase.table("rehearsals").select("*").eq("id", data.rehearsal_id).execute().data[0]

    prompt = f"""당신은 면접관입니다. 아래는 방금 지원자에게 한 질문과 그 답변입니다.

질문: {rehearsal['question']}
답변: {data.answer}

이 답변에서 구체성이 부족하거나 더 파고들 만한 지점을 하나 찾아, 실제 면접관이 할 법한 꼬리질문을 하나만 작성하세요.
예: 역할이 모호하면 "구체적으로 어떤 역할을 맡으셨나요?", 결과가 없으면 "그래서 결과는 어땠나요?" 같은 식.
한 문장으로, 질문 텍스트만 응답하세요."""

    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={GEMINI_API_KEY}",
        json={"contents": [{"parts": [{"text": prompt}]}]},
    )
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="꼬리질문 생성 실패")

    ai_result = response.json()
    follow_up_question = ai_result["candidates"][0]["content"]["parts"][0]["text"].strip()

    supabase.table("rehearsals").update({
        "answer": data.answer,
        "follow_up_question": follow_up_question,
    }).eq("id", data.rehearsal_id).execute()

    return {"follow_up_question": follow_up_question}


class RehearsalFinal(BaseModel):
    rehearsal_id: str
    follow_up_answer: str


@app.post("/rehearsal/feedback")
def give_rehearsal_feedback(data: RehearsalFinal, user_id: str = Depends(get_current_user)):
    rehearsal = supabase.table("rehearsals").select("*").eq("id", data.rehearsal_id).execute().data[0]

    prompt = f"""아래는 모의 면접의 전체 대화입니다.

질문 1: {rehearsal['question']}
답변 1: {rehearsal['answer']}
꼬리질문: {rehearsal['follow_up_question']}
답변 2: {data.follow_up_answer}

STAR 기법(상황-과제-행동-결과) 관점에서 두 답변을 종합해 평가하고 피드백을 주세요.

작성 규칙:
- 잘한 점 1가지와 보완하면 좋을 점 1~2가지를 구체적으로 짚어주세요.
- 건설적인 어조를 사용하세요.
- 4문장 이내로 작성하세요."""

    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={GEMINI_API_KEY}",
        json={"contents": [{"parts": [{"text": prompt}]}]},
    )
    if response.status_code != 200:
        print("Gemini 에러 응답:", response.status_code, response.text)
        raise HTTPException(status_code=500, detail=f"피드백 생성 실패: {response.text}")

    ai_result = response.json()
    feedback = ai_result["candidates"][0]["content"]["parts"][0]["text"].strip()

    supabase.table("rehearsals").update({
        "follow_up_answer": data.follow_up_answer,
        "feedback": feedback,
    }).eq("id", data.rehearsal_id).execute()

    return {"feedback": feedback}