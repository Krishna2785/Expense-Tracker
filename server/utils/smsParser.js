// server/utils/smsParser.js
// Utility module to parse Indian Bank and UPI transaction SMS alerts.

/**
 * Month name to 0-indexed month mapping
 */
const MONTH_MAP = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Helper to parse Indian date strings (DD-MM-YYYY, DD/MM/YY, DD-Mon-YYYY) into a Date object.
 *
 * @param {string} dayStr
 * @param {string} monthStr
 * @param {string} yearStr
 * @returns {Date|null}
 */
const parseDateComponents = (dayStr, monthStr, yearStr) => {
  const day = parseInt(dayStr, 10);
  let year = parseInt(yearStr, 10);
  if (yearStr.length === 2) {
    year += 2000;
  }

  let month;
  if (/^[a-zA-Z]+$/.test(monthStr)) {
    const key = monthStr.toLowerCase();
    month = MONTH_MAP[key];
    if (month === undefined) return null;
  } else {
    month = parseInt(monthStr, 10) - 1; // 0-indexed
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 0 || month > 11) return null;

  const date = new Date(year, month, day);
  // Verify date validity (e.g. handles invalid leap dates)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

/**
 * Extracts transaction date from SMS text.
 *
 * Regex Explanation:
 * Matches DD-MM-YYYY, DD/MM/YY, DD-Mon-YYYY, or DD Mon YYYY.
 * Group 1: 1-2 digits (Day)
 * Group 2: 1-2 digits or 3-9 letters (Month)
 * Group 3: 2 or 4 digits (Year)
 *
 * @param {string} text
 * @returns {Date|null}
 */
const extractDate = (text) => {
  // Pattern 1: DD-MM-YYYY or DD/MM/YYYY or DD-Mon-YY (e.g., 11-10-2024, 12/10/24, 10-OCT-24, 05-Oct-2024)
  const dateRegex = /\b(\d{1,2})[-/]([A-Za-z]{3,9}|\d{1,2})[-/](\d{2,4})\b/;
  const match = text.match(dateRegex);
  if (match) {
    return parseDateComponents(match[1], match[2], match[3]);
  }

  // Pattern 2: DD Mon YYYY (e.g., 10 Oct 2024)
  const dateSpaceRegex = /\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})\b/;
  const spaceMatch = text.match(dateSpaceRegex);
  if (spaceMatch) {
    return parseDateComponents(spaceMatch[1], spaceMatch[2], spaceMatch[3]);
  }

  return null;
};

/**
 * Extracts transaction type ('debit' or 'credit').
 *
 * Regex Explanation:
 * - Credit: Matches keywords indicating inbound funds (credited, received, deposited, refunded, cr).
 * - Debit: Matches keywords indicating outbound funds (debited, paid, sent, spent, withdrawn, dr).
 *
 * @param {string} text
 * @returns {'debit'|'credit'|null}
 */
const extractType = (text) => {
  const isCredit = /\b(credited(?:\s+(?:with|to))?|received|deposited|refunded|cr(?:\.|\b))\b/i.test(text);
  const isDebit = /\b(debited(?:\s+(?:by|from|with))?|paid|sent|spent|withdrawn|dr(?:\.|\b))\b/i.test(text);

  // If both or neither match, check priority based on standard bank phrasing
  if (isCredit && !isDebit) return 'credit';
  if (isDebit && !isCredit) return 'debit';

  if (isCredit && isDebit) {
    // E.g. "debited from A/C ... and credited to ..."
    // In user-facing SMS, the first action typically defines the user's transaction type
    const creditIndex = text.search(/\b(credited|received|deposited|refunded)\b/i);
    const debitIndex = text.search(/\b(debited|paid|sent|spent|withdrawn)\b/i);
    if (debitIndex !== -1 && (creditIndex === -1 || debitIndex < creditIndex)) {
      return 'debit';
    }
    if (creditIndex !== -1) {
      return 'credit';
    }
  }

  return null;
};

/**
 * Extracts transaction amount while avoiding "Available Balance" (Avl Bal / Bal).
 *
 * Regex Explanation:
 * Matches currency indicators (Rs., Rs, INR, ₹) followed by numeric amount with optional commas and decimals.
 * Pre-checks ignore matches directly preceded by "Bal", "Balance", "Avl Bal", etc.
 *
 * @param {string} text
 * @returns {number|null}
 */
const extractAmount = (text) => {
  // Pattern 1: Amount directly associated with transaction verbs
  // E.g.: "debited by Rs.250.00", "credited with Rs. 15,000.00", "Paid Rs. 320", "Sent Rs.450.00", "INR 1,250.00 debited"
  const verbAmountPatterns = [
    // "debited by Rs. 250.00" / "credited with INR 1,500.00" / "received Rs. 500"
    /(?:debited|credited|paid|sent|received)\s+(?:by|with|of)?\s*(?:(?:Rs\.?|INR|₹)\s*)?([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
    // "INR 1,250.00 debited" / "Rs.450.00 from HDFC" / "Rs. 500.00 received"
    /(?:Rs\.?|INR|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:is|has been|was)?\s*(?:debited|credited|received|transferred|sent|paid|from)/i,
    // "Paid Rs. 320.00 to" / "Sent Rs. 450.00"
    /\b(?:paid|sent)\s+(?:Rs\.?|INR|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
  ];

  for (const pattern of verbAmountPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const cleanVal = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(cleanVal) && cleanVal > 0) {
        return cleanVal;
      }
    }
  }

  // Pattern 2: Generic currency matching, excluding Balance ("Avl Bal", "Bal: Rs...")
  // We match all currency values in the text and pick the first one not preceded by balance keywords
  const genericCurrencyRegex = /(?:(?<!(?:bal|balance|avl|avl\s*bal|available\s*bal|available\s*balance)[:\s]*))(?:Rs\.?|INR|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;
  let genericMatch;
  while ((genericMatch = genericCurrencyRegex.exec(text)) !== null) {
    const matchIndex = genericMatch.index;
    const prefix = text.substring(Math.max(0, matchIndex - 20), matchIndex).toLowerCase();
    // Verify prefix doesn't contain balance words
    if (!/bal|balance|avl/i.test(prefix)) {
      const cleanVal = parseFloat(genericMatch[1].replace(/,/g, ''));
      if (!isNaN(cleanVal) && cleanVal > 0) {
        return cleanVal;
      }
    }
  }

  return null;
};

/**
 * Clean and format extracted merchant / beneficiary / sender string.
 *
 * @param {string} raw
 * @returns {string|null}
 */
const cleanMerchant = (raw) => {
  if (!raw) return null;

  let cleaned = raw
    .replace(/(?:[.\s]+(?:available\s*bal|avl\s*bal|bal|balance).*)$/i, '') // cut off any balance text
    .replace(/[.,:;!?]+$/, '') // remove trailing punctuation
    .replace(/^(to|from|by|at|towards)\s+/i, '') // remove leading prepositions
    .replace(/\b(A\/C|acc|account|\*\*?\d+|\bupi\b|\bref\b.*)$/i, '') // remove account or trailing ref
    .trim();

  // If it's too short or contains only symbols/numbers, disregard
  if (cleaned.length < 2 || /^[\d\s._-]+$/.test(cleaned)) {
    return null;
  }

  return cleaned;
};

/**
 * Extracts merchant or sender from SMS text based on transaction type.
 *
 * Regex Explanation:
 * For debits:
 *   Looks for names after 'towards', 'to', 'at', 'transfer to', 'paid to'.
 *   Terminates at sentence punctuation (. ! ?), end of string, or keywords (on, via, ref, upi, avl, bal, available, using).
 * For credits:
 *   Looks for names after 'from', 'by', 'received from'.
 *   Terminates at sentence punctuation (. ! ?), end of string, or keywords (on, via, ref, upi, avl, bal, available).
 *
 * @param {string} text
 * @param {'debit'|'credit'} type
 * @returns {string|null}
 */
const extractMerchant = (text, type) => {
  if (type === 'debit') {
    // E.g.: "towards AMAZON.", "to SWIGGY on", "transfer to ZOMATO UPI", "Paid Rs. 320 to STARBUCKS via"
    const debitMerchantPatterns = [
      /(?:towards|transfer to|paid to)\s+([A-Za-z0-9\s&._-]{2,40}?)(?=[.!?]|\s+(?:on|via|ref|upi|avl|bal|available|using|$)|$)/i,
      /\bto\s+([A-Za-z0-9\s&._-]{2,40}?)(?=[.!?]|\s+(?:on|via|ref|upi|avl|bal|available|using|$)|$)/i,
      /\bat\s+([A-Za-z0-9\s&._-]{2,40}?)(?=[.!?]|\s+(?:on|via|ref|upi|avl|bal|available|$)|$)/i,
    ];

    for (const pattern of debitMerchantPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleaned = cleanMerchant(match[1]);
        if (cleaned) return cleaned;
      }
    }
  } else if (type === 'credit') {
    // E.g.: "by INFO SERVICES PVT LTD.", "from RAHUL SHARMA via UPI", "credited ... by GOOGLE INDIA"
    const creditMerchantPatterns = [
      /(?:received from|from)\s+([A-Za-z0-9\s&._-]{2,40}?)(?=[.!?]|\s+(?:on|via|ref|upi|avl|bal|available|$)|$)/i,
      /\bby\s+([A-Za-z0-9\s&._-]{2,40}?)(?=[.!?]|\s+(?:on|via|ref|upi|avl|bal|available|$)|$)/i,
    ];

    for (const pattern of creditMerchantPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleaned = cleanMerchant(match[1]);
        if (cleaned) return cleaned;
      }
    }
  }

  return null;
};

/**
 * Main SMS parser function for Indian bank and UPI SMS messages.
 *
 * @param {string} text - The raw SMS message string.
 * @returns {{ amount: number, merchant: string, date: Date, type: 'debit'|'credit' } | null}
 */
const parseSms = (text) => {
  // 1. Guard against non-string or empty input
  if (!text || typeof text !== 'string') {
    return null;
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return null;
  }

  // 2. Extract transaction type ('debit' or 'credit')
  const type = extractType(normalized);
  if (!type) {
    return null; // Not a debit or credit transaction message (e.g. OTP, promo, balance check)
  }

  // 3. Extract transaction amount
  const amount = extractAmount(normalized);
  if (amount === null || isNaN(amount) || amount <= 0) {
    return null;
  }

  // 4. Extract merchant / sender name
  const merchant = extractMerchant(normalized, type);
  if (!merchant) {
    return null;
  }

  // 5. Extract transaction date
  const date = extractDate(normalized);
  if (!date) {
    return null;
  }

  return {
    amount,
    merchant,
    date,
    type,
  };
};

module.exports = {
  parseSms,
  extractAmount,
  extractDate,
  extractMerchant,
  extractType,
};
