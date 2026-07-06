import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// เปิด/สร้างฐานข้อมูล SQLite ในเครื่อง
class AppDatabase {
  AppDatabase._();
  static final AppDatabase instance = AppDatabase._();

  Database? _db;

  Future<Database> get database async {
    return _db ??= await _open();
  }

  Future<Database> _open() async {
    final dir = await getDatabasesPath();
    final path = p.join(dir, 'money_app.db');
    return openDatabase(
      path,
      version: 1,
      onConfigure: (db) => db.execute('PRAGMA foreign_keys = ON'),
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        date INTEGER NOT NULL,
        category_id TEXT NOT NULL,
        type TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        payment_method TEXT NOT NULL DEFAULT 'cash',
        bill_id INTEGER
      )
    ''');
    await db.execute('CREATE INDEX idx_tx_date ON transactions(date)');

    await db.execute('''
      CREATE TABLE bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        category_id TEXT NOT NULL,
        due_day INTEGER NOT NULL,
        recurrence TEXT NOT NULL DEFAULT 'monthly',
        reminders TEXT NOT NULL DEFAULT '3,1',
        active INTEGER NOT NULL DEFAULT 1,
        paid_periods TEXT NOT NULL DEFAULT ''
      )
    ''');
  }
}
