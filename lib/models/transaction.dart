import 'category.dart';

enum PaymentMethod { cash, transfer, card }

/// รายการเงิน 1 รายการ (รับ หรือ จ่าย)
class TxRecord {
  TxRecord({
    this.id,
    required this.amount,
    required this.date,
    required this.categoryId,
    required this.type,
    this.note = '',
    this.paymentMethod = PaymentMethod.cash,
    this.billId,
  });

  final int? id;
  final double amount;
  final DateTime date;
  final String categoryId;
  final TxType type;
  final String note;
  final PaymentMethod paymentMethod;

  /// ถ้ารายการนี้เกิดจากการกด "จ่ายแล้ว" ที่บิล จะผูก id ของบิลไว้
  final int? billId;

  Category get category => Categories.resolve(categoryId, type);

  /// ค่าที่ใส่ในยอดสรุป: รายรับเป็นบวก รายจ่ายเป็นลบ
  double get signed => type == TxType.income ? amount : -amount;

  Map<String, Object?> toMap() => {
        'id': id,
        'amount': amount,
        'date': date.millisecondsSinceEpoch,
        'category_id': categoryId,
        'type': type.name,
        'note': note,
        'payment_method': paymentMethod.name,
        'bill_id': billId,
      };

  static TxRecord fromMap(Map<String, Object?> m) => TxRecord(
        id: m['id'] as int?,
        amount: (m['amount'] as num).toDouble(),
        date: DateTime.fromMillisecondsSinceEpoch(m['date'] as int),
        categoryId: m['category_id'] as String,
        type: TxType.values.byName(m['type'] as String),
        note: (m['note'] as String?) ?? '',
        paymentMethod:
            PaymentMethod.values.byName((m['payment_method'] as String?) ?? 'cash'),
        billId: m['bill_id'] as int?,
      );

  TxRecord copyWith({
    int? id,
    double? amount,
    DateTime? date,
    String? categoryId,
    TxType? type,
    String? note,
    PaymentMethod? paymentMethod,
    int? billId,
  }) {
    return TxRecord(
      id: id ?? this.id,
      amount: amount ?? this.amount,
      date: date ?? this.date,
      categoryId: categoryId ?? this.categoryId,
      type: type ?? this.type,
      note: note ?? this.note,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      billId: billId ?? this.billId,
    );
  }
}
