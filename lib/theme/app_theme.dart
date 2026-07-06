import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// ธีมหลักของแอป — dark mode เป็นหลัก
///
/// ตัวหนังสือ/UI: IBM Plex Sans Thai (glyph ไทยครบ)
/// ตัวเลขเงิน: Lexend + tabular figures (หลักเรียงตรงกัน) -> ใช้ผ่าน [numberStyle]
class AppTheme {
  AppTheme._();

  static ThemeData get dark {
    final base = ThemeData.dark(useMaterial3: true);

    final textTheme = GoogleFonts.ibmPlexSansThaiTextTheme(base.textTheme)
        .apply(bodyColor: AppColors.ink, displayColor: AppColors.ink);

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.base,
      colorScheme: base.colorScheme.copyWith(
        brightness: Brightness.dark,
        primary: AppColors.trust,
        onPrimary: AppColors.onTrust,
        surface: AppColors.surface,
        onSurface: AppColors.ink,
        error: AppColors.danger,
      ),
      textTheme: textTheme,
      dividerColor: AppColors.divider,
      cardTheme: const CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.base,
        foregroundColor: AppColors.ink,
        elevation: 0,
        centerTitle: false,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.trust,
        foregroundColor: AppColors.onTrust,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surfaceHigh,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      listTileTheme: const ListTileThemeData(iconColor: AppColors.muted),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.surfaceHigh,
        contentTextStyle: TextStyle(color: AppColors.ink),
      ),
    );
  }

  /// สไตล์ตัวเลขเงิน — Lexend + tabular figures
  static TextStyle numberStyle({
    required double size,
    FontWeight weight = FontWeight.w600,
    Color color = AppColors.ink,
  }) {
    return GoogleFonts.lexend(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: -0.5,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
  }
}
