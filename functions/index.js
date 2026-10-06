/**
 * 수업 운영 서버 함수(Firebase codebase: default) — 강사 계정, 과제 조회, 학생 수업 참여.
 * AI(Gemini) 프록시는 키 없이도 이 함수들을 배포할 수 있도록 functions-ai/(codebase: ai)로 분리했다.
 *
 * ⚠️ 배포 시 반드시 함수를 지정할 것:
 *    firebase deploy --only functions:default:staffApi,functions:default:assignmentApi,functions:default:classroomApi
 *    이 Firebase 프로젝트에는 다른 코드베이스가 배포한 함수들이 함께 살고 있다.
 *    `--only functions`(또는 functions:default 전체)로 배포하면 CLI가 지정하지 않은 함수를 삭제 대상으로 볼 수 있다.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { createStaffService } = require('./staff-service');
const { createAssignmentService } = require('./assignment-service');
const { createClassroomService } = require('./classroom-service');
const { createHttpApi } = require('./http-api');

const adminApp = getApps()[0] || initializeApp(process.env.APP_DATABASE_URL ? { databaseURL: process.env.APP_DATABASE_URL } : undefined);
const adminAuth = getAuth(adminApp);
const adminDb = getDatabase(adminApp);
const API_RUNTIME = { region: 'asia-northeast3', cors: false, maxInstances: 4, concurrency: 8, memory: '512MiB', timeoutSeconds: 60 };
exports.staffApi = onRequest(API_RUNTIME, createHttpApi(createStaffService({ auth: adminAuth, db: adminDb }), { maxBodyBytes: 8192 }));
exports.assignmentApi = onRequest(API_RUNTIME, createHttpApi(createAssignmentService({ auth: adminAuth, db: adminDb })));
exports.classroomApi = onRequest(API_RUNTIME, createHttpApi(createClassroomService({ auth: adminAuth, db: adminDb }), { maxBodyBytes: 4096 }));
