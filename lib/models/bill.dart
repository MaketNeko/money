enum Recurrence { monthly, yearly, once }

/// บิล/ค่าใช้จ่ายประจำที่ต้องเตือน
///
/// การเตือนมี 2 ชั้น:
///  - [reminderDaysBefore]  รอบตั้งเองได้หลายรอบ (เช่น [7, 3, 1])
///  - รอบล็อกทั้งแอป (ต้นเดือน + วันสุดท้ายของเดือน) จัดการที่ตัว scheduler ไม่เก็บในนี้
///
/// เมื่อกด "จ่ายแล้ว" ของงวดไหน จะบันทึก period ("YYYY-MM") ลง [paidPeriods]
/// แล้วหยุดเตือนทุกรอบของงวดนั้น
class Bill {
  Bill({
    this.id,
    required this.name,
    required this.amount,
    required this.categoryId,
    required this.dueDay,
    this.recurrence = Recurrence.monthly,
    List<int>? reminderDaysBefore,
    this.active = true,
    Set<String>? paidPeriods,
  })  : reminderDaysBefore = reminderDaysBefore ?? const [3, 1],
        paidPeriods = paidPeriods ?? <String>{};

  final int? id;
  final String name;

  /// 0 = จำนวนผันแปร (เช่น ค่าไฟ) ให้กรอกตอนกดจ่าย
  final double amount;
  final String categoryId;

  /// ครบกำหนดวันที่เท่าไรของเดือน (1–31; ถ้าเดือนสั้นกว่าจะ clamp)
  final int dueDay;
  final Recurrence recurrence;
  final List<int> reminderDaysBefore;
  final bool active;
  final Set<String> paidPeriods;

  bool get isVariable => amount <= 0;

  static String periodKey(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}';

  bool isPaidFor(DateTime month) => paidPeriods.contains(periodKey(month));

  /// วันครบกำหนดของเดือนที่ระบุ (clamp วันให้ไม่เกินจำนวนวันของเดือน)
  DateTime dueDateFor(DateTime month) {
    final lastDay = DateTime(month.year, month.month + 1, 0).day;
    return DateTime(month.year, month.month, dueDay.clamp(1, lastDay));
  }

  Map<String, Object?> toMap() => {
        'id': id,
        'name': name,
        'amount': amount,
        'category_id': categoryId,
        'due_day': dueDay,
        'recurrence': recurrence.name,
        'reminders': reminderDaysBefore.join(','),
        'active': active ? 1 : 0,
        'paid_periods': paidPeriods.join(','),
      };

  static Bill fromMap(Map<String, Object?> m) => Bill(
        id: m['id'] as int?,
        name: m['name'] as String,
        amount: (m['amount'] as num).toDouble(),
        categoryId: m['category_id'] as String,
        dueDay: m['due_day'] as int,
        recurrence: Recurrence.values.byName(m['recurrence'] as String),
        reminderDaysBefore: _parseInts(m['reminders'] as String?),
        active: (m['active'] as int) == 1,
        paidPeriods: _parseSet(m['paid_periods'] as String?),
      );

  static List<int> _parseInts(String? s) {
    if (s == null || s.isEmpty) return const [3, 1];
    return s.split(',').map(int.parse).toList();
  }

  static Set<String> _parseSet(String? s) {
    if (s == null || s.isEmpty) return <String>{};
    return s.split(',').toSet();
  }

  Bill copyWith({
    String? name,
    double? amount,
    String? categoryId,
    int? dueDay,
    Recurrence? recurrence,
    List<int>? reminderDaysBefore,
    bool? active,
    Set<String>? paidPeriods,
  }) {
    return Bill(
      id: id,
      name: name ?? this.name,
      amount: amount ?? this.amount,
      categoryId: categoryId ?? this.categoryId,
      dueDay: dueDay ?? this.dueDay,
      recurrence: recurrence ?? this.recurrence,
      reminderDaysBefore: reminderDaysBefore ?? this.reminderDaysBefore,
      active: active ?? this.active,
      paidPeriods: paidPeriods ?? this.paidPeriods,
    );
  }
}
