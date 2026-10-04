-- DoranDoran DDL (PostgreSQL)
-- Firebase Realtime DB -> RDB 전환 시 사용
-- 2026-03-21 기준 전체 스키마

-- ============================================
-- 1. 사용자 & 인증
-- ============================================

CREATE TABLE admins (
  uid           TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'instructor' CHECK (role IN ('instructor', 'staff', 'master')),
  approved      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. 세션 (강의 회차)
-- ============================================

CREATE TABLE sessions (
  id                TEXT PRIMARY KEY,
  course_name       TEXT,
  round_number      INTEGER,
  course_template_id TEXT,
  status            TEXT NOT NULL DEFAULT 'setting' CHECK (status IN ('setting', 'active', 'reviewing', 'ended')),
  current_question  TEXT,
  current_mode      TEXT DEFAULT 'poll',
  timer_end         BIGINT,
  timer_duration    INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  admin_uid         TEXT REFERENCES admins(uid)
);

-- ============================================
-- 3. 참여자 (학생)
-- ============================================

CREATE TABLE participants (
  id          TEXT NOT NULL,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  nickname    TEXT NOT NULL,
  online      BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, id)
);

-- ============================================
-- 4. 질문
-- ============================================

CREATE TABLE questions (
  id              TEXT NOT NULL,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('choice', 'ox', 'quiz', 'wordcloud', 'qna', 'scale', 'debate', 'ranking', 'fillinblank')),
  options         JSONB,           -- 선택지 배열
  correct_answer  TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  betting         BOOLEAN NOT NULL DEFAULT FALSE,
  points          INTEGER NOT NULL DEFAULT 100,
  event           JSONB,           -- 이벤트 부스터 설정
  revealed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, id)
);

-- ============================================
-- 5. 투표 (응답)
-- ============================================

CREATE TABLE votes (
  session_id    TEXT NOT NULL,
  question_id   TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  value         TEXT NOT NULL,
  confidence    TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  bet           INTEGER DEFAULT 1,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, question_id, participant_id),
  FOREIGN KEY (session_id, question_id) REFERENCES questions(session_id, id) ON DELETE CASCADE
);

-- ============================================
-- 6. 공개 채팅
-- ============================================

CREATE TABLE chat_messages (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('student', 'staff', 'instructor')),
  sender_id   TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_session ON chat_messages(session_id, timestamp);

-- ============================================
-- 7. 운영 채팅 (스태프 + 강사 전용)
-- ============================================

CREATE TABLE staff_chat_messages (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('staff', 'instructor')),
  sender_id   TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_chat_session ON staff_chat_messages(session_id, timestamp);

-- ============================================
-- 8. DM (1:1 도움 요청)
-- ============================================

CREATE TABLE dm_threads (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL,
  student_name TEXT NOT NULL,
  staff_id     TEXT,              -- NULL = 미배정 (대기 중)
  staff_name   TEXT,
  status       TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'resolved')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

CREATE INDEX idx_dm_session_status ON dm_threads(session_id, status);

CREATE TABLE dm_messages (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  thread_id  TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  sender_id  TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('student', 'staff', 'instructor')),
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dm_msg_thread ON dm_messages(thread_id, timestamp);

-- ============================================
-- 9. 긴급 질문
-- ============================================

CREATE TABLE urgent_questions (
  id          TEXT NOT NULL,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  reviewing   BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, id)
);

-- ============================================
-- 10. 수업 질문 (Q&A)
-- ============================================

CREATE TABLE class_questions (
  id              TEXT NOT NULL,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  nickname        TEXT NOT NULL DEFAULT '익명',
  participant_id  TEXT,
  answered        BOOLEAN NOT NULL DEFAULT FALSE,
  answered_by     TEXT,
  answered_by_role TEXT CHECK (answered_by_role IN ('instructor', 'staff')),
  upvotes         INTEGER NOT NULL DEFAULT 0,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, id)
);

-- ============================================
-- 11. 손들기
-- ============================================

CREATE TABLE hand_raises (
  session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  raised         BOOLEAN NOT NULL DEFAULT FALSE,
  nickname       TEXT,
  raised_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, participant_id)
);

-- ============================================
-- 12. 리액션
-- ============================================

CREATE TABLE reactions (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('thumbsUp', 'fire', 'heart', 'smile', 'party')),
  participant_id TEXT NOT NULL,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reactions_session ON reactions(session_id, timestamp);

-- ============================================
-- 13. 팀 대항전
-- ============================================

CREATE TABLE teams (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  team_name  TEXT NOT NULL,
  members    JSONB NOT NULL DEFAULT '[]',  -- participant_id 배열
  PRIMARY KEY (session_id, team_name)
);

-- ============================================
-- 14. 질문 보관함 (템플릿)
-- ============================================

CREATE TABLE question_library (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  admin_uid      TEXT NOT NULL REFERENCES admins(uid),
  title          TEXT NOT NULL,
  type           TEXT NOT NULL,
  options        JSONB,
  correct_answer TEXT,
  tags           JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_library_admin ON question_library(admin_uid);

-- ============================================
-- 15. 강의 템플릿
-- ============================================

CREATE TABLE course_templates (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  admin_uid   TEXT NOT NULL REFERENCES admins(uid),
  course_name TEXT NOT NULL,
  questions   JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_course_templates_admin ON course_templates(admin_uid);
