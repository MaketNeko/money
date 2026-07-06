import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'data/finance_store.dart';
import 'screens/home_screen.dart';
import 'services/notification_service.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService.instance.init();
  runApp(const MoneyApp());
}

class MoneyApp extends StatefulWidget {
  const MoneyApp({super.key});

  @override
  State<MoneyApp> createState() => _MoneyAppState();
}

class _MoneyAppState extends State<MoneyApp> {
  @override
  void initState() {
    super.initState();
    // ขอ permission หลังแอปขึ้นจอ (Android 13+ ต้องมี Activity ก่อน)
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => NotificationService.instance.requestPermission(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => FinanceStore()..load(),
      child: MaterialApp(
        title: 'เงินของฉัน',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        home: const HomeScreen(),
      ),
    );
  }
}
