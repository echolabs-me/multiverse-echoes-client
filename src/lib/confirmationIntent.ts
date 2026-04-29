/**
 * Locale-aware confirmation/negation intent detector.
 *
 * Normalises user responses in any supported locale to a boolean
 * (confirmed / denied) or null (ambiguous — pass through to Oracle).
 *
 * Used by useOracleStore to detect when the user confirms or denies
 * a pending feedback submission. Graceful degradation: if the user's
 * reply doesn't match any known pattern in any language, returns null
 * and the raw message is sent to the Oracle as-is.
 */

import i18n from '../i18n.ts';

// Patterns per locale. Each entry is [locale, affirmatives[], negatives[]].
// Only exact-match or startsWith is used — no regex, no fuzzy matching.
// ~30 patterns per major locale as specified.
const LOCALE_PATTERNS: ReadonlyArray<
  readonly [string, readonly string[], readonly string[]]
> = [
  ['en', ['yes', 'yep', 'yeah', 'correct', 'looks good', 'send it', 'submit', 'confirm', 'go ahead', 'do it', 'sure', 'ok', 'okay', 'right', 'absolutely'], ['no', 'nope', 'nah', 'cancel', 'stop', 'never mind', 'forget it', 'don\'t', 'wait']],
  ['zh-Hans', ['是', '是的', '好', '好的', '确认', '对', '对的', '提交', '发送', '没问题', '可以', '行', '嗯', '确定'], ['不', '不是', '不要', '取消', '算了', '不用', '别']],
  ['zh-Hant', ['是', '是的', '好', '好的', '確認', '對', '對的', '提交', '發送', '沒問題', '可以', '行', '嗯', '確定'], ['不', '不是', '不要', '取消', '算了', '不用', '別']],
  ['ja', ['はい', 'うん', 'そうです', 'いいです', 'オッケー', '送信', '確認', '大丈夫', 'そう', 'いいよ', '了解'], ['いいえ', 'いや', 'やめて', 'キャンセル', '違う', 'だめ', 'やめる']],
  ['ko', ['네', '예', '맞아', '좋아', '확인', '보내', '맞아요', '그래', '응', '좋아요', '알겠어', '오케이'], ['아니', '아니요', '취소', '안돼', '싫어', '그만']],
  ['es', ['sí', 'si', 'correcto', 'enviar', 'confirmar', 'dale', 'ok', 'vale', 'claro', 'por supuesto', 'adelante'], ['no', 'cancelar', 'para', 'olvídalo', 'ni hablar']],
  ['pt-BR', ['sim', 'correto', 'enviar', 'confirmar', 'ok', 'claro', 'com certeza', 'manda', 'beleza', 'pode ser'], ['não', 'cancelar', 'para', 'esquece', 'nem']],
  ['fr', ['oui', 'ouais', 'correct', 'envoyer', 'confirmer', 'ok', 'd\'accord', 'bien sûr', 'absolument', 'vas-y', 'c\'est bon'], ['non', 'annuler', 'arrête', 'laisse tomber', 'pas question']],
  ['de', ['ja', 'jawohl', 'korrekt', 'senden', 'bestätigen', 'ok', 'genau', 'stimmt', 'sicher', 'mach das', 'passt'], ['nein', 'abbrechen', 'stopp', 'vergiss es', 'auf keinen fall']],
  ['it', ['sì', 'si', 'corretto', 'invia', 'conferma', 'ok', 'certo', 'esatto', 'va bene', 'perfetto'], ['no', 'annulla', 'ferma', 'lascia stare', 'niente']],
  ['ru', ['да', 'ага', 'верно', 'отправить', 'подтвердить', 'ок', 'конечно', 'точно', 'хорошо', 'давай', 'ладно'], ['нет', 'отмена', 'стоп', 'забудь', 'не надо']],
  ['ar', ['نعم', 'أجل', 'صحيح', 'أرسل', 'تأكيد', 'حسناً', 'موافق', 'بالتأكيد', 'طيب', 'ماشي'], ['لا', 'إلغاء', 'توقف', 'انسَ', 'أبداً']],
  ['hi', ['हाँ', 'हां', 'जी', 'जी हाँ', 'सही', 'भेजो', 'पुष्टि', 'ठीक', 'बिल्कुल', 'चलो', 'ओके'], ['नहीं', 'रद्द', 'रुको', 'छोड़ो', 'मत']],
  ['bn', ['হ্যাঁ', 'ঠিক', 'সঠিক', 'পাঠাও', 'নিশ্চিত', 'ওকে', 'অবশ্যই', 'চলো'], ['না', 'বাতিল', 'থামো', 'ভুলে যাও']],
  ['ur', ['ہاں', 'جی', 'صحیح', 'بھیجو', 'تصدیق', 'ٹھیک', 'بالکل', 'چلو', 'اوکے'], ['نہیں', 'منسوخ', 'رکو', 'چھوڑو', 'مت']],
  ['vi', ['vâng', 'đúng', 'gửi', 'xác nhận', 'ok', 'được', 'ừ', 'phải', 'chắc chắn', 'đồng ý'], ['không', 'hủy', 'dừng', 'thôi']],
  ['th', ['ใช่', 'ครับ', 'ค่ะ', 'ถูกต้อง', 'ส่ง', 'ยืนยัน', 'โอเค', 'ได้', 'ตกลง', 'แน่นอน'], ['ไม่', 'ยกเลิก', 'หยุด', 'ไม่เอา']],
  ['id', ['ya', 'benar', 'kirim', 'konfirmasi', 'ok', 'oke', 'betul', 'tentu', 'siap', 'boleh'], ['tidak', 'batal', 'stop', 'lupakan', 'jangan']],
  ['ms', ['ya', 'betul', 'hantar', 'sahkan', 'ok', 'baik', 'tentu', 'boleh', 'setuju'], ['tidak', 'batal', 'hentikan', 'lupakan', 'jangan']],
  ['tl', ['oo', 'tama', 'ipadala', 'kumpirmahin', 'ok', 'sige', 'ayan', 'sigurado'], ['hindi', 'kanselahin', 'huwag', 'kalimutan', 'ayaw']],
  ['tr', ['evet', 'doğru', 'gönder', 'onayla', 'ok', 'tamam', 'tabii', 'kesinlikle', 'olur', 'peki'], ['hayır', 'iptal', 'dur', 'vazgeç', 'yok']],
];

/**
 * Detect confirmation/negation intent from user text.
 *
 * @returns `true` if affirmed, `false` if denied, `null` if ambiguous.
 *          Ambiguous → caller should pass the message through to Oracle.
 */
export function detectConfirmationIntent(text: string): boolean | null {
  const lower = text.toLowerCase().trim();
  if (!lower) return null;

  // Check current locale first, then English as fallback, then all others.
  const currentLocale = i18n.language;
  const ordered = [
    LOCALE_PATTERNS.find(([loc]) => loc === currentLocale),
    LOCALE_PATTERNS.find(([loc]) => loc === 'en'),
    ...LOCALE_PATTERNS.filter(([loc]) => loc !== currentLocale && loc !== 'en'),
  ].filter(Boolean) as ReadonlyArray<
    readonly [string, readonly string[], readonly string[]]
  >;

  for (const [, affirmatives, negatives] of ordered) {
    if (affirmatives.some((p) => lower === p || lower.startsWith(p + ' '))) {
      return true;
    }
    if (negatives.some((p) => lower === p || lower.startsWith(p + ' '))) {
      return false;
    }
  }

  return null; // Ambiguous — graceful degradation
}
