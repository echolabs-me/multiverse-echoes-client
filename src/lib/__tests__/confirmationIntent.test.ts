import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock i18n before importing the module under test
vi.mock('../../i18n.ts', () => ({
  default: { language: 'en' },
}));

import { detectConfirmationIntent } from '../confirmationIntent.ts';
import i18n from '../../i18n.ts';

function setLocale(locale: string) {
  (i18n as { language: string }).language = locale;
}

beforeEach(() => setLocale('en'));

describe('detectConfirmationIntent', () => {
  describe('English', () => {
    const affirm = [
      'yes',
      'yep',
      'yeah',
      'correct',
      'looks good',
      'send it',
      'submit',
      'confirm',
      'go ahead',
      'do it',
      'sure',
      'ok',
      'okay',
    ];
    const deny = [
      'no',
      'nope',
      'nah',
      'cancel',
      'stop',
      'never mind',
      'forget it',
    ];

    it('affirms all English positive patterns', () => {
      for (const input of affirm) {
        expect(
          detectConfirmationIntent(input),
          `expected true for "${input}"`,
        ).toBe(true);
      }
    });

    it('denies all English negative patterns', () => {
      for (const input of deny) {
        expect(
          detectConfirmationIntent(input),
          `expected false for "${input}"`,
        ).toBe(false);
      }
    });

    it('returns null for ambiguous input', () => {
      expect(detectConfirmationIntent('tell me more about echoes')).toBeNull();
      expect(detectConfirmationIntent('what happened yesterday?')).toBeNull();
    });
  });

  describe('Japanese', () => {
    beforeEach(() => setLocale('ja'));
    it('affirms Japanese positive patterns', () => {
      for (const input of [
        'はい',
        'うん',
        'そうです',
        'いいです',
        'オッケー',
        '送信',
        '確認',
      ]) {
        expect(
          detectConfirmationIntent(input),
          `expected true for "${input}"`,
        ).toBe(true);
      }
    });
    it('denies Japanese negative patterns', () => {
      for (const input of ['いいえ', 'いや', 'やめて', 'キャンセル']) {
        expect(
          detectConfirmationIntent(input),
          `expected false for "${input}"`,
        ).toBe(false);
      }
    });
  });

  describe('Spanish', () => {
    beforeEach(() => setLocale('es'));
    it('affirms Spanish positive patterns', () => {
      for (const input of [
        'sí',
        'si',
        'correcto',
        'enviar',
        'confirmar',
        'dale',
        'vale',
        'claro',
      ]) {
        expect(
          detectConfirmationIntent(input),
          `expected true for "${input}"`,
        ).toBe(true);
      }
    });
    it('denies Spanish negative patterns', () => {
      for (const input of ['no', 'cancelar', 'olvídalo']) {
        expect(
          detectConfirmationIntent(input),
          `expected false for "${input}"`,
        ).toBe(false);
      }
    });
  });

  describe('Arabic', () => {
    beforeEach(() => setLocale('ar'));
    it('affirms Arabic positive patterns', () => {
      for (const input of [
        'نعم',
        'أجل',
        'صحيح',
        'أرسل',
        'تأكيد',
        'حسناً',
        'موافق',
      ]) {
        expect(
          detectConfirmationIntent(input),
          `expected true for "${input}"`,
        ).toBe(true);
      }
    });
    it('denies Arabic negative patterns', () => {
      for (const input of ['لا', 'إلغاء', 'توقف']) {
        expect(
          detectConfirmationIntent(input),
          `expected false for "${input}"`,
        ).toBe(false);
      }
    });
  });

  describe('Chinese (Simplified)', () => {
    beforeEach(() => setLocale('zh-Hans'));
    it('affirms Chinese positive patterns', () => {
      for (const input of [
        '是',
        '是的',
        '好',
        '好的',
        '确认',
        '对',
        '没问题',
        '可以',
      ]) {
        expect(
          detectConfirmationIntent(input),
          `expected true for "${input}"`,
        ).toBe(true);
      }
    });
    it('denies Chinese negative patterns', () => {
      for (const input of ['不', '不是', '不要', '取消', '算了']) {
        expect(
          detectConfirmationIntent(input),
          `expected false for "${input}"`,
        ).toBe(false);
      }
    });
  });

  describe('Hindi', () => {
    beforeEach(() => setLocale('hi'));
    it('affirms Hindi positive patterns', () => {
      for (const input of [
        'हाँ',
        'हां',
        'जी',
        'जी हाँ',
        'सही',
        'भेजो',
        'ठीक',
        'बिल्कुल',
      ]) {
        expect(
          detectConfirmationIntent(input),
          `expected true for "${input}"`,
        ).toBe(true);
      }
    });
    it('denies Hindi negative patterns', () => {
      for (const input of ['नहीं', 'रद्द', 'रुको', 'छोड़ो']) {
        expect(
          detectConfirmationIntent(input),
          `expected false for "${input}"`,
        ).toBe(false);
      }
    });
  });

  describe('Korean', () => {
    beforeEach(() => setLocale('ko'));
    it('affirms Korean positive patterns', () => {
      for (const input of [
        '네',
        '예',
        '맞아',
        '좋아',
        '확인',
        '맞아요',
        '응',
      ]) {
        expect(
          detectConfirmationIntent(input),
          `expected true for "${input}"`,
        ).toBe(true);
      }
    });
    it('denies Korean negative patterns', () => {
      for (const input of ['아니', '아니요', '취소', '싫어']) {
        expect(
          detectConfirmationIntent(input),
          `expected false for "${input}"`,
        ).toBe(false);
      }
    });
  });

  describe('cross-locale fallback', () => {
    it('English "yes" works even when locale is Japanese', () => {
      setLocale('ja');
      expect(detectConfirmationIntent('yes')).toBe(true);
    });

    it('empty string returns null', () => {
      expect(detectConfirmationIntent('')).toBeNull();
      expect(detectConfirmationIntent('   ')).toBeNull();
    });

    it('case insensitive', () => {
      expect(detectConfirmationIntent('YES')).toBe(true);
      expect(detectConfirmationIntent('No')).toBe(false);
    });
  });
});
