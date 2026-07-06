import 'package:flutter/material.dart';

/// Palette โทน dark ที่ตกลงกันในขั้นออกแบบ
/// contrast ของข้อความบนพื้นผ่าน WCAG AA (>= 4.5:1)
class AppColors {
  AppColors._();

  // พื้นหลัง / พื้นผิว
  static const Color base = Color(0xFF0E1613); // ดำอมเขียว teal ไม่ดำสนิท
  static const Color surface = Color(0xFF16211E); // การ์ด
  static const Color surfaceHigh = Color(0xFF1E2C28); // การ์ดยกสูง / sheet
  static const Color divider = Color(0xFF26332F);

  // ข้อความ
  static const Color ink = Color(0xFFECF1EE); // ข้อความหลัก
  static const Color muted = Color(0xFF8FA39D); // ข้อความรอง

  // แบรนด์
  static const Color trust = Color(0xFF2DD4BF); // teal สว่างสำหรับพื้นมืด
  static const Color onTrust = Color(0xFF06231F);

  // ความหมายทางการเงิน — คู่กับเครื่องหมาย/ไอคอนเสมอ (สีไม่ใช่ตัวชี้วัดเดียว)
  static const Color income = Color(0xFF34D399); // รายรับ ▲
  static const Color expense = Color(0xFFFB923C); // รายจ่าย ▼ (ส้มอุ่น ไม่ใช่แดงตกใจ)

  static const Color danger = Color(0xFFF87171); // ใช้เฉพาะ error/ลบจริง ๆ
}
