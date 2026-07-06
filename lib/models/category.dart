import 'package:flutter/material.dart';

enum TxType { expense, income }

/// หมวดหมู่ — เก็บใน DB เป็น string (`id`) เพื่อไม่ต้อง migrate ตอนเพิ่มหมวดใหม่
class Category {
  const Category({
    required this.id,
    required this.label,
    required this.icon,
    required this.type,
  });

  final String id;
  final String label;
  final IconData icon;
  final TxType type;
}

/// ชุดหมวดหมู่มาตรฐานแนวไทย (ปรับ/เพิ่ม custom ได้ทีหลัง)
class Categories {
  Categories._();

  static const List<Category> expense = [
    Category(id: 'food', label: 'อาหาร/เครื่องดื่ม', icon: Icons.restaurant, type: TxType.expense),
    Category(id: 'transport', label: 'เดินทาง/น้ำมัน', icon: Icons.directions_car, type: TxType.expense),
    Category(id: 'shopping', label: 'ช้อปปิ้ง/ของใช้', icon: Icons.shopping_bag, type: TxType.expense),
    Category(id: 'bills', label: 'บิล/สาธารณูปโภค', icon: Icons.receipt_long, type: TxType.expense),
    Category(id: 'home', label: 'ที่พัก/ค่าเช่า', icon: Icons.home, type: TxType.expense),
    Category(id: 'health', label: 'สุขภาพ', icon: Icons.medical_services, type: TxType.expense),
    Category(id: 'fun', label: 'บันเทิง/สังสรรค์', icon: Icons.celebration, type: TxType.expense),
    Category(id: 'education', label: 'การศึกษา', icon: Icons.school, type: TxType.expense),
    Category(id: 'savings', label: 'เงินออม/ลงทุน', icon: Icons.savings, type: TxType.expense),
    Category(id: 'other_exp', label: 'อื่นๆ', icon: Icons.category, type: TxType.expense),
  ];

  static const List<Category> income = [
    Category(id: 'salary', label: 'เงินเดือน', icon: Icons.payments, type: TxType.income),
    Category(id: 'bonus', label: 'โบนัส/รายได้พิเศษ', icon: Icons.card_giftcard, type: TxType.income),
    Category(id: 'freelance', label: 'รายได้เสริม/ฟรีแลนซ์', icon: Icons.work, type: TxType.income),
    Category(id: 'dividend', label: 'เงินปันผล/ดอกเบี้ย', icon: Icons.trending_up, type: TxType.income),
    Category(id: 'other_inc', label: 'อื่นๆ', icon: Icons.category, type: TxType.income),
  ];

  static List<Category> of(TxType type) =>
      type == TxType.expense ? expense : income;

  static final Map<String, Category> _byId = {
    for (final c in [...expense, ...income]) c.id: c,
  };

  /// คืน category ตาม id เก็บใน DB (fallback เป็น "อื่นๆ" ถ้าไม่รู้จัก)
  static Category resolve(String id, TxType type) {
    return _byId[id] ??
        (type == TxType.expense ? expense.last : income.last);
  }
}
