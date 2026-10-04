import { auth } from './auth-session';
const NICKNAME_KEY = 'dorandoran_nickname';
const JOINED_SESSIONS_KEY = 'dorandoran_joined_sessions';

function readJoinedSessions() {
  try {
    return JSON.parse(localStorage.getItem(JOINED_SESSIONS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeJoinedSessions(nextSessions) {
  try { localStorage.setItem(JOINED_SESSIONS_KEY, JSON.stringify(nextSessions)); } catch { /* quota/private */ }
}

/**
 * Returns the current participant's unique ID, generating one if it doesn't exist.
 * @returns {string} UUID stored in localStorage
 */
export function getParticipantId() {
  return auth.currentUser?.uid || '';
}

/**
 * Returns the participant's saved nickname, or an empty string if unset.
 * @returns {string} Nickname from localStorage
 */
export function getNickname() {
  try { return localStorage.getItem(NICKNAME_KEY) || ''; } catch { return ''; }
}

/**
 * Persists the participant's nickname to localStorage.
 * @param {string} name - The nickname to save
 */
export function setNickname(name) {
  try { localStorage.setItem(NICKNAME_KEY, name); } catch { /* quota/private */ }
}

/**
 * Returns whether the current participant has already joined a specific session.
 * @param {string} sessionId
 * @returns {boolean}
 */
export function hasJoinedSession(sessionId) {
  if (!sessionId) return false;
  const joinedSessions = readJoinedSessions();
  return joinedSessions[sessionId]?.participantId === getParticipantId();
}

/**
 * Marks a session as joined for the current participant.
 * @param {string} sessionId
 * @param {string} participantId
 * @param {string} [nickname] - Session-specific nickname
 */
export function markSessionJoined(sessionId, participantId, nickname, employeeId) {
  if (!sessionId || !participantId) return;
  const joinedSessions = readJoinedSessions();
  writeJoinedSessions({
    ...joinedSessions,
    [sessionId]: {
      participantId,
      joinedAt: Date.now(),
      ...(nickname ? { nickname } : {}),
      ...(employeeId ? { employeeId } : {}),
    },
  });
}

/**
 * Returns the nickname used for a specific session, or empty string.
 * @param {string} sessionId
 * @returns {string}
 */
export function getSessionNickname(sessionId) {
  if (!sessionId) return '';
  const joinedSessions = readJoinedSessions();
  return joinedSessions[sessionId]?.nickname || '';
}

/**
 * Returns the (optional) employee number entered for a session, or empty string.
 * @param {string} sessionId
 * @returns {string}
 */
export function getSessionEmployeeId(sessionId) {
  if (!sessionId) return '';
  const joinedSessions = readJoinedSessions();
  return joinedSessions[sessionId]?.employeeId || '';
}

/**
 * Clears join state for a session so the user can re-join with a different nickname.
 * @param {string} sessionId
 */
export function clearSessionJoined(sessionId) {
  if (!sessionId) return;
  const joinedSessions = readJoinedSessions();
  delete joinedSessions[sessionId];
  writeJoinedSessions(joinedSessions);
}

/**
 * Returns the last-seen count for a channel (chat/qa/dm) in a session.
 * Used to suppress false unread badges on page refresh.
 * @param {string} sessionId
 * @param {string} channel - 'chat' | 'qa' | 'dm'
 * @returns {number} last-seen count, or -1 if never opened
 */
export function getLastSeen(sessionId, channel) {
  try {
    const v = localStorage.getItem(`dorandoran_${channel}_seen_${sessionId}`);
    return v !== null ? parseInt(v, 10) : -1;
  } catch {
    return -1;
  }
}

/**
 * Saves the last-seen count for a channel in a session.
 * @param {string} sessionId
 * @param {string} channel - 'chat' | 'qa' | 'dm'
 * @param {number} count
 */
export function saveLastSeen(sessionId, channel, count) {
  try {
    localStorage.setItem(`dorandoran_${channel}_seen_${sessionId}`, String(count));
  } catch { /* silent */ }
}
