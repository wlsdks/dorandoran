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
console.log('Isolated runtime fixture seeded');process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)});
