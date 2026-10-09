// server/utils/escapeRegex.js
// Utility function to escape regular expression special characters in user input.

/**
 * Escapes characters with special meaning in Regular Expressions.
 * Prevents ReDoS attacks and SyntaxError crashes when users search with characters like "(", "+", "*", etc.
 * 
 * @param {string} text - User input string to escape
 * @returns {string} - Escaped string safe for new RegExp()
 */
const escapeRegex = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

module.exports = escapeRegex;
