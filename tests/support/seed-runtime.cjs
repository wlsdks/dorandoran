process.env.FIREBASE_DATABASE_EMULATOR_HOST='127.0.0.1:9000';process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
const dep=require('node:module').createRequire(require('node:path').resolve(__dirname,'../../functions/package.json'));const{initializeApp}=dep('firebase-admin/app');const{getDatabase}=dep('firebase-admin/database');
const app=initializeApp({projectId:'demo-dorandoran',databaseURL:'https://demo-dorandoran.firebaseio.com'});const db=getDatabase(app);
(async()=>{const uid='legacy_master';const a={creatorId:uid,courseId:'course_a',courseName:'Alpha 수업',createdAt:1,status:'active',currentMode:'poll',currentQuestion:'q1',
participants:{[uid]:{nickname:'Alpha',connections:{one:true},joinedAt:1}},questions:{q1:{title:'Alpha 질문',type:'choice',options:['Alpha','Other'],order:1,votes:{[uid]:{value:'Alpha',nickname:'Alpha',timestamp:1}}}},
timer:{running:true,endTime:Date.now()+60000,duration:60},scores:{[uid]:{nickname:'Alpha',total:1}},handRaises:{[uid]:{raised:true}},urgentQuestions:{u:{text:'Alpha 질문',participantId:uid}},
chat:{m:{text:'Alpha 채팅',sender:'Alpha',senderType:'instructor',timestamp:1}},staffChat:{m:{text:'Alpha 스태프',sender:'Alpha',senderType:'staff',timestamp:1}},
dmByStudent:{[uid]:'dm_alpha'},dm:{dm_alpha:{studentId:uid,status:'active',createdAt:1,messages:{m:{text:'Alpha 상담',sender:'Alpha',senderType:'student',timestamp:1}}}}};
await db.ref('sessions/runtime_alpha').set(a);await db.ref('sessions/runtime_beta').set({creatorId:uid,courseName:'Beta 수업',createdAt:1,status:'active',currentMode:'waiting'});
await db.ref('assignments/runtime_alpha').set({title:'Alpha 과제',ownerId:uid,status:'open',awards:{first:{name:'Alpha'}},results:{one:{summary:{avgScore:8}}}});
await db.ref('assignments/runtime_beta').set({title:'Beta 과제',ownerId:uid,status:'open'});
await db.ref('sessions/qa_room/questions/slides/slideImages').set(['/tests/fixtures/slides/1.svg','/tests/fixtures/slides/2.svg','/tests/fixtures/slides/3.svg']);
const base = (await db.ref('sessions/qa_room').get()).val();
await db.ref('sessions/ui_audit').set({ ...base, participants: null, dm: null, dmByStudent: null, publicQuestions: null,
  courseName: '도란도란 화면 점검', currentMode: 'poll', currentQuestion: 'slides', startedAt: Date.now(),
  questions: {
    slides: { title: '함께 배우는 수업', type: 'imageSlide', slideImages: ['/tests/fixtures/slides/1.svg','/tests/fixtures/slides/2.svg','/tests/fixtures/slides/3.svg'], currentSlide: 2, order: 0 },
    q1: { title: '배운 내용을 어떻게 활용하고 싶나요?', type: 'quiz', options: ['수업에서 바로 활용할 수 있어요','실습을 통해 이해했어요'], correctAnswer: '실습을 통해 이해했어요', order: 1 },
    q2: { title: '오늘 떠오른 생각을 한 단어로 적어주세요', type: 'wordcloud', order: 2 },
    many: { title: '다양한 생각을 함께 살펴봅니다', type: 'choice', options: Array.from({length:15},(_,i)=>`${i+1}. 다양한 관점에서 생각해볼 수 있어요`), order: 3 },
  },
});
console.log('Isolated runtime fixture seeded');process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)});
