// server/tests/categorizer.test.js
// Unit tests for categorizer utility and user MerchantRule priority resolution.

const { getDefaultCategory, resolveCategory, DEFAULT_KEYWORD_MAP } = require('../utils/categorizer');

describe('Categorizer Utility', () => {
  describe('getDefaultCategory(merchantName)', () => {
    test('categorizes Food delivery apps correctly', () => {
      expect(getDefaultCategory('Swiggy')).toBe('Food');
      expect(getDefaultCategory('ZOMATO')).toBe('Food');
      expect(getDefaultCategory('McDonalds')).toBe('Food');
      expect(getDefaultCategory('Domino\'s Pizza')).toBe('Food');
    });

    test('categorizes Groceries apps correctly', () => {
      expect(getDefaultCategory('Blinkit')).toBe('Groceries');
      expect(getDefaultCategory('Zepto')).toBe('Groceries');
      expect(getDefaultCategory('BigBasket')).toBe('Groceries');
      expect(getDefaultCategory('Instamart')).toBe('Groceries');
    });

    test('categorizes Transportation and Ride-hailing correctly', () => {
      expect(getDefaultCategory('Uber India')).toBe('Transportation');
      expect(getDefaultCategory('Ola Cabs')).toBe('Transportation');
      expect(getDefaultCategory('Rapido')).toBe('Transportation');
      expect(getDefaultCategory('IRCTC')).toBe('Transportation');
    });

    test('categorizes Entertainment and OTT correctly', () => {
      expect(getDefaultCategory('Netflix')).toBe('Entertainment');
      expect(getDefaultCategory('Spotify')).toBe('Entertainment');
      expect(getDefaultCategory('Hotstar')).toBe('Entertainment');
      expect(getDefaultCategory('BookMyShow')).toBe('Entertainment');
    });

    test('categorizes Telecom & Utilities correctly', () => {
      expect(getDefaultCategory('Jio Prepaid')).toBe('Bills & Utilities');
      expect(getDefaultCategory('Airtel Payments')).toBe('Bills & Utilities');
      expect(getDefaultCategory('Tata Power')).toBe('Bills & Utilities');
      expect(getDefaultCategory('BESCOM')).toBe('Bills & Utilities');
    });

    test('categorizes Healthcare correctly', () => {
      expect(getDefaultCategory('Apollo Pharmacy')).toBe('Healthcare');
      expect(getDefaultCategory('Tata 1mg')).toBe('Healthcare');
    });

    test('categorizes Shopping correctly', () => {
      expect(getDefaultCategory('Amazon')).toBe('Shopping');
      expect(getDefaultCategory('Flipkart')).toBe('Shopping');
      expect(getDefaultCategory('Myntra')).toBe('Shopping');
    });

    test('returns "General" for unmapped merchants or invalid inputs', () => {
      expect(getDefaultCategory('Unknown Local Chai Shop')).toBe('General');
      expect(getDefaultCategory('')).toBe('General');
      expect(getDefaultCategory(null)).toBe('General');
      expect(getDefaultCategory(undefined)).toBe('General');
    });
  });

  describe('resolveCategory(merchantName, userId, MerchantRule) - Priority & Overrides', () => {
    const mockUserId = '60d0fe4f5311236168a109ca';

    test('User rule takes precedence over default keyword map', async () => {
      // Swiggy is normally 'Food', but user customized it to 'Entertainment'
      const mockMerchantRule = {
        findOne: jest.fn().mockResolvedValue({
          user: mockUserId,
          merchant: 'Swiggy',
          category: 'Entertainment',
        }),
      };

      const category = await resolveCategory('Swiggy', mockUserId, mockMerchantRule);

      expect(mockMerchantRule.findOne).toHaveBeenCalled();
      expect(category).toBe('Entertainment'); // User override won over 'Food'
    });

    test('Falls back to default keyword map when no user rule exists', async () => {
      const mockMerchantRule = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      const category = await resolveCategory('Uber', mockUserId, mockMerchantRule);

      expect(mockMerchantRule.findOne).toHaveBeenCalled();
      expect(category).toBe('Transportation'); // Default map applied
    });

    test('Falls back to "General" when neither user rule nor keyword match exists', async () => {
      const mockMerchantRule = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      const category = await resolveCategory('Ramesh General Store', mockUserId, mockMerchantRule);

      expect(category).toBe('General');
    });

    test('Gracefully handles database lookup errors and falls back to default map', async () => {
      const mockMerchantRule = {
        findOne: jest.fn().mockRejectedValue(new Error('DB connection timed out')),
      };

      const category = await resolveCategory('Netflix', mockUserId, mockMerchantRule);

      expect(category).toBe('Entertainment');
    });

    test('Handles case-insensitivity when querying user rule', async () => {
      const mockMerchantRule = {
        findOne: jest.fn().mockImplementation(({ merchant }) => {
          if (merchant && merchant.$regex) {
            return Promise.resolve({
              user: mockUserId,
              merchant: 'netflix',
              category: 'Personal Subscriptions',
            });
          }
          return Promise.resolve(null);
        }),
      };

      const category = await resolveCategory('NETFLIX', mockUserId, mockMerchantRule);

      expect(category).toBe('Personal Subscriptions');
    });
  });
});
