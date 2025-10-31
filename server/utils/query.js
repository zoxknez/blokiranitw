// Query parameter utilities
const config = require('../config');
const { MAX_LIMIT } = config;

const SAFE_SORT_COLUMNS = new Set(['username', 'created_at', 'updated_at', 'id']);
const SAFE_ORDER = new Set(['ASC', 'DESC']);

function coerceLimit(value, fallbackFromConfig = 50) {
  const fallback = fallbackFromConfig || 50;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return Math.min(n, MAX_LIMIT);
}

function coercePage(value, fallback = 1) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return n;
}

function coerceSort(value, fallback = 'username') {
  return SAFE_SORT_COLUMNS.has(value) ? value : fallback;
}

function coerceOrder(value, fallback = 'ASC') {
  const upper = String(value || '').toUpperCase();
  return SAFE_ORDER.has(upper) ? upper : fallback;
}

function buildDateCondition(dateRange) {
  if (dateRange === 'today') {
    return " AND date(created_at) = date('now')";
  } else if (dateRange === '7d') {
    return " AND datetime(created_at) >= datetime('now','-7 days')";
  } else if (dateRange === '30d') {
    return " AND datetime(created_at) >= datetime('now','-30 days')";
  }
  return '';
}

module.exports = {
  coerceLimit,
  coercePage,
  coerceSort,
  coerceOrder,
  buildDateCondition,
  MAX_LIMIT
};

