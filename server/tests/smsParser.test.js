// server/tests/smsParser.test.js
// Unit tests for Indian bank and UPI SMS parser utility.

const { parseSms } = require('../utils/smsParser');

describe('SMS Parser - parseSms(text)', () => {
  describe('Successful parsing of Indian Bank and UPI SMS formats', () => {
    test('Format 1: HDFC Bank / Card debit transaction with Available Balance', () => {
      const sms =
        'Dear Customer, INR 1,250.00 debited from A/C **5678 on 11-10-2024 towards AMAZON. Available Bal: Rs. 14,300.00.';
      const result = parseSms(sms);

      expect(result).not.toBeNull();
      expect(result.amount).toBe(1250.0);
      expect(result.merchant).toBe('AMAZON');
      expect(result.type).toBe('debit');
      expect(result.date).toBeInstanceOf(Date);
      expect(result.date.getFullYear()).toBe(2024);
      expect(result.date.getMonth()).toBe(9); // October is month 9 (0-indexed)
      expect(result.date.getDate()).toBe(11);
    });

    test('Format 2: HDFC Bank UPI transfer (Sent Rs... to ... on DD-Mon-YY)', () => {
      const sms =
        'Sent Rs.450.00 from HDFC Bank A/C **1234 to SWIGGY on 10-OCT-24. UPI Ref: 1234567890.';
      const result = parseSms(sms);

      expect(result).not.toBeNull();
      expect(result.amount).toBe(450.0);
      expect(result.merchant).toBe('SWIGGY');
      expect(result.type).toBe('debit');
      expect(result.date.getFullYear()).toBe(2024);
      expect(result.date.getMonth()).toBe(9);
      expect(result.date.getDate()).toBe(10);
    });

    test('Format 3: SBI Bank UPI debit (debited by Rs... transfer to ...)', () => {
      const sms =
        'Your A/C ending 4321 is debited by Rs.250.00 on 12/10/24 transfer to ZOMATO UPI Ref no 42876123.';
      const result = parseSms(sms);

      expect(result).not.toBeNull();
      expect(result.amount).toBe(250.0);
      expect(result.merchant).toBe('ZOMATO');
      expect(result.type).toBe('debit');
      expect(result.date.getFullYear()).toBe(2024);
      expect(result.date.getMonth()).toBe(9);
      expect(result.date.getDate()).toBe(12);
    });

    test('Format 4: ICICI Bank credit / salary / inbound transfer (credited with Rs... by ...)', () => {
      const sms =
        'Your A/C 9876 has been credited with Rs. 15,000.00 on 05-Oct-2024 by INFO SERVICES PVT LTD. Avl Bal: Rs. 45,000.00.';
      const result = parseSms(sms);

      expect(result).not.toBeNull();
      expect(result.amount).toBe(15000.0);
      expect(result.merchant).toBe('INFO SERVICES PVT LTD');
      expect(result.type).toBe('credit');
      expect(result.date.getFullYear()).toBe(2024);
      expect(result.date.getMonth()).toBe(9);
      expect(result.date.getDate()).toBe(5);
    });

    test('Format 5: Axis Bank / Merchant UPI payment (Paid Rs... to ... via UPI on DD-MM-YYYY)', () => {
      const sms =
        'Paid Rs. 320.00 to STARBUCKS via UPI on 09-10-2024. Ref: 9876543210.';
      const result = parseSms(sms);

      expect(result).not.toBeNull();
      expect(result.amount).toBe(320.0);
      expect(result.merchant).toBe('STARBUCKS');
      expect(result.type).toBe('debit');
      expect(result.date.getFullYear()).toBe(2024);
      expect(result.date.getMonth()).toBe(9);
      expect(result.date.getDate()).toBe(9);
    });

    test('Format 6: P2P UPI Credit (Rs... received in your A/C from ...)', () => {
      const sms =
        'Rs. 500.00 received in your A/C from RAHUL SHARMA via UPI on 08-10-2024.';
      const result = parseSms(sms);

      expect(result).not.toBeNull();
      expect(result.amount).toBe(500.0);
      expect(result.merchant).toBe('RAHUL SHARMA');
      expect(result.type).toBe('credit');
      expect(result.date.getFullYear()).toBe(2024);
      expect(result.date.getMonth()).toBe(9);
      expect(result.date.getDate()).toBe(8);
    });
  });

  describe('Failure cases returning null', () => {
    test('returns null for non-string or falsy input', () => {
      expect(parseSms(null)).toBeNull();
      expect(parseSms(undefined)).toBeNull();
      expect(parseSms('')).toBeNull();
      expect(parseSms('   ')).toBeNull();
      expect(parseSms(12345)).toBeNull();
      expect(parseSms({})).toBeNull();
      expect(parseSms([])).toBeNull();
    });

    test('returns null for OTP verification messages', () => {
      const otpSms =
        'Your OTP for NetBanking transaction is 782194. Do not share this OTP with anyone.';
      expect(parseSms(otpSms)).toBeNull();
    });

    test('returns null for marketing / promotional SMS', () => {
      const promoSms =
        'Get 50% discount on flight tickets today! Book now at www.flights.com with coupon FLY50.';
      expect(parseSms(promoSms)).toBeNull();
    });

    test('returns null for account balance inquiry (no debit or credit action)', () => {
      const balanceSms =
        'Your A/C balance for **1234 is Rs. 14,300.00 as on 10-10-2024.';
      expect(parseSms(balanceSms)).toBeNull();
    });

    test('returns null for unparseable gibberish or general conversation text', () => {
      const randomText =
        'Hey, are we still meeting today at the cafe? Let me know!';
      expect(parseSms(randomText)).toBeNull();
    });

    test('returns null when transaction type cannot be verified (e.g. bill payment reminder)', () => {
      const reminderSms =
        'Payment of Rs. 400.00 is due on 15-10-2024 for your electricity connection.';
      expect(parseSms(reminderSms)).toBeNull();
    });

    test('returns null when merchant cannot be determined', () => {
      const noMerchantSms = 'Rs. 250 debited on 10-10-2024.';
      expect(parseSms(noMerchantSms)).toBeNull();
    });

    test('returns null when date is completely missing', () => {
      const noDateSms = 'Paid Rs. 320 to STARBUCKS via UPI.';
      expect(parseSms(noDateSms)).toBeNull();
    });
  });
});
