const { httpError, verifiedStaff } = require('./access');
const { shallowKeys, metadataList } = require('./metadata');
const { mapConcurrent } = require('./concurrency');

const COURSE_FIELDS = ['name', 'ownerId', 'ownerName', 'createdAt'];
const SESSION_FIELDS = ['courseId', 'creatorId', 'courseName', 'status', 'createdAt', 'roundNumber', 'currentMode', 'courseTemplateId'];
const ASSIGNMENT_FIELDS = ['ownerId', 'title', 'description', 'courseName', 'roundNumber', 'hasJudging', 'passThreshold', 'status', 'createdAt', 'closedAt', 'judgedAt'];

function createResourceService({ auth, db }) {
  return async req => {
    const user = await verifiedStaff(req, auth, db);
    const { resource, courseId, courseName } = req.body || {};
    if (!['courses', 'sessions', 'assignments'].includes(resource)) throw httpError(400, '조회 대상을 확인해주세요.');
    const allCourses = await metadataList(db, 'courses', COURSE_FIELDS);
    const assigned = user.profile.role === 'staff' ? (await db.ref(`staffCourses/${user.uid}`).get()).val() || {} : {};
    const courses = allCourses.filter(course => user.profile.role === 'master' || course.ownerId === user.uid || assigned[course.id] === true);
    if (resource === 'courses') return { items: courses };
    const courseIds = new Set(courses.map(course => course.id));
    const names = new Set(courses.map(course => course.name));
    if (resource === 'assignments') {
      const metadata = await metadataList(db, 'assignments', ASSIGNMENT_FIELDS);
      const items = metadata.filter(item => {
        const matching = allCourses.filter(course => course.name === item.courseName);
        const unambiguous = new Set(matching.map(course => course.ownerId)).size === 1;
        const accessible = user.profile.role === 'master' || (item.ownerId ? item.ownerId === user.uid : unambiguous && names.has(item.courseName));
        return accessible && (!courseName || courseName === item.courseName);
      });
      // 운영 원자료는 변경하지 않고, 기존 과제의 강의 연결만 별도 권한 정보로 저장한다.
      const grants = {};
      for (const item of items) {
        const course = courses.find(course => course.name === item.courseName);
        if (course) grants[`assignmentAccess/${item.id}/${user.uid}`] = course.id;
      }
      if (Object.keys(grants).length) await db.ref().update(grants);
      return { items: items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) };
    }
    const metadata = await metadataList(db, 'sessions', SESSION_FIELDS);
    const items = metadata.filter(item => (user.profile.role === 'master' || item.creatorId === user.uid || (user.profile.role === 'staff' && courseIds.has(item.courseId))) && (!courseId || courseId === item.courseId));
    return { items: await mapConcurrent(items, 4, async item => {
      const [participants, questions] = await Promise.all([db.ref(`sessions/${item.id}/participants`).get(), shallowKeys(db, `sessions/${item.id}/questions`)]);
      const records = participants.val() || {};
      const votes = await mapConcurrent(questions, 4, id => shallowKeys(db, `sessions/${item.id}/questions/${id}/votes`));
      const voterIds = new Set(votes.flat().filter(id => Object.hasOwn(records, id)));
      const totalParticipants = Object.keys(records).length;
      return { ...item, totalParticipants: Object.keys(records).length, participantCount: Object.values(records).filter(participant => Object.values(participant.connections || {}).some(value => value === true)).length,
        questionCount: questions.length, activityRate: totalParticipants ? Math.round(voterIds.size / totalParticipants * 100) : 0, activeCount: voterIds.size };
    }) };
  };
}
module.exports = { createResourceService };
