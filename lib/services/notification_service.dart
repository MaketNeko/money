import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../models/bill.dart';
import '../utils/money.dart';
import '../utils/thai_date.dart';

/// จัดการการแจ้งเตือน local (offline) ทั้งหมด — เวลาไทย (Asia/Bangkok)
///
/// การเตือน 3 ชั้น:
///  1) รอบตั้งเองต่อบิล  (reminderDaysBefore) เช่น ล่วงหน้า 7/3/1 วัน
///  2) รอบล็อกทั้งแอป    ต้นเดือน(วันที่ 1) + วันสุดท้ายของเดือน  (สรุปบิลค้าง)
///  3) เตือนลงรายจ่าย    ทุกวันเวลา 20:00
///
/// จ่ายงวดไหนแล้วจะไม่นับงวดนั้น เพราะเรา [rescheduleAll] ใหม่ทุกครั้งที่ข้อมูลเปลี่ยน
class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final _plugin = FlutterLocalNotificationsPlugin();

  static const int _dailyLogId = 900000;
  static const int _hour = 9; // รอบบิล 9:00
  static const int _dailyLogHour = 20; // เตือนลงรายจ่าย 20:00

  static const _billChannel = AndroidNotificationDetails(
    'bills',
    'เตือนบิล',
    channelDescription: 'แจ้งเตือนบิล/ค่าใช้จ่ายประจำที่ใกล้ครบกำหนด',
    importance: Importance.high,
    priority: Priority.high,
  );
  static const _dailyChannel = AndroidNotificationDetails(
    'daily_log',
    'เตือนลงรายจ่าย',
    channelDescription: 'เตือนให้บันทึกรายรับ-รายจ่ายประจำวัน',
    importance: Importance.defaultImportance,
    priority: Priority.defaultPriority,
  );

  bool _ready = false;

  Future<void> init() async {
    if (_ready) return;
    tzdata.initializeTimeZones();
    tz.setLocalLocation(tz.getLocation('Asia/Bangkok'));

    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    );
    await _plugin.initialize(settings);
    _ready = true;
  }

  Future<void> requestPermission() async {
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
    await _plugin
        .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>()
        ?.requestPermissions(alert: true, badge: true, sound: true);
  }

  /// ล้างของเก่าแล้วตั้งใหม่ทั้งหมดจากสถานะบิลปัจจุบัน
  Future<void> rescheduleAll(List<Bill> bills) async {
    if (!_ready) await init();
    await _plugin.cancelAll();

    await _scheduleDailyLog();

    final now = DateTime.now();
    var nid = 1; // running id (cancelAll ทุกครั้งจึงไม่ต้อง stable ข้ามรอบ)

    for (final month in [now, DateTime(now.year, now.month + 1)]) {
      final unpaid =
          bills.where((b) => b.active && !b.isPaidFor(month)).toList();
      if (unpaid.isEmpty) continue;

      // (1) รอบตั้งเองต่อบิล
      for (final b in unpaid) {
        final due = b.dueDateFor(month);
        for (final daysBefore in b.reminderDaysBefore) {
          final when = DateTime(due.year, due.month, due.day - daysBefore,
              _hour);
          nid = await _scheduleAt(
            id: nid,
            when: when,
            title: 'ใกล้ครบกำหนด: ${b.name}',
            body: b.isVariable
                ? 'ครบกำหนด ${ThaiDate.dayMonth(due)} (อีก $daysBefore วัน)'
                : '${Money.baht(b.amount)} · ครบ ${ThaiDate.dayMonth(due)} (อีก $daysBefore วัน)',
            details: _billChannel,
          );
        }
      }

      // (2) รอบล็อกทั้งแอป — ต้นเดือน + วันสุดท้ายของเดือน
      final firstDay = DateTime(month.year, month.month, 1, _hour);
      final lastDay =
          DateTime(month.year, month.month + 1, 0, _hour); // วันที่ 0 ของเดือนถัดไป = วันสุดท้าย
      final total = unpaid.fold<double>(0, (s, b) => s + b.amount);
      final summaryBody =
          'มีบิลค้าง ${unpaid.length} รายการ${total > 0 ? ' รวม ${Money.baht(total)}' : ''}';

      nid = await _scheduleAt(
        id: nid,
        when: firstDay,
        title: 'ต้นเดือนแล้ว — เช็คบิล',
        body: summaryBody,
        details: _billChannel,
      );
      nid = await _scheduleAt(
        id: nid,
        when: lastDay,
        title: 'วันสุดท้ายของเดือน — บิลจ่ายครบยัง?',
        body: summaryBody,
        details: _billChannel,
      );
    }
  }

  /// เตือนลงรายจ่ายทุกวันเวลา 20:00
  Future<void> _scheduleDailyLog() async {
    final next = _nextInstanceOfTime(_dailyLogHour, 0);
    await _plugin.zonedSchedule(
      _dailyLogId,
      'อย่าลืมลงรายจ่ายวันนี้',
      'ใช้เวลาไม่ถึงนาที เปิดแอปแล้วบันทึกเลย',
      next,
      const NotificationDetails(android: _dailyChannel),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      matchDateTimeComponents: DateTimeComponents.time, // ซ้ำทุกวัน
    );
  }

  /// ตั้งเวลา 1 การแจ้งเตือน (ข้ามถ้าเป็นเวลาในอดีต) แล้วคืน id ถัดไป
  Future<int> _scheduleAt({
    required int id,
    required DateTime when,
    required String title,
    required String body,
    required AndroidNotificationDetails details,
  }) async {
    final scheduled = tz.TZDateTime.from(when, tz.local);
    if (scheduled.isBefore(tz.TZDateTime.now(tz.local))) return id;

    await _plugin.zonedSchedule(
      id,
      title,
      body,
      scheduled,
      NotificationDetails(android: details),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
    );
    return id + 1;
  }

  tz.TZDateTime _nextInstanceOfTime(int hour, int minute) {
    final now = tz.TZDateTime.now(tz.local);
    var next = tz.TZDateTime(tz.local, now.year, now.month, now.day, hour, minute);
    if (next.isBefore(now)) next = next.add(const Duration(days: 1));
    return next;
  }
}
