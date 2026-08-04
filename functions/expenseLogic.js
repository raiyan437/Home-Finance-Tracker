const ALLOWED_FIELDS = [
  'id', 'title', 'amountCents', 'paidBy', 'category', 'date', 'splitMethod',
  'shares', 'sharesTotalCents', 'participantUids', 'scope', 'ownerId', 'houseId',
  'paymentMethod', 'isRecurring', 'recurringFrequency', 'lastGeneratedDate',
  'recurringSourceId', 'receiptUrl', 'comments', 'notes', 'createdAt', 'updatedAt',
];
const CATEGORIES = new Set(['Groceries', 'Household', 'Utilities', 'Food', 'Personal', 'Other']);
const SPLIT_METHODS = new Set(['equal', 'custom', 'percentage']);
const MAX_CENTS = 100_000_000_000;

const fail = (message) => {
  const error = new Error(message);
  error.code = 'failed-precondition';
  throw error;
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOnly = (value, fields) => isPlainObject(value) && Object.keys(value).every((key) => fields.includes(key));
const hasAll = (value, fields) => fields.every((field) => Object.prototype.hasOwnProperty.call(value, field));
const validUid = (value) => typeof value === 'string' && value.length > 0 && value.length <= 128;
const validText = (value, maximum) => typeof value === 'string' && value.length > 0 && value.length <= maximum;
const validTimestamp = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && !Number.isNaN(Date.parse(value));

const validCalendarDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCFullYear() === year
    && new Date(Date.UTC(year, month - 1, day)).getUTCMonth() === month - 1
    && new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day;
};

const validImageUrl = (value, maximum) => typeof value === 'string'
  && value.length > 0
  && value.length <= maximum
  && (/^https?:\/\//.test(value) || /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value));

const validComment = (value, memberUids) => isPlainObject(value)
  && hasOnly(value, ['id', 'userId', 'text', 'createdAt'])
  && hasAll(value, ['id', 'userId', 'text', 'createdAt'])
  && validUid(value.id)
  && validUid(value.userId)
  && memberUids.has(value.userId)
  && validText(value.text, 1000)
  && validTimestamp(value.createdAt);

const validPaymentMethod = (value) => {
  if (value === undefined) return true;
  if (!hasOnly(value, ['type', 'cardId', 'cardName', 'cardType']) || !hasAll(value, ['type'])) return false;
  if (!['cash', 'card'].includes(value.type)) return false;
  if (value.cardId !== undefined && !validUid(value.cardId)) return false;
  if (value.cardName !== undefined && !validText(value.cardName, 160)) return false;
  if (value.cardType !== undefined && !['debit', 'credit'].includes(value.cardType)) return false;
  return value.type !== 'cash' || (value.cardId === undefined && value.cardName === undefined && value.cardType === undefined);
};

const validShare = (value) => isPlainObject(value)
  && hasOnly(value, ['userId', 'amountCents', 'percentage'])
  && hasAll(value, ['userId', 'amountCents'])
  && validUid(value.userId)
  && Number.isSafeInteger(value.amountCents)
  && value.amountCents >= 0
  && value.amountCents <= MAX_CENTS
  && (value.percentage === undefined || (typeof value.percentage === 'number' && Number.isFinite(value.percentage) && value.percentage >= 0 && value.percentage <= 100));

const validateHouseholdExpense = (data, { houseId, memberUids }) => {
  if (!hasOnly(data, ALLOWED_FIELDS) || !hasAll(data, ['id', 'title', 'amountCents', 'paidBy', 'category', 'date', 'splitMethod', 'shares', 'sharesTotalCents', 'participantUids', 'scope', 'createdAt', 'updatedAt'])) fail('Expense schema is invalid.');
  if (!validUid(data.id) || !validText(data.title, 160)) fail('Expense identity or title is invalid.');
  if (!Number.isSafeInteger(data.amountCents) || data.amountCents <= 0 || data.amountCents > MAX_CENTS) fail('Expense amount is invalid.');
  if (!validUid(data.paidBy) || !memberUids.has(data.paidBy)) fail('Expense payer is not a current household member.');
  if (!CATEGORIES.has(data.category) || !validCalendarDate(data.date) || !SPLIT_METHODS.has(data.splitMethod)) fail('Expense category, date, or split method is invalid.');
  if (!Array.isArray(data.shares) || data.shares.length < 1 || data.shares.length > 10 || !data.shares.every(validShare)) fail('Expense shares are invalid.');
  if (!Array.isArray(data.participantUids) || data.participantUids.length !== data.shares.length || new Set(data.participantUids).size !== data.participantUids.length) fail('Expense participants are invalid.');
  if (!data.participantUids.every((uid, index) => memberUids.has(uid) && uid === data.shares[index].userId)) fail('Expense participants do not match shares.');
  if (!Number.isSafeInteger(data.sharesTotalCents) || data.sharesTotalCents !== data.amountCents || data.shares.reduce((sum, share) => sum + share.amountCents, 0) !== data.amountCents) fail('Expense shares do not total the expense amount.');
  if (data.scope !== 'household' || data.houseId !== houseId || data.ownerId !== undefined && !validUid(data.ownerId)) fail('Expense household binding is invalid.');
  if (!validPaymentMethod(data.paymentMethod) || data.isRecurring !== undefined && typeof data.isRecurring !== 'boolean') fail('Expense payment or recurring data is invalid.');
  if (data.recurringFrequency !== undefined && !['monthly', 'weekly'].includes(data.recurringFrequency)) fail('Expense recurring frequency is invalid.');
  if (data.lastGeneratedDate !== undefined && !validCalendarDate(data.lastGeneratedDate)) fail('Expense recurring date is invalid.');
  if (data.recurringSourceId !== undefined && !validUid(data.recurringSourceId)) fail('Expense recurring source is invalid.');
  if (data.receiptUrl !== undefined && !validImageUrl(data.receiptUrl, 40000)) fail('Expense receipt is invalid.');
  if (data.comments !== undefined && (!Array.isArray(data.comments) || data.comments.length > 20 || !data.comments.every((comment) => validComment(comment, memberUids)))) fail('Expense comments are invalid.');
  if (data.notes !== undefined && !validText(data.notes, 2000)) fail('Expense notes are invalid.');
  if (!validTimestamp(data.createdAt) || !validTimestamp(data.updatedAt)) fail('Expense timestamps are invalid.');
  return data;
};

const evaluateExpenseMutation = ({ operation, authUid, leaderUid, existing, incoming, houseId, memberUids }) => {
  if (operation === 'delete') {
    if (!existing || existing.scope !== 'household' || existing.houseId !== houseId) fail('Expense does not belong to this household.');
    if (existing.paidBy !== authUid && leaderUid !== authUid) fail('Only the payer or leader can delete this expense.');
    return { kind: 'delete' };
  }
  validateHouseholdExpense(incoming, { houseId, memberUids });
  if (existing && (existing.scope !== 'household' || existing.houseId !== houseId)) fail('Expense does not belong to this household.');
  if (existing && existing.paidBy !== authUid && leaderUid !== authUid) fail('Only the payer or leader can update this expense.');
  return { kind: 'write', data: incoming };
};

module.exports = {
  evaluateExpenseMutation,
  validateHouseholdExpense,
};
