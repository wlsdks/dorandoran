/** 기존 계정은 수정하지 않는다. 자격 증명은 서버에 두고 표시할 필드만 반환한다. */
async function readStaffProfile(db, uid) {
  const modern = (await db.ref(`staffProfiles/${uid}`).get()).val();
  const account = modern || (await db.ref(`admins/${uid}`).get()).val();
  if (!account) return null;
  return { uid, username: account.username, displayName: account.displayName || account.username,
    role: account.role, approved: account.approved === true, createdAt: account.createdAt || null };
}
module.exports = { readStaffProfile };
