// server/tests/insightController.test.js
// Unit tests for GET /api/insights controller endpoint.

const { getInsights } = require('../controllers/insightController');
const Expense = require('../models/Expense');

jest.mock('../models/Expense');

describe('Insight Controller - getInsights', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: 'user_123' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('successfully fetches user expenses and returns calculated insights', async () => {
    const mockExpenses = [
      {
        _id: '1',
        title: 'Lunch',
        amount: 100,
        category: 'Food',
        date: new Date('2024-10-01'),
        type: 'debit',
      },
      {
        _id: '2',
        title: 'Fancy Party',
        amount: 1000,
        category: 'Food',
        date: new Date('2024-10-02'),
        type: 'debit',
      },
      {
        _id: '3',
        title: 'Netflix',
        merchant: 'Netflix',
        amount: 649,
        category: 'Entertainment',
        date: new Date('2024-09-15'),
        type: 'debit',
      },
      {
        _id: '4',
        title: 'Netflix',
        merchant: 'Netflix',
        amount: 649,
        category: 'Entertainment',
        date: new Date('2024-10-15'),
        type: 'debit',
      },
    ];

    const mockSort = jest.fn().mockReturnThis();
    const mockLean = jest.fn().mockResolvedValue(mockExpenses);
    Expense.find.mockReturnValue({
      sort: mockSort,
      lean: mockLean,
    });

    await getInsights(req, res, next);

    expect(Expense.find).toHaveBeenCalledWith({ user: 'user_123' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          unusual: expect.any(Array),
          recurring: expect.any(Array),
          forecast: expect.any(Object),
          totalExpensesAnalyzed: 4,
        }),
      })
    );
  });

  test('handles empty data gracefully when user has no expenses', async () => {
    Expense.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    await getInsights(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Insights retrieved successfully',
      data: {
        unusual: [],
        recurring: [],
        forecast: expect.objectContaining({
          spentSoFar: 0,
          dailyPace: 0,
          projectedTotal: 0,
          projectedRemaining: 0,
        }),
        totalExpensesAnalyzed: 0,
      },
    });
  });

  test('passes errors to next() middleware if database query fails', async () => {
    const error = new Error('Database connection failed');
    Expense.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockRejectedValue(error),
    });

    await getInsights(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
