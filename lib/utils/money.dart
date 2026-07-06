import 'package:intl/intl.dart';

/// จัดรูปแบบจำนวนเงินบาท
class Money {
  Money._();

  static final NumberFormat _plain = NumberFormat('#,##0.##', 'en_US');
  static final NumberFormat _whole = NumberFormat('#,##0', 'en_US');

  /// เช่น "12,480" (ไม่มีสัญลักษณ์ ใช้คู่กับ ฿ ที่วางแยกในดีไซน์)
  static String format(double v) {
    // ถ้าเป็นจำนวนเต็มไม่ต้องโชว์ทศนิยม
    return v == v.roundToDouble() ? _whole.format(v) : _plain.format(v);
  }

  /// เช่น "฿12,480"
  static String baht(double v) => '฿${format(v)}';

  /// เช่น "+฿25,000" / "−฿55" (ใช้ minus จริง U+2212 ให้สวยกว่า hyphen)
  static String signed(double v) {
    final sign = v >= 0 ? '+' : '−';
    return '$sign฿${format(v.abs())}';
  }
}
