const { ServerValue } = require('firebase-admin/database');
const { httpError, verifiedUser, createRateLimit } = require('./access');
const { readStaffProfile } = require('./staff-profile');
const { ensureQuestionView } = require('./question-view');

function createClassroomService({ auth, db }) {
  const rateLimit = createRateLimit(20);
  return async (req) => {
    const user = await verifiedUser(req, auth);
    if (!rateLimit(user.uid)) throw httpError(429, '잠시 후 다시 시도해주세요.');
    const { sessionId, questionId, text } = req.body || {};
    const action = req.path.split('/').filter(Boolean).at(-1);
    if (!['question', 'answer', 'manifest'].includes(action) || typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(sessionId)
      || (action !== 'manifest' && (typeof text !== 'string' || !text.trim() || text.length > 500))) throw httpError(400, '질문과 답변을 확인해주세요.');
    const base = `sessions/${sessionId}`;
    const [participant, profile, creator, course] = await Promise.all([
      db.ref(`${base}/participants/${user.uid}`).get(), readStaffProfile(db, user.uid),
      db.ref(`${base}/creatorId`).get(), db.ref(`${base}/courseId`).get(),
    ]);
    const staff = profile;
    const assigned = course.val() && (await db.ref(`staffCourses/${user.uid}/${course.val()}`).get()).val() === true;
    const privileged = staff?.approved && (staff.role === 'master' || (staff.role === 'admin' && creator.val() === user.uid) || (staff.role === 'staff' && assigned));
    const viewer = action === 'manifest' && (await db.ref(`sessionViewers/${sessionId}/${user.uid}`).get()).val() === true;
    if (!participant.exists() && !privileged && !viewer) throw httpError(403, '이 수업에 참여한 사용자만 작성할 수 있습니다.');
    if (action === 'manifest') { await ensureQuestionView(db, sessionId); return { ready: true }; }
    const nickname = privileged ? staff.displayName || staff.username : participant.val().nickname || '익명';
    const updates = {};
    if (action === 'question') {
      const id = db.ref(`${base}/classQuestions`).push().key;
      updates[`${base}/classQuestions/${id}`] = { text: text.trim(), nickname, participantId: user.uid, timestamp: ServerValue.TIMESTAMP,
        answered: false, aiAllowed: false };
      updates[`${base}/qaStats/${user.uid}/questions`] = ServerValue.increment(1);
      updates[`${base}/qaStats/${user.uid}/nickname`] = nickname;
      await db.ref().update(updates);
      return { id };
    }
    if (typeof questionId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(questionId)) throw httpError(400, '질문을 확인해주세요.');
    if (!(await db.ref(`${base}/classQuestions/${questionId}`).get()).exists()) throw httpError(404, '질문을 찾을 수 없습니다.');
    const id = db.ref(`${base}/classQuestions/${questionId}/answers`).push().key;
    updates[`${base}/classQuestions/${questionId}/answers/${id}`] = { text: text.trim(), nickname, participantId: user.uid,
      timestamp: ServerValue.TIMESTAMP, role: privileged ? staff.role : 'student' };
    updates[`${base}/qaStats/${user.uid}/answers`] = ServerValue.increment(1);
    updates[`${base}/qaStats/${user.uid}/nickname`] = nickname;
    if (privileged) {
      updates[`${base}/classQuestions/${questionId}/answered`] = true;
      updates[`${base}/classQuestions/${questionId}/answeredBy`] = nickname;
      updates[`${base}/classQuestions/${questionId}/answeredByRole`] = staff.role;
    }
    await db.ref().update(updates);
    return { id };
  };
}
module.exports = { createClassroomService };
