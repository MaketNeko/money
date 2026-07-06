/// จัดรูปแบบวันที่แบบไทย — ปีพุทธศักราช (พ.ศ.) + ชื่อเดือนไทย
class ThaiDate {
  ThaiDate._();

  static const List<String> _monthsFull = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];

  static const List<String> _monthsShort = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];

  static int buddhistYear(DateTime d) => d.year + 543;

  /// เช่น "กรกฎาคม 2569"
  static String monthYear(DateTime d) =>
      '${_monthsFull[d.month - 1]} ${buddhistYear(d)}';

  /// เช่น "5 ก.ค. 2569"
  static String dayMonthYear(DateTime d) =>
      '${d.day} ${_monthsShort[d.month - 1]} ${buddhistYear(d)}';

  /// เช่น "5 ก.ค." (ไม่มีปี — ใช้ในลิสต์รายการ)
  static String dayMonth(DateTime d) =>
      '${d.day} ${_monthsShort[d.month - 1]}';

  static bool isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  static bool isSameMonth(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month;
}
