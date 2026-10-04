/**
 * Demo data seed script for DoranDoran
 * Run: node --env-file=.env scripts/seed-demo.mjs
 *
 * Creates 5+ classes with various rounds, statuses, questions, participants, and votes.
 * All questions include correctAnswer.
 * Active sessions include chat, hand raises, urgent questions, and quiz scores.
 */

const DB_URL = process.env.VITE_FIREBASE_DATABASE_URL;
if (!DB_URL) {
  console.error('VITE_FIREBASE_DATABASE_URL 누락 — `node --env-file=.env scripts/seed-demo.mjs` 형태로 실행하세요. (.env.example 참고)');
  process.exit(1);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function sid() { return `s_${uid()}`; }
function qid() { return `q_${uid()}`; }
function pid() { return `p_${uid()}`; }

const NICKNAMES = [
  '서연', '도윤', '하윤', '민준', '예준', '지우', '시우', '하준', '서윤',
  '주원', '지아', '지유', '채원', '현우', '수아', '건우', '소윤', '지호',
  '은서', '시현', '윤서', '태윤', '다은', '성민', '유나', '재민', '수빈',
  '준서', '하영', '동현', '민서', '지원', '승우', '나윤', '태현', '예은',
];

function pickNames(count) {
  const shuffled = [...NICKNAMES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function makeParticipants(names) {
  const participants = {};
  const ids = [];
  for (const name of names) {
    const id = pid();
    ids.push(id);
    participants[id] = {
      nickname: name,
      joinedAt: Date.now() - Math.floor(Math.random() * 3600000),
      online: Math.random() > 0.3,
    };
  }
  return { participants, ids };
}

function makeVotes(participantIds, participants, options, voteRatio = 0.8) {
  const votes = {};
  const votingIds = participantIds.filter(() => Math.random() < voteRatio);
  for (const id of votingIds) {
    const value = options[Math.floor(Math.random() * options.length)];
    votes[id] = { value, nickname: participants[id].nickname };
  }
  return votes;
}

function makeWeightedVotes(participantIds, participants, options, weights, voteRatio = 0.85) {
  const votes = {};
  const votingIds = participantIds.filter(() => Math.random() < voteRatio);
  const cumulative = [];
  let sum = 0;
  for (const w of weights) { sum += w; cumulative.push(sum); }
  for (const id of votingIds) {
    const r = Math.random() * sum;
    const idx = cumulative.findIndex((c) => r < c);
    votes[id] = { value: options[idx], nickname: participants[id].nickname };
  }
  return votes;
}

function makeQuizVotesWithTimestamp(participantIds, participants, options, weights, activatedAt, betting = false) {
  const votes = {};
  const votingIds = participantIds.filter(() => Math.random() < 0.85);
  const cumulative = [];
  let sum = 0;
  for (const w of weights) { sum += w; cumulative.push(sum); }
  for (const id of votingIds) {
    const r = Math.random() * sum;
    const idx = cumulative.findIndex((c) => r < c);
    const vote = {
      value: options[idx],
      nickname: participants[id].nickname,
      timestamp: activatedAt + Math.floor(Math.random() * 25000),
    };
    if (betting) {
      // Distribute bets: ~40% 1x, ~35% 2x, ~25% 3x
      const br = Math.random();
      vote.bet = br < 0.4 ? '1' : br < 0.75 ? '2' : '3';
    }
    votes[id] = vote;
  }
  return votes;
}

/**
 * Generate scale votes (0-100 numeric values stored as strings).
 * Uses a normal-ish distribution around a center value.
 */
function makeScaleVotes(participantIds, participants, center = 60, spread = 25, voteRatio = 0.85) {
  const votes = {};
  const votingIds = participantIds.filter(() => Math.random() < voteRatio);
  for (const id of votingIds) {
    // Box-Muller normal distribution, clamped to 0-100
    const u1 = Math.random() || 0.001;
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const raw = center + z * spread;
    const value = Math.max(0, Math.min(100, Math.round(raw)));
    votes[id] = { value: String(value), nickname: participants[id].nickname };
  }
  return votes;
}

/**
 * Generate debate votes. Value format: "for:opinion" or "against:opinion".
 * forRatio controls the split (0.6 = 60% for).
 */
const DEBATE_OPINIONS_FOR = [
  '미래 경쟁력을 위해 필수',
  '효율성이 크게 향상됨',
  '이미 대세가 되고 있음',
  '비용 절감 효과가 큼',
  '학습 곡선이 낮아졌음',
  '창의적 활용이 무궁무진',
  '생산성이 확실히 높아짐',
  '거부할 수 없는 흐름',
];
const DEBATE_OPINIONS_AGAINST = [
  '아직 신뢰성이 부족함',
  '기존 방식이 더 안정적',
  '보안 우려가 있음',
  '과도한 의존이 위험',
  '인간의 판단이 더 중요',
  '비용 대비 효과 불분명',
  '윤리적 문제가 해결 안 됨',
  '기술 격차가 심화될 수 있음',
];

function makeDebateVotes(participantIds, participants, forRatio = 0.6, voteRatio = 0.85) {
  const votes = {};
  const votingIds = participantIds.filter(() => Math.random() < voteRatio);
  const forOps = [...DEBATE_OPINIONS_FOR].sort(() => Math.random() - 0.5);
  const againstOps = [...DEBATE_OPINIONS_AGAINST].sort(() => Math.random() - 0.5);
  let fi = 0, ai = 0;

  for (const id of votingIds) {
    const isFor = Math.random() < forRatio;
    const side = isFor ? 'for' : 'against';
    // 70% chance of including an opinion
    let opinion = '';
    if (Math.random() < 0.7) {
      if (isFor) {
        opinion = forOps[fi % forOps.length];
        fi++;
      } else {
        opinion = againstOps[ai % againstOps.length];
        ai++;
      }
    }
    votes[id] = { value: `${side}:${opinion}`, nickname: participants[id].nickname };
  }
  return votes;
}

/**
 * Generate ranking votes. Value format: comma-separated item indices (e.g. "2,0,3,1").
 * Items are stored in correct order (0,1,2,...), so correct answer is "0,1,2,...".
 * Students' answers are shuffled from correct with varying accuracy.
 */
function makeRankingVotes(participantIds, participants, itemCount, voteRatio = 0.85) {
  const votes = {};
  const votingIds = participantIds.filter(() => Math.random() < voteRatio);
  const correct = Array.from({ length: itemCount }, (_, i) => i);

  for (const id of votingIds) {
    // Each student gets a partially shuffled version
    const answer = [...correct];
    // Apply 1-3 random swaps to create varying accuracy
    const swapCount = Math.floor(Math.random() * 3);
    for (let s = 0; s < swapCount; s++) {
      const a = Math.floor(Math.random() * itemCount);
      const b = Math.floor(Math.random() * itemCount);
      [answer[a], answer[b]] = [answer[b], answer[a]];
    }
    votes[id] = { value: answer.join(','), nickname: participants[id].nickname };
  }
  return votes;
}

/**
 * Generate fill-in-blank votes. Students type text answers.
 * correctAnswer is what goes in the blank; some students get it right, some don't.
 */
const FILLINBLANK_WRONG_ANSWERS = [
  // Generic wrong answers for technical questions
  'null', 'undefined', 'error', '모르겠어요', '?', 'pass',
];

function makeFillBlankVotes(participantIds, participants, correctAnswer, correctRatio = 0.6, voteRatio = 0.85) {
  const votes = {};
  const votingIds = participantIds.filter(() => Math.random() < voteRatio);
  const wrongAnswers = [...FILLINBLANK_WRONG_ANSWERS].sort(() => Math.random() - 0.5);
  let wi = 0;

  for (const id of votingIds) {
    const isCorrect = Math.random() < correctRatio;
    let value;
    if (isCorrect) {
      // Some correct answers have slight variations in casing
      value = Math.random() < 0.7 ? correctAnswer : correctAnswer.toLowerCase();
    } else {
      value = wrongAnswers[wi % wrongAnswers.length];
      wi++;
    }
    votes[id] = { value, nickname: participants[id].nickname };
  }
  return votes;
}

// ─── INTERACTION GENERATORS ───────────────────────────

function mid() { return `m_${uid()}`; }

const CHAT_MESSAGES = [
  // Student messages
  { text: '교수님 질문 있습니다!', senderType: 'student' },
  { text: '이 부분 다시 설명해주실 수 있나요?', senderType: 'student' },
  { text: '감사합니다 이해했어요', senderType: 'student' },
  { text: '혹시 자료 공유해주실 수 있나요?', senderType: 'student' },
  { text: '오 신기하다', senderType: 'student' },
  { text: '저도 같은 생각이에요', senderType: 'student' },
  { text: '너무 재밌어요 이 수업', senderType: 'student' },
  { text: '다음 시간에도 이런 활동 하면 좋겠어요', senderType: 'student' },
  { text: '이거 시험에 나오나요?', senderType: 'student' },
  { text: '과제 마감이 언제까지인가요?', senderType: 'student' },
  { text: '실습 환경 세팅이 잘 안 돼요', senderType: 'student' },
  { text: '와 진짜 신기하네요', senderType: 'student' },
  // Instructor messages
  { text: '좋은 질문이에요! 잠시 후 설명하겠습니다', senderType: 'instructor' },
  { text: '네, 수업 후 자료 올려드릴게요', senderType: 'instructor' },
  { text: '다음 질문으로 넘어갈게요', senderType: 'instructor' },
  { text: '자, 투표 시작할게요. 준비되셨나요?', senderType: 'instructor' },
  { text: '잘하고 있어요! 계속 참여해주세요', senderType: 'instructor' },
  { text: '이 부분은 중요하니까 잘 봐주세요', senderType: 'instructor' },
];

const URGENT_QUESTIONS = [
  '교수님, 지금 화면 안 보여요',
  '이 개념이 실무에서 어떻게 쓰이는지 궁금합니다',
  '앞에서 설명하신 예시 코드 다시 보여주실 수 있나요?',
  '용어가 헷갈리는데 차이점을 알려주세요',
  '과제 제출 방법을 모르겠어요',
  '이 부분 좀 더 천천히 설명해주세요',
  '실습 파일 링크가 안 열려요',
];

/**
 * Generate chat messages for an active session.
 * Mixes student and instructor messages with realistic timestamps.
 */
function makeChat(participantIds, participants, sessionStart, messageCount = 8) {
  const chat = {};
  const shuffled = [...CHAT_MESSAGES].sort(() => Math.random() - 0.5);
  const count = Math.min(messageCount, shuffled.length);
  const timeSpan = Date.now() - sessionStart;

  for (let i = 0; i < count; i++) {
    const msg = shuffled[i];
    const id = mid();
    const ts = sessionStart + Math.floor((timeSpan * (i + 1)) / (count + 1));
    if (msg.senderType === 'student') {
      const pIdx = Math.floor(Math.random() * participantIds.length);
      const pId = participantIds[pIdx];
      chat[id] = {
        text: msg.text,
        sender: participants[pId].nickname,
        senderType: 'student',
        timestamp: ts,
      };
    } else {
      chat[id] = {
        text: msg.text,
        sender: '강사',
        senderType: 'instructor',
        timestamp: ts,
      };
    }
  }
  return chat;
}

/**
 * Generate hand raises for some participants in an active session.
 * 2-4 students have their hands raised.
 */
function makeHandRaises(participantIds, participants, sessionStart) {
  const handRaises = {};
  const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
  const raiseCount = 2 + Math.floor(Math.random() * 3); // 2-4
  const timeSpan = Date.now() - sessionStart;

  for (let i = 0; i < Math.min(raiseCount, shuffled.length); i++) {
    const pId = shuffled[i];
    handRaises[pId] = {
      nickname: participants[pId].nickname,
      raised: true,
      raisedAt: sessionStart + Math.floor(timeSpan * (0.5 + Math.random() * 0.5)),
    };
  }
  return handRaises;
}

/**
 * Generate urgent questions from anonymous students.
 * 2-4 questions, some read, some unread.
 */
function makeUrgentQuestions(sessionStart, questionCount = 3) {
  const urgentQuestions = {};
  const shuffled = [...URGENT_QUESTIONS].sort(() => Math.random() - 0.5);
  const count = Math.min(questionCount, shuffled.length);
  const timeSpan = Date.now() - sessionStart;

  for (let i = 0; i < count; i++) {
    const id = `uq_${uid()}`;
    urgentQuestions[id] = {
      text: shuffled[i],
      timestamp: sessionStart + Math.floor((timeSpan * (i + 1)) / (count + 1)),
      read: i < Math.floor(count / 2), // older ones are read
      reviewing: false,
    };
  }
  return urgentQuestions;
}

/**
 * Generate class questions (persistent Q&A board).
 * Named questions with upvotes, some answered.
 */
const CLASS_QUESTIONS = [
  '이 부분 시험 범위에 포함되나요?',
  '실습 코드 GitHub에 올려주시나요?',
  '다음 주 수업 내용이 궁금합니다',
  '과제 제출 형식이 어떻게 되나요?',
  '이 개념을 실무에서는 어떻게 활용하나요?',
  '참고 자료 추천해주실 수 있나요?',
  '중간고사 범위가 여기까지인가요?',
  '팀 프로젝트 주제 선정 기준이 있나요?',
];

function makeClassQuestions(participantIds, participants, sessionStart, questionCount = 4) {
  const classQuestions = {};
  const shuffled = [...CLASS_QUESTIONS].sort(() => Math.random() - 0.5);
  const count = Math.min(questionCount, shuffled.length);
  const timeSpan = Date.now() - sessionStart;

  for (let i = 0; i < count; i++) {
    const id = `cq_${uid()}`;
    const authorIdx = Math.floor(Math.random() * participantIds.length);
    const authorId = participantIds[authorIdx];

    // Build random upvotes (0-6 students)
    const upvoteCount = Math.floor(Math.random() * 7);
    const upvoters = [...participantIds].sort(() => Math.random() - 0.5).slice(0, upvoteCount);
    const upvotes = {};
    upvoters.forEach((pid) => { upvotes[pid] = true; });

    classQuestions[id] = {
      text: shuffled[i],
      nickname: participants[authorId].nickname,
      participantId: authorId,
      timestamp: sessionStart + Math.floor((timeSpan * (i + 1)) / (count + 1)),
      answered: i === 0, // first one is answered
      ...(Object.keys(upvotes).length > 0 ? { upvotes } : {}),
    };
  }
  return classQuestions;
}

/**
 * Generate quiz scores for participants based on their quiz votes.
 * Calculates realistic scores from quiz question results.
 */
function makeScores(participantIds, participants, questions) {
  const scores = {};
  const quizQuestions = Object.values(questions).filter((q) => q.type === 'quiz' && q.votes && q.correctAnswer);

  if (quizQuestions.length === 0) return scores;

  for (const pId of participantIds) {
    let total = 0;
    let tickets = 0;

    for (const q of quizQuestions) {
      const vote = q.votes?.[pId];
      if (!vote) continue;

      // Participation ticket
      tickets += q.participationTickets || 1;

      // Bet multiplier
      const betMul = q.betting ? (parseInt(vote.bet, 10) || 1) : 1;
      const betPenalty = betMul === 3 ? 60 : betMul === 2 ? 30 : 0;

      // Base points for correct answer
      if (vote.value === q.correctAnswer) {
        let pts = q.points || 100;
        // Speed bonus
        if (vote.timestamp && q.activatedAt) {
          const elapsed = vote.timestamp - q.activatedAt;
          const window = q.speedWindowMs || 30000;
          const maxBonus = q.maxSpeedBonus || 50;
          if (elapsed < window) {
            pts += Math.round(maxBonus * (1 - elapsed / window));
          }
        }
        total += pts * betMul;
        tickets += q.correctBonusTickets || 2;
      } else if (q.betting && betPenalty > 0) {
        total = Math.max(0, total - betPenalty);
      }
    }

    if (total > 0 || tickets > 0) {
      scores[pId] = {
        nickname: participants[pId].nickname,
        total,
        tickets,
      };
    }
  }
  return scores;
}

// ─── CLASSES ───────────────────────────────────────────

const now = Date.now();
const DAY = 86400000;
const HOUR = 3600000;

const sessions = {};

// ═══════════════════════════════════════════════════════
// CLASS 1: 바이브 코딩 기초편 (3 rounds: ended, ended, active)
// ═══════════════════════════════════════════════════════
{
  // Round 1 — ended
  const names1 = pickNames(12);
  const { participants: p1, ids: ids1 } = makeParticipants(names1);
  const q1a = qid(), q1b = qid(), q1c = qid(), q1d = qid();
  const s1 = sid();
  const t1 = now - 7 * DAY;
  const s1r1Questions = {
    [q1a]: {
      type: 'choice', title: '가장 자주 사용하는 프로그래밍 언어는?', order: 1,
      options: ['Python', 'JavaScript', 'Java', 'Go'],
      correctAnswer: 'Python',
      votes: makeWeightedVotes(ids1, p1, ['Python', 'JavaScript', 'Java', 'Go'], [5, 3, 1, 1]),
    },
    [q1b]: {
      type: 'quiz', title: 'HTTP 상태코드 404의 의미는?', order: 2,
      options: ['서버 오류', '페이지 없음', '권한 없음', '리다이렉트'],
      correctAnswer: '페이지 없음',
      points: 100, participationTickets: 1, correctBonusTickets: 2,
      speedWindowMs: 30000, maxSpeedBonus: 50,
      activatedAt: t1 + HOUR, revealedAt: t1 + HOUR + 35000, awardedAt: t1 + HOUR + 35000,
      votes: makeQuizVotesWithTimestamp(ids1, p1, ['서버 오류', '페이지 없음', '권한 없음', '리다이렉트'], [1, 6, 2, 1], t1 + HOUR),
    },
    [q1c]: {
      type: 'ox', title: 'JavaScript는 인터프리터 언어이다', order: 3,
      correctAnswer: 'O',
      votes: makeWeightedVotes(ids1, p1, ['O', 'X'], [8, 2]),
    },
    [q1d]: {
      type: 'wordcloud', title: '코딩할 때 가장 중요한 것은?', order: 4,
      votes: makeVotes(ids1, p1, ['가독성', '성능', '유지보수', '테스트', '설계', '협업', '문서화', '가독성', '설계']),
    },
  };
  sessions[s1] = {
    status: 'ended', currentQuestion: q1a, currentMode: 'poll',
    createdAt: t1, courseName: '바이브 코딩 기초편', roundNumber: 1,
    participants: p1,
    questions: s1r1Questions,
    scores: makeScores(ids1, p1, s1r1Questions),
  };

  // Round 2 — ended
  const names2 = pickNames(15);
  const { participants: p2, ids: ids2 } = makeParticipants(names2);
  const q2a = qid(), q2b = qid(), q2c = qid(), q2d = qid();
  const s2 = sid();
  const t2 = now - 4 * DAY;
  sessions[s2] = {
    status: 'ended', currentQuestion: q2a, currentMode: 'poll',
    createdAt: t2, courseName: '바이브 코딩 기초편', roundNumber: 2,
    participants: p2,
    questions: {
      [q2a]: {
        type: 'choice', title: 'AI 도구 중 가장 많이 사용하는 것은?', order: 1,
        options: ['ChatGPT', 'Claude', 'Gemini', 'Copilot'],
        correctAnswer: 'Claude',
        votes: makeWeightedVotes(ids2, p2, ['ChatGPT', 'Claude', 'Gemini', 'Copilot'], [3, 6, 2, 2]),
      },
      [q2b]: {
        type: 'quiz', title: 'LLM의 약자는?', order: 2,
        options: ['Large Language Model', 'Long Learning Machine', 'Linear Logic Module'],
        correctAnswer: 'Large Language Model',
        points: 100, participationTickets: 1, correctBonusTickets: 2,
        speedWindowMs: 30000, maxSpeedBonus: 50,
        activatedAt: t2 + HOUR, revealedAt: t2 + HOUR + 40000, awardedAt: t2 + HOUR + 40000,
        votes: makeQuizVotesWithTimestamp(ids2, p2, ['Large Language Model', 'Long Learning Machine', 'Linear Logic Module'], [7, 2, 3], t2 + HOUR),
      },
      [q2c]: {
        type: 'ox', title: 'Python은 컴파일 언어이다', order: 3,
        correctAnswer: 'X',
        votes: makeWeightedVotes(ids2, p2, ['O', 'X'], [3, 9]),
      },
      [q2d]: {
        type: 'qna', title: '수업에서 궁금한 점이 있나요?', order: 4,
        votes: {},
      },
    },
  };

  // Round 3 — active (진행 중)
  const names3 = pickNames(18);
  const { participants: p3, ids: ids3 } = makeParticipants(names3);
  const q3a = qid(), q3b = qid(), q3c = qid(), q3d = qid(), q3e = qid();
  const s3 = sid();
  const t3 = now - 2 * HOUR;
  const q3f = qid(), q3g = qid(), q3h = qid(), q3i = qid();
  const s3Questions = {
    [q3a]: {
      type: 'choice', title: '오늘 수업 난이도는 어땠나요?', order: 1,
      options: ['쉬웠다', '적당했다', '어려웠다', '매우 어려웠다'],
      correctAnswer: '적당했다',
      votes: makeWeightedVotes(ids3, p3, ['쉬웠다', '적당했다', '어려웠다', '매우 어려웠다'], [2, 8, 4, 1]),
    },
    [q3b]: {
      type: 'quiz', title: 'REST API에서 데이터를 생성할 때 사용하는 HTTP 메서드는?', order: 2,
      options: ['GET', 'POST', 'PUT', 'DELETE'],
      correctAnswer: 'POST',
      points: 100, participationTickets: 1, correctBonusTickets: 2,
      speedWindowMs: 30000, maxSpeedBonus: 50,
      activatedAt: t3 + 1800000,
      votes: makeQuizVotesWithTimestamp(ids3, p3, ['GET', 'POST', 'PUT', 'DELETE'], [1, 8, 3, 1], t3 + 1800000),
    },
    [q3c]: {
      type: 'ox', title: 'CSS Flexbox에서 기본 방향은 row이다', order: 3,
      correctAnswer: 'O',
      votes: makeWeightedVotes(ids3, p3, ['O', 'X'], [10, 3]),
    },
    [q3d]: {
      type: 'scale', title: 'AI 도구 활용 능력에 대한 자신감은?', order: 4,
      votes: makeScaleVotes(ids3, p3, 62, 20),
    },
    [q3e]: {
      type: 'debate', title: 'AI가 프로그래머를 대체할 수 있을까?', order: 5,
      votes: makeDebateVotes(ids3, p3, 0.45),
    },
    [q3f]: {
      type: 'quiz', title: 'Git에서 작업 내용을 임시 저장하는 명령어는?', order: 6,
      options: ['git save', 'git stash', 'git store', 'git cache'],
      correctAnswer: 'git stash',
      points: 100, participationTickets: 1, correctBonusTickets: 2,
      speedWindowMs: 30000, maxSpeedBonus: 50,
      betting: true,
      activatedAt: t3 + 2 * HOUR, revealedAt: t3 + 2 * HOUR + 32000, awardedAt: t3 + 2 * HOUR + 32000,
      votes: makeQuizVotesWithTimestamp(ids3, p3, ['git save', 'git stash', 'git store', 'git cache'], [2, 8, 3, 1], t3 + 2 * HOUR, true),
    },
    [q3g]: {
      type: 'quiz', title: 'JavaScript에서 비동기 처리에 사용하는 키워드는?', order: 7,
      options: ['wait', 'async/await', 'defer', 'delay'],
      correctAnswer: 'async/await',
      points: 100, participationTickets: 1, correctBonusTickets: 2,
      speedWindowMs: 30000, maxSpeedBonus: 50,
      betting: true,
    },
    [q3h]: {
      type: 'ranking', title: '웹 개발 프로세스를 올바른 순서로 정렬하세요', order: 8,
      options: ['요구사항 분석', '와이어프레임 설계', '프론트엔드 개발', '백엔드 API 구현', '테스트 및 배포'],
      correctAnswer: '0,1,2,3,4',
      votes: makeRankingVotes(ids3, p3, 5),
    },
    [q3i]: {
      type: 'fillinblank', title: 'HTTP 상태코드 ___는 서버 내부 오류를 의미한다', order: 9,
      correctAnswer: '500',
      votes: makeFillBlankVotes(ids3, p3, '500', 0.55),
    },
  };
  sessions[s3] = {
    status: 'active', currentQuestion: q3a, currentMode: 'poll',
    createdAt: t3, startedAt: t3 + 10 * 60000, courseName: '바이브 코딩 기초편', roundNumber: 3,
    participants: p3,
    questions: s3Questions,
    chat: makeChat(ids3, p3, t3 + 10 * 60000, 6),
    handRaises: makeHandRaises(ids3, p3, t3 + 10 * 60000),
    urgentQuestions: makeUrgentQuestions(t3 + 10 * 60000, 2),
    classQuestions: makeClassQuestions(ids3, p3, t3 + 10 * 60000, 5),
    scores: makeScores(ids3, p3, s3Questions),
    teamBattle: makeTeamBattle(ids3, 3),
  };
}

// ═══════════════════════════════════════════════════════
// CLASS 2: 바이브 코딩 중급편 (2 rounds: ended, active)
// ═══════════════════════════════════════════════════════
{
  const names1 = pickNames(20);
  const { participants: p1, ids: ids1 } = makeParticipants(names1);
  const q1a = qid(), q1b = qid(), q1c = qid(), q1d = qid();
  const s1 = sid();
  const t1 = now - 5 * DAY;
  const s1AdvQuestions = {
    [q1a]: {
      type: 'choice', title: '선호하는 상태관리 라이브러리는?', order: 1,
      options: ['Redux', 'Zustand', 'Recoil', 'Jotai', 'Context API'],
      correctAnswer: 'Zustand',
      votes: makeWeightedVotes(ids1, p1, ['Redux', 'Zustand', 'Recoil', 'Jotai', 'Context API'], [3, 7, 2, 4, 3]),
    },
    [q1b]: {
      type: 'quiz', title: 'React에서 side effect를 처리하는 훅은?', order: 2,
      options: ['useState', 'useEffect', 'useMemo', 'useRef'],
      correctAnswer: 'useEffect',
      points: 100, participationTickets: 1, correctBonusTickets: 2,
      speedWindowMs: 30000, maxSpeedBonus: 50,
      activatedAt: t1 + HOUR, revealedAt: t1 + HOUR + 30000, awardedAt: t1 + HOUR + 30000,
      votes: makeQuizVotesWithTimestamp(ids1, p1, ['useState', 'useEffect', 'useMemo', 'useRef'], [1, 12, 3, 2], t1 + HOUR),
    },
    [q1c]: {
      type: 'ox', title: 'useEffect의 빈 의존성 배열은 마운트 시 1회만 실행된다', order: 3,
      correctAnswer: 'O',
      votes: makeWeightedVotes(ids1, p1, ['O', 'X'], [14, 4]),
    },
    [q1d]: {
      type: 'wordcloud', title: 'React에서 가장 어려운 개념은?', order: 4,
      votes: makeVotes(ids1, p1, ['상태관리', 'useEffect', '렌더링', '라이프사이클', '비동기', 'Hooks', '상태관리', 'useEffect', '렌더링']),
    },
  };
  sessions[s1] = {
    status: 'ended', currentQuestion: q1a, currentMode: 'poll',
    createdAt: t1, courseName: '바이브 코딩 중급편', roundNumber: 1,
    participants: p1,
    questions: s1AdvQuestions,
    scores: makeScores(ids1, p1, s1AdvQuestions),
  };

  // Round 2 — active
  const names2 = pickNames(16);
  const { participants: p2, ids: ids2 } = makeParticipants(names2);
  const q2a = qid(), q2b = qid(), q2c = qid(), q2d = qid();
  const s2 = sid();
  const t2 = now - 3 * HOUR;
  const s2Questions = {
    [q2a]: {
      type: 'choice', title: '가장 좋아하는 CSS 프레임워크는?', order: 1,
      options: ['Tailwind CSS', 'Bootstrap', 'styled-components', 'Vanilla CSS'],
      correctAnswer: 'Tailwind CSS',
      votes: makeWeightedVotes(ids2, p2, ['Tailwind CSS', 'Bootstrap', 'styled-components', 'Vanilla CSS'], [8, 2, 3, 2]),
    },
    [q2b]: {
      type: 'quiz', title: 'Tailwind CSS에서 flex 컨테이너를 만드는 클래스는?', order: 2,
      options: ['display-flex', 'flex', 'd-flex', 'flexbox'],
      correctAnswer: 'flex',
      points: 100, participationTickets: 1, correctBonusTickets: 2,
      speedWindowMs: 30000, maxSpeedBonus: 50,
      activatedAt: t2 + HOUR,
      votes: makeQuizVotesWithTimestamp(ids2, p2, ['display-flex', 'flex', 'd-flex', 'flexbox'], [1, 10, 2, 1], t2 + HOUR),
    },
    [q2c]: {
      type: 'ox', title: 'Tailwind CSS는 utility-first 프레임워크이다', order: 3,
      correctAnswer: 'O',
    },
    [q2d]: {
      type: 'wordcloud', title: 'Tailwind의 장점 하나만 말해주세요', order: 4,
    },
  };
  sessions[s2] = {
    status: 'active', currentQuestion: q2b, currentMode: 'quiz',
    createdAt: t2, startedAt: t2 + 15 * 60000, courseName: '바이브 코딩 중급편', roundNumber: 2,
    participants: p2,
    questions: s2Questions,
    chat: makeChat(ids2, p2, t2 + 15 * 60000, 10),
    handRaises: makeHandRaises(ids2, p2, t2 + 15 * 60000),
    urgentQuestions: makeUrgentQuestions(t2 + 15 * 60000, 4),
    classQuestions: makeClassQuestions(ids2, p2, t2 + 15 * 60000, 3),
    scores: makeScores(ids2, p2, s2Questions),
  };
}

// ═══════════════════════════════════════════════════════
// CLASS 3: AI 프롬프트 엔지니어링 (2 rounds: ended, setting)
// ═══════════════════════════════════════════════════════
{
  const names1 = pickNames(22);
  const { participants: p1, ids: ids1 } = makeParticipants(names1);
  const q1a = qid(), q1b = qid(), q1c = qid(), q1d = qid(), q1e = qid();
  const s1 = sid();
  const t1 = now - 10 * DAY;
  const s1AiQuestions = {
    [q1a]: {
      type: 'choice', title: '프롬프트 작성 시 가장 중요한 요소는?', order: 1,
      options: ['명확한 지시', '예시 제공', '역할 지정', '출력 형식 지정'],
      correctAnswer: '명확한 지시',
      votes: makeWeightedVotes(ids1, p1, ['명확한 지시', '예시 제공', '역할 지정', '출력 형식 지정'], [8, 4, 5, 3]),
    },
    [q1b]: {
      type: 'quiz', title: 'Few-shot 프롬프팅에서 "shot"의 의미는?', order: 2,
      options: ['시도 횟수', '예시 개수', '모델 크기', '토큰 수'],
      correctAnswer: '예시 개수',
      points: 100, participationTickets: 1, correctBonusTickets: 2,
      speedWindowMs: 30000, maxSpeedBonus: 50,
      activatedAt: t1 + HOUR, revealedAt: t1 + HOUR + 32000, awardedAt: t1 + HOUR + 32000,
      votes: makeQuizVotesWithTimestamp(ids1, p1, ['시도 횟수', '예시 개수', '모델 크기', '토큰 수'], [3, 10, 4, 2], t1 + HOUR),
    },
    [q1c]: {
      type: 'ox', title: 'Chain of Thought 프롬프팅은 추론 능력을 향상시킨다', order: 3,
      correctAnswer: 'O',
      votes: makeWeightedVotes(ids1, p1, ['O', 'X'], [16, 4]),
    },
    [q1d]: {
      type: 'quiz', title: 'Temperature 값이 0에 가까우면 출력은?', order: 4,
      options: ['더 창의적', '더 결정적', '더 긴 출력', '더 짧은 출력'],
      correctAnswer: '더 결정적',
      points: 100, participationTickets: 1, correctBonusTickets: 2,
      speedWindowMs: 30000, maxSpeedBonus: 50,
      activatedAt: t1 + 2 * HOUR, revealedAt: t1 + 2 * HOUR + 28000, awardedAt: t1 + 2 * HOUR + 28000,
      votes: makeQuizVotesWithTimestamp(ids1, p1, ['더 창의적', '더 결정적', '더 긴 출력', '더 짧은 출력'], [4, 12, 2, 1], t1 + 2 * HOUR),
    },
    [q1e]: {
      type: 'wordcloud', title: 'AI 시대에 가장 중요한 역량은?', order: 5,
      votes: makeVotes(ids1, p1, ['비판적 사고', '창의성', '소통', '프롬프팅', '데이터 분석', '적응력', '비판적 사고', '창의성']),
    },
  };
  sessions[s1] = {
    status: 'reviewing', currentQuestion: q1a, currentMode: 'poll',
    createdAt: t1, courseName: 'AI 프롬프트 엔지니어링', roundNumber: 1,
    reviewingUntil: now + 10 * DAY,
    participants: p1,
    questions: s1AiQuestions,
    scores: makeScores(ids1, p1, s1AiQuestions),
    chat: makeChat(ids1, p1, t1 + HOUR, 4),
    urgentQuestions: makeUrgentQuestions(t1 + HOUR, 2),
    classQuestions: makeClassQuestions(ids1, p1, t1 + HOUR, 3),
  };

  // Round 2 — setting
  const s2 = sid();
  sessions[s2] = {
    status: 'setting', currentQuestion: null, currentMode: 'waiting',
    createdAt: now - 1 * DAY, courseName: 'AI 프롬프트 엔지니어링', roundNumber: 2,
    questions: {
      [qid()]: {
        type: 'choice', title: '가장 효과적인 프롬프트 기법은?', order: 1,
        options: ['Zero-shot', 'Few-shot', 'Chain of Thought', 'Tree of Thought'],
        correctAnswer: 'Chain of Thought',
      },
      [qid()]: {
        type: 'quiz', title: 'System 프롬프트의 주요 목적은?', order: 2,
        options: ['속도 향상', '모델의 역할/행동 정의', '토큰 절약', '비용 절감'],
        correctAnswer: '모델의 역할/행동 정의',
        points: 100, participationTickets: 1, correctBonusTickets: 2,
        speedWindowMs: 30000, maxSpeedBonus: 50,
      },
      [qid()]: {
        type: 'ox', title: 'Hallucination은 AI가 사실이 아닌 내용을 생성하는 현상이다', order: 3,
        correctAnswer: 'O',
      },
    },
  };
}

// ═══════════════════════════════════════════════════════
// CLASS 4: 데이터 분석 입문 (4 rounds: ended x3, setting x1)
// ═══════════════════════════════════════════════════════
{
  // Round 1 — ended
  const names1 = pickNames(14);
  const { participants: p1, ids: ids1 } = makeParticipants(names1);
  const s1 = sid();
  const t1 = now - 14 * DAY;
  sessions[s1] = {
    status: 'ended', currentQuestion: null, currentMode: 'waiting',
    createdAt: t1, courseName: '데이터 분석 입문', roundNumber: 1,
    participants: p1,
    questions: {
      [qid()]: {
        type: 'choice', title: '데이터 분석에 가장 많이 사용하는 도구는?', order: 1,
        options: ['Excel', 'Python', 'R', 'SQL'],
        correctAnswer: 'Python',
        votes: makeWeightedVotes(ids1, p1, ['Excel', 'Python', 'R', 'SQL'], [4, 5, 1, 3]),
      },
      [qid()]: {
        type: 'ox', title: '평균은 이상치(Outlier)에 민감하다', order: 2,
        correctAnswer: 'O',
        votes: makeWeightedVotes(ids1, p1, ['O', 'X'], [10, 3]),
      },
      [qid()]: {
        type: 'quiz', title: '상관관계와 인과관계의 차이를 나타내는 표현은?', order: 3,
        options: ['Correlation implies causation', 'Correlation does not imply causation', 'Causation requires correlation'],
        correctAnswer: 'Correlation does not imply causation',
        points: 100, participationTickets: 1, correctBonusTickets: 2,
        speedWindowMs: 30000, maxSpeedBonus: 50,
        activatedAt: t1 + HOUR, revealedAt: t1 + HOUR + 35000, awardedAt: t1 + HOUR + 35000,
        votes: makeQuizVotesWithTimestamp(ids1, p1, ['Correlation implies causation', 'Correlation does not imply causation', 'Causation requires correlation'], [2, 8, 3], t1 + HOUR),
      },
    },
  };

  // Round 2 — ended
  const names2 = pickNames(16);
  const { participants: p2, ids: ids2 } = makeParticipants(names2);
  const s2 = sid();
  const t2 = now - 9 * DAY;
  sessions[s2] = {
    status: 'ended', currentQuestion: null, currentMode: 'waiting',
    createdAt: t2, courseName: '데이터 분석 입문', roundNumber: 2,
    participants: p2,
    questions: {
      [qid()]: {
        type: 'choice', title: '데이터 시각화에 가장 적합한 라이브러리는?', order: 1,
        options: ['Matplotlib', 'Seaborn', 'Plotly', 'D3.js'],
        correctAnswer: 'Plotly',
        votes: makeWeightedVotes(ids2, p2, ['Matplotlib', 'Seaborn', 'Plotly', 'D3.js'], [3, 4, 6, 2]),
      },
      [qid()]: {
        type: 'ox', title: '히스토그램과 바 차트는 같은 차트이다', order: 2,
        correctAnswer: 'X',
        votes: makeWeightedVotes(ids2, p2, ['O', 'X'], [5, 9]),
      },
      [qid()]: {
        type: 'wordcloud', title: '데이터 분석가에게 필요한 역량은?', order: 3,
        votes: makeVotes(ids2, p2, ['통계', 'SQL', 'Python', '시각화', '커뮤니케이션', '도메인 지식', '통계', 'SQL']),
      },
    },
  };

  // Round 3 — ended
  const names3 = pickNames(18);
  const { participants: p3, ids: ids3 } = makeParticipants(names3);
  const s3 = sid();
  const t3 = now - 3 * DAY;
  sessions[s3] = {
    status: 'ended', currentQuestion: null, currentMode: 'waiting',
    createdAt: t3, courseName: '데이터 분석 입문', roundNumber: 3,
    participants: p3,
    questions: {
      [qid()]: {
        type: 'quiz', title: 'pandas에서 DataFrame의 처음 5행을 보는 메서드는?', order: 1,
        options: ['df.first()', 'df.head()', 'df.top()', 'df.show()'],
        correctAnswer: 'df.head()',
        points: 100, participationTickets: 1, correctBonusTickets: 2,
        speedWindowMs: 30000, maxSpeedBonus: 50,
        activatedAt: t3 + HOUR, revealedAt: t3 + HOUR + 25000, awardedAt: t3 + HOUR + 25000,
        votes: makeQuizVotesWithTimestamp(ids3, p3, ['df.first()', 'df.head()', 'df.top()', 'df.show()'], [1, 12, 2, 1], t3 + HOUR),
      },
      [qid()]: {
        type: 'choice', title: '결측치 처리 방법 중 가장 많이 사용하는 것은?', order: 2,
        options: ['삭제', '평균값 대체', '중앙값 대체', '보간법'],
        correctAnswer: '중앙값 대체',
        votes: makeWeightedVotes(ids3, p3, ['삭제', '평균값 대체', '중앙값 대체', '보간법'], [4, 5, 5, 2]),
      },
      [qid()]: {
        type: 'ox', title: 'NULL과 0은 같은 의미이다', order: 3,
        correctAnswer: 'X',
        votes: makeWeightedVotes(ids3, p3, ['O', 'X'], [3, 13]),
      },
    },
  };

  // Round 4 — setting
  const s4 = sid();
  sessions[s4] = {
    status: 'setting', currentQuestion: null, currentMode: 'waiting',
    createdAt: now - 6 * HOUR, courseName: '데이터 분석 입문', roundNumber: 4,
    questions: {
      [qid()]: {
        type: 'choice', title: '머신러닝에서 과적합을 방지하는 방법은?', order: 1,
        options: ['더 많은 데이터', '규제화', '교차 검증', '모두 해당'],
        correctAnswer: '모두 해당',
      },
      [qid()]: {
        type: 'ox', title: '지도학습에서는 라벨이 필요하다', order: 2,
        correctAnswer: 'O',
      },
    },
  };
}

// ═══════════════════════════════════════════════════════
// CLASS 5: UX/UI 디자인 원칙 (2 rounds: ended, active)
// ═══════════════════════════════════════════════════════
{
  const names1 = pickNames(25);
  const { participants: p1, ids: ids1 } = makeParticipants(names1);
  const s1 = sid();
  const t1 = now - 6 * DAY;
  sessions[s1] = {
    status: 'ended', currentQuestion: null, currentMode: 'waiting',
    createdAt: t1, courseName: 'UX/UI 디자인 원칙', roundNumber: 1,
    participants: p1,
    questions: {
      [qid()]: {
        type: 'choice', title: '사용자 경험에서 가장 중요한 원칙은?', order: 1,
        options: ['일관성', '피드백', '단순함', '접근성'],
        correctAnswer: '단순함',
        votes: makeWeightedVotes(ids1, p1, ['일관성', '피드백', '단순함', '접근성'], [5, 4, 10, 3]),
      },
      [qid()]: {
        type: 'quiz', title: 'Nielsen의 10가지 휴리스틱 중 "사용자 제어와 자유"의 예시는?', order: 2,
        options: ['실행 취소 버튼', '로딩 스피너', '브레드크럼', '툴팁'],
        correctAnswer: '실행 취소 버튼',
        points: 100, participationTickets: 1, correctBonusTickets: 2,
        speedWindowMs: 30000, maxSpeedBonus: 50,
        activatedAt: t1 + HOUR, revealedAt: t1 + HOUR + 30000, awardedAt: t1 + HOUR + 30000,
        votes: makeQuizVotesWithTimestamp(ids1, p1, ['실행 취소 버튼', '로딩 스피너', '브레드크럼', '툴팁'], [14, 3, 4, 2], t1 + HOUR),
      },
      [qid()]: {
        type: 'ox', title: 'Fitts의 법칙: 타겟이 클수록 선택이 쉽다', order: 3,
        correctAnswer: 'O',
        votes: makeWeightedVotes(ids1, p1, ['O', 'X'], [18, 5]),
      },
      [qid()]: {
        type: 'wordcloud', title: '좋은 UI의 특징을 한 단어로?', order: 4,
        votes: makeVotes(ids1, p1, ['직관적', '심플', '깔끔', '일관성', '반응형', '아름다운', '직관적', '심플', '깔끔']),
      },
    },
  };

  // Round 2 — active
  const names2 = pickNames(19);
  const { participants: p2, ids: ids2 } = makeParticipants(names2);
  const q2a = qid(), q2b = qid(), q2c = qid(), q2d = qid(), q2e = qid(), q2f = qid();
  const s2 = sid();
  const t2 = now - 1 * HOUR;
  const s2UxQuestions = {
    [q2a]: {
      type: 'choice', title: '모바일 UI에서 터치 타겟의 최소 크기는?', order: 1,
      options: ['32px', '44px', '48px', '56px'],
      correctAnswer: '48px',
      votes: makeWeightedVotes(ids2, p2, ['32px', '44px', '48px', '56px'], [1, 6, 8, 3]),
    },
    [q2b]: {
      type: 'quiz', title: '색맹 사용자를 위해 색상만으로 정보를 전달하면 안 되는 이유는?', order: 2,
      options: ['느리다', '비싸다', '구분이 불가능하다', '못 생겼다'],
      correctAnswer: '구분이 불가능하다',
      points: 100, participationTickets: 1, correctBonusTickets: 2,
      speedWindowMs: 30000, maxSpeedBonus: 50,
    },
    [q2c]: {
      type: 'ox', title: '다크모드는 항상 눈의 피로를 줄여준다', order: 3,
      correctAnswer: 'X',
    },
    [q2d]: {
      type: 'debate', title: '모바일 앱은 네이티브보다 웹앱이 더 나은 선택인가?', order: 4,
      votes: makeDebateVotes(ids2, p2, 0.55),
    },
    [q2e]: {
      type: 'ranking', title: '디자인 프로세스를 올바른 순서로 배열하세요', order: 5,
      options: ['사용자 조사', '페르소나 정의', '와이어프레임', '프로토타입'],
      correctAnswer: '0,1,2,3',
      votes: makeRankingVotes(ids2, p2, 4),
    },
    [q2f]: {
      type: 'fillinblank', title: 'Jakob Nielsen이 제안한 UI 평가 방법론을 ___이라고 한다', order: 6,
      correctAnswer: '휴리스틱 평가',
      votes: makeFillBlankVotes(ids2, p2, '휴리스틱 평가', 0.4),
    },
  };
  sessions[s2] = {
    status: 'active', currentQuestion: q2a, currentMode: 'poll',
    createdAt: t2, startedAt: t2 + 5 * 60000, courseName: 'UX/UI 디자인 원칙', roundNumber: 2,
    participants: p2,
    questions: s2UxQuestions,
    chat: makeChat(ids2, p2, t2 + 5 * 60000, 8),
    handRaises: makeHandRaises(ids2, p2, t2 + 5 * 60000),
    urgentQuestions: makeUrgentQuestions(t2 + 5 * 60000, 3),
    classQuestions: makeClassQuestions(ids2, p2, t2 + 5 * 60000, 4),
    scores: makeScores(ids2, p2, s2UxQuestions),
  };
}

// ═══════════════════════════════════════════════════════
// CLASS 6: 클라우드 컴퓨팅 기초 (1 round: setting)
// ═══════════════════════════════════════════════════════
{
  const s1 = sid();
  sessions[s1] = {
    status: 'setting', currentQuestion: null, currentMode: 'waiting',
    createdAt: now - 2 * HOUR, courseName: '클라우드 컴퓨팅 기초', roundNumber: 1,
    questions: {
      [qid()]: {
        type: 'choice', title: '가장 많이 사용하는 클라우드 서비스는?', order: 1,
        options: ['AWS', 'Azure', 'GCP', 'Naver Cloud'],
        correctAnswer: 'AWS',
      },
      [qid()]: {
        type: 'quiz', title: 'IaaS, PaaS, SaaS 중 가장 추상화 수준이 높은 것은?', order: 2,
        options: ['IaaS', 'PaaS', 'SaaS'],
        correctAnswer: 'SaaS',
        points: 100, participationTickets: 1, correctBonusTickets: 2,
        speedWindowMs: 30000, maxSpeedBonus: 50,
      },
      [qid()]: {
        type: 'ox', title: 'Serverless는 서버가 없다는 의미이다', order: 3,
        correctAnswer: 'X',
      },
      [qid()]: {
        type: 'wordcloud', title: '클라우드의 장점은?', order: 4,
      },
      [qid()]: {
        type: 'scale', title: '클라우드 전환에 대한 조직의 준비도는?', order: 5,
      },
    },
  };
}

/**
 * Generate team battle data for an active session.
 * Assigns participants into N teams.
 */
function makeTeamBattle(participantIds, teamCount = 2) {
  const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
  const teams = {};
  const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
  for (let i = 0; i < teamCount; i++) {
    teams[`team${i}`] = {
      name: NAMES[i],
      members: {},
    };
  }
  shuffled.forEach((pid, idx) => {
    const teamKey = `team${idx % teamCount}`;
    teams[teamKey].members[pid] = true;
  });
  return {
    active: true,
    teamCount,
    teams,
    startedAt: Date.now(),
  };
}

// ─── WRITE TO FIREBASE ────────────────────────────────

async function seed() {
  // 1. Get existing sessions and delete them one by one
  console.log('🗑️  Clearing existing sessions...');
  const getRes = await fetch(`${DB_URL}/sessions.json`);
  if (getRes.ok) {
    const existing = await getRes.json();
    if (existing) {
      const ids = Object.keys(existing);
      console.log(`   Deleting ${ids.length} existing sessions...`);
      await Promise.all(ids.map((id) =>
        fetch(`${DB_URL}/sessions/${id}.json`, { method: 'DELETE' })
      ));
    }
  }
  console.log('✅ Sessions cleared');

  // 2. Write new sessions individually
  console.log(`📝 Writing ${Object.keys(sessions).length} sessions...`);
  await Promise.all(Object.entries(sessions).map(([id, data]) =>
    fetch(`${DB_URL}/sessions/${id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((res) => {
      if (!res.ok) throw new Error(`Write ${id} failed: ${res.status}`);
    })
  ));
  console.log('✅ Demo data seeded successfully!');

  // Summary
  const courses = {};
  for (const [id, s] of Object.entries(sessions)) {
    const name = s.courseName;
    if (!courses[name]) courses[name] = [];
    courses[name].push({ round: s.roundNumber, status: s.status, id });
  }
  console.log('\n📊 Summary:');
  for (const [name, rounds] of Object.entries(courses)) {
    console.log(`  ${name} (${rounds.length}차수)`);
    for (const r of rounds.sort((a, b) => a.round - b.round)) {
      console.log(`    ${r.round}차 — ${r.status}`);
    }
  }
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
