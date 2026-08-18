# DB 설계서 (Supabase / PostgreSQL)

## 1. ERD

```
auth.users (Supabase Auth 기본 제공)
      │ 1
      │
      │ N
applications (지원 카드)
      │ 1
      │
      │ N
stage_results (단계별 회고 기록)

auth.users (1) ── (N) analysis_reports (AI 분석 리포트)
```

- `auth.users`는 Supabase가 기본 제공하는 인증 테이블이라 별도로 만들 필요 없음
- 직접 생성할 테이블은 `applications`, `stage_results`, `analysis_reports` 3개

---

## 2. 테이블 상세 정의

### applications (지원 카드)
| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | 기본키, 자동 생성 |
| user_id | uuid (FK → auth.users) | 소유자 |
| company_name | text | 회사명 |
| position | text | 지원 직무 |
| apply_date | date | 지원일 |
| job_post_url | text | 공고 링크 (nullable) |
| status | text | 지원함 / 서류중 / 면접중 / 최종합격 / 불합격 |
| created_at | timestamptz | 생성 시각 (기본값 now()) |

### stage_results (단계별 회고 기록)
| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | 기본키 |
| application_id | uuid (FK → applications) | 어떤 지원 건에 대한 회고인지 |
| stage | text | 서류 / 1차면접 / 2차면접 / 최종면접 |
| result | text | 합격 / 불합격 / 진행중 |
| reason_tags | text | 콤마로 구분된 태그 (예: "협업경험,지원동기") — JPA/배열 타입 복잡도를 피하기 위해 단순 문자열로 저장 |
| memo | text | AI가 요약한 회고 내용 |
| raw_text | text | 사용자가 입력한 원문 (재분석 대비 보관) |
| recorded_at | timestamptz | 기록 시각 (기본값 now()) |

### analysis_reports (AI 분석 리포트)
| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | 기본키 |
| user_id | uuid (FK → auth.users) | 리포트 소유자 |
| summary_text | text | AI가 생성한 리포트 본문 |
| stats_snapshot | jsonb | 리포트 생성 시점의 통계 스냅샷 (단계별 통과율, 태그 빈도 등) |
| generated_at | timestamptz | 생성 시각 (기본값 now()) |

---

## 3. Supabase SQL Editor에 그대로 실행할 SQL

```sql
-- applications 테이블
create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  company_name text not null,
  position text,
  apply_date date,
  job_post_url text,
  status text default '지원함',
  created_at timestamptz default now()
);

-- stage_results 테이블
create table stage_results (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  stage text,
  result text,
  reason_tags text,
  memo text,
  raw_text text,
  recorded_at timestamptz default now()
);

-- analysis_reports 테이블
create table analysis_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  summary_text text,
  stats_snapshot jsonb,
  generated_at timestamptz default now()
);

-- Row Level Security 활성화 (본인 데이터만 접근 가능하도록)
alter table applications enable row level security;
alter table stage_results enable row level security;
alter table analysis_reports enable row level security;

-- applications: 본인 데이터만 CRUD 가능
create policy "Users can manage own applications"
  on applications for all
  using (auth.uid() = user_id);

-- stage_results: 본인 소유 application에 속한 것만 접근 가능
create policy "Users can manage own stage_results"
  on stage_results for all
  using (
    application_id in (
      select id from applications where user_id = auth.uid()
    )
  );

-- analysis_reports: 본인 데이터만 접근 가능
create policy "Users can manage own analysis_reports"
  on analysis_reports for all
  using (auth.uid() = user_id);
```

> **Row Level Security(RLS) 관련 중요 참고**: Supabase는 기본적으로 RLS를 켜지 않으면 anon key로 모든 사용자의 데이터에 누구나 접근 가능해요. 위 정책(policy)을 반드시 함께 적용해야 "내 지원 카드는 나만 볼 수 있는" 구조가 완성됩니다.

---

## 4. 전체 서비스 플로우 (요약)

```
[로그인/회원가입] (Supabase Auth)
        ↓
[지원 카드 등록] → applications 테이블 저장
        ↓
[자연어 회고 입력] → Claude API 호출(구조화) → stage_results 테이블 저장
        ↓
[리포트 보기 요청] → stage_results 통계 계산(프론트) → Claude API 호출(해석) → analysis_reports 테이블 저장 및 화면 표시
```
