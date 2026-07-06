import 'package:flutter/foundation.dart';

import '../models/bill.dart';
import '../models/category.dart';
import '../models/transaction.dart';
import '../services/notification_service.dart';
import '../utils/thai_date.dart';
import 'app_database.dart';

/// ยอดสรุปของเดือน
class MonthSummary {
  const MonthSummary({
    required this.income,
    required this.expense,
    required this.byCategory,
  });

  final double income;
  final double expense;

  /// รายจ่ายแยกตาม categoryId -> ยอดรวม
  final Map<String, double> byCategory;

  double get balance => income - expense;

  factory MonthSummary.empty() =>
      const MonthSummary(income: 0, expense: 0, byCategory: {});
}

/// แหล่งข้อมูลกลาง + state (ChangeNotifier สำหรับ provider)
class FinanceStore extends ChangeNotifier {
  final _db = AppDatabase.instance;

  List<TxRecord> _transactions = [];
  List<Bill> _bills = [];
  bool _loaded = false;

  List<TxRecord> get transactions => _transactions;
  List<Bill> get bills => _bills;
  bool get loaded => _loaded;

  Future<void> load() async {
    final db = await _db.database;
    final txRows = await db.query('transactions', orderBy: 'date DESC, id DESC');
    final billRows = await db.query('bills', orderBy: 'due_day ASC');
    _transactions = txRows.map(TxRecord.fromMap).toList();
    _bills = billRows.map(Bill.fromMap).toList();
    _loaded = true;
    notifyListeners();
    _syncNotifications();
  }

  /// ตั้งการแจ้งเตือนใหม่จากสถานะบิลปัจจุบัน (เรียกทุกครั้งที่บิลเปลี่ยน)
  void _syncNotifications() {
    // ไม่ await — ให้ทำงานเบื้องหลัง ไม่บล็อก UI
    NotificationService.instance.rescheduleAll(_bills);
  }

  // ---------- transactions ----------

  Future<TxRecord> addTransaction(TxRecord tx) async {
    final db = await _db.database;
    final map = tx.toMap()..remove('id');
    final id = await db.insert('transactions', map);
    final saved = tx.copyWith(id: id);
    _transactions.insert(0, saved);
    _sortTransactions();
    notifyListeners();
    return saved;
  }

  Future<void> deleteTransaction(int id) async {
    final db = await _db.database;
    await db.delete('transactions', where: 'id = ?', whereArgs: [id]);
    _transactions.removeWhere((t) => t.id == id);
    notifyListeners();
  }

  void _sortTransactions() {
    _transactions.sort((a, b) {
      final byDate = b.date.compareTo(a.date);
      if (byDate != 0) return byDate;
      return (b.id ?? 0).compareTo(a.id ?? 0);
    });
  }

  List<TxRecord> transactionsInMonth(DateTime month) => _transactions
      .where((t) => ThaiDate.isSameMonth(t.date, month))
      .toList();

  MonthSummary summaryFor(DateTime month) {
    double income = 0;
    double expense = 0;
    final byCat = <String, double>{};
    for (final t in transactionsInMonth(month)) {
      if (t.type == TxType.income) {
        income += t.amount;
      } else {
        expense += t.amount;
        byCat.update(t.categoryId, (v) => v + t.amount,
            ifAbsent: () => t.amount);
      }
    }
    return MonthSummary(income: income, expense: expense, byCategory: byCat);
  }

  // ---------- bills ----------

  Future<Bill> upsertBill(Bill bill) async {
    final db = await _db.database;
    if (bill.id == null) {
      final id = await db.insert('bills', bill.toMap()..remove('id'));
      final withId = Bill.fromMap(bill.toMap()..['id'] = id);
      _bills.add(withId);
      _bills.sort((a, b) => a.dueDay.compareTo(b.dueDay));
      notifyListeners();
      _syncNotifications();
      return withId;
    } else {
      await db.update('bills', bill.toMap(),
          where: 'id = ?', whereArgs: [bill.id]);
      final i = _bills.indexWhere((b) => b.id == bill.id);
      if (i >= 0) _bills[i] = bill;
      notifyListeners();
      _syncNotifications();
      return bill;
    }
  }

  Future<void> deleteBill(int id) async {
    final db = await _db.database;
    await db.delete('bills', where: 'id = ?', whereArgs: [id]);
    _bills.removeWhere((b) => b.id == id);
    notifyListeners();
    _syncNotifications();
  }

  /// กด "จ่ายแล้ว" ที่บิลของงวด [month]:
  ///  1) สร้างรายการรายจ่ายจริง (ผูก billId)
  ///  2) mark งวดนั้นว่าจ่ายแล้ว -> หยุดเตือนที่เหลือ
  Future<void> payBill(Bill bill, {required double amount, DateTime? month}) async {
    final m = month ?? DateTime.now();
    final tx = TxRecord(
      amount: amount,
      date: DateTime.now(),
      categoryId: bill.categoryId,
      type: TxType.expense,
      note: bill.name,
      billId: bill.id,
    );
    await addTransaction(tx);

    final updated = bill.copyWith(
      paidPeriods: {...bill.paidPeriods, Bill.periodKey(m)},
    );
    await upsertBill(updated);
  }

  // ---------- backup ----------

  /// รวมข้อมูลทั้งหมดเป็น map สำหรับ export เป็น JSON
  Map<String, Object?> exportData() => {
        'version': 1,
        'exportedAt': DateTime.now().toIso8601String(),
        'transactions': _transactions.map((t) => t.toMap()).toList(),
        'bills': _bills.map((b) => b.toMap()).toList(),
      };

  /// ล้างข้อมูลเดิมทั้งหมดแล้วนำเข้าจาก map (restore)
  Future<void> importReplace(Map<String, Object?> data) async {
    final db = await _db.database;
    final txList = (data['transactions'] as List?) ?? const [];
    final billList = (data['bills'] as List?) ?? const [];

    await db.transaction((txn) async {
      await txn.delete('transactions');
      await txn.delete('bills');
      for (final m in txList) {
        final map = Map<String, Object?>.from(m as Map)..remove('id');
        await txn.insert('transactions', map);
      }
      for (final m in billList) {
        final map = Map<String, Object?>.from(m as Map)..remove('id');
        await txn.insert('bills', map);
      }
    });
    await load();
  }

  /// บิลที่ยังไม่จ่ายของเดือนนี้ เรียงตามวันครบกำหนด
  List<Bill> upcomingBills(DateTime month) {
    final list = _bills
        .where((b) => b.active && !b.isPaidFor(month))
        .toList()
      ..sort((a, b) => a.dueDateFor(month).compareTo(b.dueDateFor(month)));
    return list;
  }
}
