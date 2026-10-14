// server/utils/categorizer.js
// Maps merchants to expense categories using a built-in keyword map.
// User-defined MerchantRules are layered on top with higher priority.

'use strict';

/**
 * Built-in keyword → category map.
 *
 * Keys are lowercase substrings / keywords found in a merchant name.
 * Values are the category string that will be used for auto-categorization.
 *
 * Priority within this map is irrelevant — the FIRST match wins per merchant.
 * The order of entries here does NOT matter for correctness, only completeness.
 */
const DEFAULT_KEYWORD_MAP = [
  // ── Food Delivery ─────────────────────────────────────────────────────────
  { keywords: ['swiggy'],         category: 'Food' },
  { keywords: ['zomato'],         category: 'Food' },
  { keywords: ['dunzo'],          category: 'Food' },
  { keywords: ['blinkit'],        category: 'Groceries' },
  { keywords: ['zepto'],          category: 'Groceries' },
  { keywords: ['bigbasket'],      category: 'Groceries' },
  { keywords: ['grofers'],        category: 'Groceries' },
  { keywords: ['instamart'],      category: 'Groceries' },
  { keywords: ['milkbasket'],     category: 'Groceries' },
  { keywords: ['mcdonald', 'mcdonalds', "mcd"], category: 'Food' },
  { keywords: ['domino', 'dominos'],  category: 'Food' },
  { keywords: ['kfc'],            category: 'Food' },
  { keywords: ['subway'],         category: 'Food' },
  { keywords: ['pizza hut', 'pizzahut'], category: 'Food' },
  { keywords: ['starbucks'],      category: 'Food' },
  { keywords: ['cafe coffee day', 'ccd'], category: 'Food' },
  { keywords: ['chai point'],     category: 'Food' },

  // ── Ride-Hailing & Transport ──────────────────────────────────────────────
  { keywords: ['uber'],           category: 'Transportation' },
  { keywords: ['ola'],            category: 'Transportation' },
  { keywords: ['rapido'],         category: 'Transportation' },
  { keywords: ['namma yatri'],    category: 'Transportation' },
  { keywords: ['irctc'],          category: 'Transportation' },
  { keywords: ['indian railways', 'railway'],  category: 'Transportation' },
  { keywords: ['makemytrip', 'mmt'], category: 'Transportation' },
  { keywords: ['goibibo'],        category: 'Transportation' },
  { keywords: ['cleartrip'],      category: 'Transportation' },
  { keywords: ['indigo', 'air india', 'spicejet', 'vistara', 'akasa'], category: 'Transportation' },
  { keywords: ['fasttag'],        category: 'Transportation' },
  { keywords: ['bmtc', 'ksrtc', 'msrtc', 'dtc'], category: 'Transportation' },

  // ── Entertainment & OTT ───────────────────────────────────────────────────
  { keywords: ['netflix'],        category: 'Entertainment' },
  { keywords: ['amazon prime', 'prime video'], category: 'Entertainment' },
  { keywords: ['hotstar', 'disney+', 'jio cinema', 'jiocinema'], category: 'Entertainment' },
  { keywords: ['spotify'],        category: 'Entertainment' },
  { keywords: ['apple music'],    category: 'Entertainment' },
  { keywords: ['youtube premium'], category: 'Entertainment' },
  { keywords: ['sony liv', 'sonyliv'], category: 'Entertainment' },
  { keywords: ['zee5'],           category: 'Entertainment' },
  { keywords: ['bookmyshow'],     category: 'Entertainment' },
  { keywords: ['pvr'],            category: 'Entertainment' },
  { keywords: ['inox'],           category: 'Entertainment' },

  // ── Telecom & Internet ────────────────────────────────────────────────────
  { keywords: ['jio'],            category: 'Bills & Utilities' },
  { keywords: ['airtel'],         category: 'Bills & Utilities' },
  { keywords: ['vi ', 'vodafone idea', 'vi recharge'], category: 'Bills & Utilities' },
  { keywords: ['bsnl'],           category: 'Bills & Utilities' },
  { keywords: ['act fibernet', 'act broadband'], category: 'Bills & Utilities' },
  { keywords: ['hathway'],        category: 'Bills & Utilities' },
  { keywords: ['tata sky', 'tata play'], category: 'Bills & Utilities' },
  { keywords: ['d2h'],            category: 'Bills & Utilities' },

  // ── Utility Bills ─────────────────────────────────────────────────────────
  { keywords: ['bescom', 'msedcl', 'bses', 'tata power', 'adani electricity', 'electricity'], category: 'Bills & Utilities' },
  { keywords: ['water board', 'bwssb', 'jal board'],  category: 'Bills & Utilities' },
  { keywords: ['gas supply', 'indane', 'hp gas', 'bharat gas'],    category: 'Bills & Utilities' },
  { keywords: ['paytm postpaid', 'bill payment'],  category: 'Bills & Utilities' },

  // ── Healthcare & Pharmacy ─────────────────────────────────────────────────
  { keywords: ['apollo pharmacy', 'apollo clinic'], category: 'Healthcare' },
  { keywords: ['medplus'],        category: 'Healthcare' },
  { keywords: ['1mg', 'tata 1mg'], category: 'Healthcare' },
  { keywords: ['pharmeasy'],      category: 'Healthcare' },
  { keywords: ['practo'],         category: 'Healthcare' },
  { keywords: ['manipal hospital', 'fortis', 'max hospital', 'aiims'], category: 'Healthcare' },
  { keywords: ['netmeds'],        category: 'Healthcare' },

  // ── Shopping & E-Commerce ─────────────────────────────────────────────────
  { keywords: ['amazon'],         category: 'Shopping' },
  { keywords: ['flipkart'],       category: 'Shopping' },
  { keywords: ['myntra'],         category: 'Shopping' },
  { keywords: ['meesho'],         category: 'Shopping' },
  { keywords: ['nykaa'],          category: 'Shopping' },
  { keywords: ['ajio'],           category: 'Shopping' },
  { keywords: ['snapdeal'],       category: 'Shopping' },
  { keywords: ['reliance digital', 'croma'],  category: 'Shopping' },
  { keywords: ['ikea'],           category: 'Shopping' },
  { keywords: ['decathlon'],      category: 'Shopping' },

  // ── Education ─────────────────────────────────────────────────────────────
  { keywords: ['byjus', "byju's"], category: 'Education' },
  { keywords: ['unacademy'],      category: 'Education' },
  { keywords: ['udemy'],          category: 'Education' },
  { keywords: ['coursera'],       category: 'Education' },
  { keywords: ['khan academy'],   category: 'Education' },
  { keywords: ['vedantu'],        category: 'Education' },
  { keywords: ['toppr'],          category: 'Education' },

  // ── Finance & Banking ─────────────────────────────────────────────────────
  { keywords: ['zerodha'],        category: 'General' },
  { keywords: ['groww'],          category: 'General' },
  { keywords: ['upstox'],         category: 'General' },
  { keywords: ['lic'],            category: 'General' },
  { keywords: ['policybazaar'],   category: 'General' },
];

/**
 * Look up the best category for a merchant name using the default keyword map.
 *
 * Strategy: normalise the merchant name to lowercase, then scan each rule's
 * keywords in order. The first rule whose keyword is a substring of the
 * merchant name wins.
 *
 * @param {string} merchantName
 * @returns {string} category string, or 'General' if no match
 */
const getDefaultCategory = (merchantName) => {
  if (!merchantName || typeof merchantName !== 'string') return 'General';

  const lower = merchantName.toLowerCase().trim();

  for (const rule of DEFAULT_KEYWORD_MAP) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return rule.category;
      }
    }
  }

  return 'General';
};

/**
 * Resolve the best category for a merchant, with user rules taking priority.
 *
 * Priority order (highest → lowest):
 *   1. User-defined MerchantRule (exact case-insensitive match)
 *   2. Default keyword map
 *   3. 'General' fallback
 *
 * @param {string}  merchantName   - Raw merchant/payee name from SMS parser
 * @param {string}  userId         - The logged-in user's Mongoose ObjectId string
 * @param {object}  MerchantRule   - The Mongoose model (injected to avoid circular deps)
 * @returns {Promise<string>}      - Resolved category string
 */
const resolveCategory = async (merchantName, userId, MerchantRule) => {
  if (!merchantName) return 'General';

  // 1. Check user-defined overrides first
  if (userId && MerchantRule) {
    try {
      const userRule = await MerchantRule.findOne({
        user: userId,
        // Case-insensitive exact match on stored merchant name
        merchant: { $regex: new RegExp(`^${merchantName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
      if (userRule) return userRule.category;
    } catch (_) {
      // Non-fatal — fall through to default map
    }
  }

  // 2. Fall back to keyword map
  return getDefaultCategory(merchantName);
};

module.exports = {
  getDefaultCategory,
  resolveCategory,
  DEFAULT_KEYWORD_MAP, // exported for unit tests
};
