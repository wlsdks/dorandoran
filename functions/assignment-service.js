const { hashCredential, verifyCredential, nameKey, equalLegacyPin } = require('./credentials');
const { httpError, verifiedUser, createRateLimit } = require('./access');

function createAssignmentService({ auth, db }) {
  const rateLimit = createRateLimit(10);
  const credentialAttempts = createRateLimit(5, 5 * 60_000);
  return async (req) => {
    const user = await verifiedUser(req, auth);
    if (!rateLimit(user.uid)) throw httpError(429, '잠시 후 다시 시도해주세요.');
    const body = req.body || {};
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 160_000) throw httpError(413, '요청이 너무 큽니다.');
    const { assignmentId, name, pin, submissionId } = body;
    if (typeof assignmentId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(assignmentId)) throw httpError(400, '과제를 확인해주세요.');
    const assignment = (await db.ref(`assignments/${assignmentId}`).get()).val();
    if (!assignment) throw httpError(404, '과제를 찾을 수 없습니다.');
    const action = req.path.split('/').filter(Boolean).at(-1);
    if (action === 'withdraw') {
      if (typeof submissionId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(submissionId)) throw httpError(400, '제출물을 확인해주세요.');
      const target = db.ref(`assignments/${assignmentId}/submissions/${submissionId}`);
      const submission = (await target.get()).val();
      const grant = (await db.ref(`submissionGrants/${user.uid}/${assignmentId}/${submissionId}`).get()).val();
      if (!submission || (submission.ownerId !== user.uid && !(typeof grant === 'number' && grant > Date.now()))) throw httpError(403, '본인 제출물만 취소할 수 있습니다.');
      if (assignment.status !== 'open') throw httpError(409, '마감된 과제는 수정할 수 없습니다.');
      await target.remove();
      await db.ref(`assignmentNames/${assignmentId}/${nameKey(submission.name)}`).transaction((current) => current === submissionId ? null : undefined);
      return { ok: true };
    }
    if (!['lookup', 'submit'].includes(action) || typeof name !== 'string' || !name.trim() || name.length > 30 || (pin != null && (typeof pin !== 'string' || pin.length > 128))) {
      throw httpError(400, '제출 정보를 확인해주세요.');
    }
    const matches = (await db.ref(`assignments/${assignmentId}/submissions`).orderByChild('name').equalTo(name.trim()).limitToFirst(2).get()).val() || {};
    const entries = Object.entries(matches);
    if (entries.length > 1) throw httpError(409, '이름이 중복된 제출물은 강사에게 확인해주세요.');
    const [existingId, existing] = entries[0] || [];
    if (action === 'lookup' && !existing) {
      if (!credentialAttempts(`${assignmentId}:${nameKey(name)}`)) throw httpError(429, '잠시 후 다시 시도해주세요.');
      return { error: 'PIN_MISMATCH' };
    }
    if (existing && (action === 'lookup' || body.allowUpdate)) {
      const own = existing.ownerId === user.uid;
      const grant = (await db.ref(`submissionGrants/${user.uid}/${assignmentId}/${existingId}`).get()).val();
      const granted = typeof grant === 'number' && grant > Date.now();
      if (!own && !granted && !credentialAttempts(`${assignmentId}:${nameKey(name)}`)) throw httpError(429, '잠시 후 다시 시도해주세요.');
      const recovered = existing.pinCredential ? await verifyCredential(pin || '', existing.pinCredential) : equalLegacyPin(pin || '', existing.pin);
      if (!own && !granted && !recovered) return { error: 'PIN_MISMATCH' };
      if (recovered) await db.ref(`submissionGrants/${user.uid}/${assignmentId}/${existingId}`).set(Date.now() + 30 * 60_000);
      if (action === 'lookup') {
        const { pinCredential: _credential, pin: _legacyPin, ...safe } = existing;
        return { submission: { id: existingId, ...safe } };
      }
    }
    if (existing && !body.allowUpdate) throw httpError(409, 'NAME_TAKEN');
    if (assignment.status !== 'open') throw httpError(409, '마감된 과제는 제출할 수 없습니다.');
    if (!existing && pin && pin.length < 8) throw httpError(400, '비밀번호는 8자 이상 입력해주세요.');
    if ((body.prdContent != null && (typeof body.prdContent !== 'string' || body.prdContent.length > 10000))
      || (body.code != null && (typeof body.code !== 'string' || body.code.length > 100000))
      || (body.screenshots != null && (!Array.isArray(body.screenshots) || body.screenshots.length > 10 || body.screenshots.some((url) => typeof url !== 'string' || url.length > 2000 || !/^https:\/\//.test(url))))) {
      throw httpError(400, '제출 내용의 크기와 이미지 주소를 확인해주세요.');
    }
    let id = existingId;
    let index;
    if (!id) {
      id = db.ref(`assignments/${assignmentId}/submissions`).push().key;
      index = db.ref(`assignmentNames/${assignmentId}/${nameKey(name)}`);
      const claim = await index.transaction((current) => current === null ? id : undefined);
      if (!claim.committed) throw httpError(409, 'NAME_TAKEN');
    }
    try {
      const data = { name: name.trim(), prdContent: body.prdContent || null, code: body.code || null,
        screenshots: body.screenshots || null, submittedAt: existing?.submittedAt || Date.now(), updatedAt: existing ? Date.now() : null,
      };
      if (existing) await db.ref(`assignments/${assignmentId}/submissions/${id}`).update(data);
      else await db.ref(`assignments/${assignmentId}/submissions/${id}`).set({ ...data, ownerId: user.uid, pinCredential: pin ? await hashCredential(pin) : null });
      return { id };
    } catch (err) { if (index) await index.transaction((current) => current === id ? null : undefined); throw err; }
  };
}
module.exports = { createAssignmentService };
