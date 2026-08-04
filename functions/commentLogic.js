const MAX_COMMENTS = 20;
const MAX_COMMENT_TEXT = 1000;

const fail = (code, message) => {
  const error = new Error(message);
  error.code = code;
  throw error;
};

const isIsoTimestamp = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && !Number.isNaN(Date.parse(value));

const validateComment = (comment, uid) => {
  if (!comment || typeof comment !== 'object' || Array.isArray(comment)) fail('invalid-argument', 'Invalid comment.');
  const keys = Object.keys(comment);
  if (keys.length > 4 || keys.some((key) => !['id', 'userId', 'text', 'createdAt'].includes(key))) fail('invalid-argument', 'Invalid comment fields.');
  if (typeof comment.id !== 'string' || comment.id.length < 1 || comment.id.length > 128) fail('invalid-argument', 'Invalid comment ID.');
  if (comment.userId !== uid) fail('permission-denied', 'A comment must be authored by the signed-in user.');
  if (typeof comment.text !== 'string' || comment.text.trim().length < 1 || comment.text.length > MAX_COMMENT_TEXT) fail('invalid-argument', 'Comment text is too long or empty.');
  if (!isIsoTimestamp(comment.createdAt)) fail('invalid-argument', 'Invalid comment timestamp.');
  return comment;
};

const canDeleteComment = (comment, uid, leaderUid) => comment?.userId === uid || leaderUid === uid;

const appendComment = (comments, comment) => {
  if (comments.length >= MAX_COMMENTS) fail('resource-exhausted', 'This expense has reached the comment limit.');
  if (comments.some((item) => item && item.id === comment.id)) fail('already-exists', 'This comment has already been submitted.');
  return [...comments, comment];
};

module.exports = { appendComment, canDeleteComment, MAX_COMMENTS, validateComment };
