/**
 * Pre-built question template packs for instructors.
 * Each pack contains 5 curated questions spanning multiple question types.
 * Designed for real classroom use: icebreakers, evaluations, discussions.
 *
 * icon: lucide-react icon name key — resolved in TemplatePacks component.
 */

export const TEMPLATE_PACKS = [
  {
    id: 'icebreaker',
    name: '아이스브레이킹',
    description: '수업 시작 전 분위기를 풀어주는 5가지 질문',
    icon: 'Snowflake',
    questions: [
      {
        type: 'scale',
        title: '지금 기분이 어떤가요? (0: 최악 ~ 100: 최고)',
      },
      {
        type: 'wordcloud',
        title: '올해 꼭 이루고 싶은 것 한 단어로!',
      },
      {
        type: 'choice',
        title: '아침에 일어나면 제일 먼저 하는 것은?',
        options: ['핸드폰 확인', '물 마시기', '알람 끄기', '이불 속 5분 더'],
        correctAnswer: '핸드폰 확인',
      },
      {
        type: 'debate',
        title: '아침형 인간 vs 저녁형 인간, 어느 쪽이 더 성공할까?',
      },
      {
        type: 'ox',
        title: '나는 어제 7시간 이상 잤다',
        correctAnswer: 'O',
      },
    ],
  },
  {
    id: 'class-eval',
    name: '수업 평가',
    description: '수업 만족도와 개선점을 파악하는 5가지 질문',
    icon: 'ClipboardList',
    questions: [
      {
        type: 'scale',
        title: '오늘 수업 만족도를 점수로 표현하면? (0~100)',
      },
      {
        type: 'choice',
        title: '오늘 수업에서 가장 좋았던 점은?',
        options: ['설명이 명확했다', '실습이 도움 됐다', '질의응답 시간', '자료가 좋았다', '전반적으로 좋았다'],
        correctAnswer: '설명이 명확했다',
      },
      {
        type: 'wordcloud',
        title: '오늘 수업을 한 단어로 표현하면?',
      },
      {
        type: 'qna',
        title: '수업에서 개선되었으면 하는 점이 있다면 자유롭게 적어주세요',
      },
      {
        type: 'debate',
        title: '오늘 배운 내용을 실무에 바로 적용할 수 있을까?',
      },
    ],
  },
  {
    id: 'team-building',
    name: '팀빌딩',
    description: '팀원끼리 친해지는 재미있는 5가지 질문',
    icon: 'Users',
    questions: [
      {
        type: 'choice',
        title: '무인도에 하나만 가져갈 수 있다면?',
        options: ['스마트폰 (충전 불가)', '나이프', '텐트', '친구 한 명'],
        correctAnswer: '나이프',
      },
      {
        type: 'ranking',
        title: '여행 갈 때 가장 중요한 순서대로 정렬하세요',
        options: ['맛집 탐방', '관광지 방문', '숙소 퀄리티', '현지인 교류'],
        correctAnswer: '0,1,2,3',
      },
      {
        type: 'wordcloud',
        title: '나를 표현하는 형용사 하나!',
      },
      {
        type: 'debate',
        title: '재택근무 vs 사무실 출근, 더 효율적인 것은?',
      },
      {
        type: 'scale',
        title: '우리 팀의 협업 수준은? (0: 각자 따로 ~ 100: 완벽한 팀워크)',
      },
    ],
  },
  {
    id: 'cs-basics',
    name: 'CS 기초 퀴즈',
    description: '컴퓨터 과학 기초 지식을 점검하는 5가지 퀴즈',
    icon: 'Code',
    questions: [
      {
        type: 'quiz',
        title: 'HTTP 상태코드 404는 무엇을 의미하나요?',
        options: ['서버 에러', '페이지를 찾을 수 없음', '권한 없음', '요청 성공'],
        correctAnswer: '페이지를 찾을 수 없음',
        points: 100,
      },
      {
        type: 'fillinblank',
        title: 'Git에서 원격 저장소의 변경사항을 가져오려면 git ___를 사용한다',
        correctAnswer: 'pull',
      },
      {
        type: 'ox',
        title: 'JavaScript에서 "==" 와 "===" 는 동일하게 동작한다',
        correctAnswer: 'X',
      },
      {
        type: 'quiz',
        title: '시간복잡도 O(n log n)에 해당하는 정렬 알고리즘은?',
        options: ['버블 정렬', '퀵 정렬', '선택 정렬', '삽입 정렬'],
        correctAnswer: '퀵 정렬',
        points: 200,
      },
      {
        type: 'ranking',
        title: 'OSI 7계층을 아래에서 위로 정렬하세요',
        // 순위 맞추기 정답은 항목 번호 순서(0부터). 항목을 정답 순서로 적었으면 "0,1,2,3"이다.
        options: ['물리 계층', '데이터링크 계층', '네트워크 계층', '전송 계층'],
        correctAnswer: '0,1,2,3',
      },
    ],
  },
  {
    id: 'critical-thinking',
    name: '비판적 사고',
    description: '토론과 논리적 사고를 자극하는 5가지 질문',
    icon: 'Lightbulb',
    questions: [
      {
        type: 'debate',
        title: 'AI가 인간의 일자리를 대체하는 것은 긍정적인가?',
      },
      {
        type: 'scale',
        title: 'SNS가 인간 관계에 긍정적이라고 생각하는 정도 (0: 전혀 아님 ~ 100: 매우 긍정적)',
      },
      {
        type: 'choice',
        title: '가장 중요한 21세기 역량은?',
        options: ['비판적 사고', '창의성', '협업 능력', '디지털 리터러시', '의사소통'],
        correctAnswer: '비판적 사고',
      },
      {
        type: 'qna',
        title: '10년 후 교육은 어떻게 달라져 있을까요? 자유롭게 예측해보세요',
      },
      {
        type: 'wordcloud',
        title: '좋은 리더에게 가장 필요한 자질 한 단어!',
      },
    ],
  },
];
