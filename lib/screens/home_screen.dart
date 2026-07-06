import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/finance_store.dart';
import '../models/bill.dart';
import '../theme/app_colors.dart';
import '../utils/money.dart';
import '../utils/thai_date.dart';
import '../widgets/balance_hero.dart';
import '../widgets/bill_card.dart';
import '../widgets/category_donut.dart';
import '../widgets/transaction_tile.dart';
import 'add_transaction_sheet.dart';
import 'settings_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final store = context.watch<FinanceStore>();

    if (!store.loaded) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.trust)),
      );
    }

    final summary = store.summaryFor(now);
    final monthTx = store.transactionsInMonth(now);
    final upcoming = store.upcomingBills(now);

    return Scaffold(
      appBar: AppBar(
        title: Text(ThaiDate.monthYear(now),
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            tooltip: 'ตั้งค่า',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
            icon: const Icon(Icons.settings_outlined, color: AppColors.muted),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openAddSheet(context),
        icon: const Icon(Icons.add),
        label: const Text('ลงเงิน'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
          children: [
            BalanceHero(summary: summary),
            const SizedBox(height: 20),
            CategoryDonut(summary: summary),
            if (summary.expense > 0) const SizedBox(height: 16),
            if (upcoming.isNotEmpty) ...[
              const _SectionLabel('บิลใกล้ครบกำหนด'),
              const SizedBox(height: 8),
              BillCard(
                bill: upcoming.first,
                month: now,
                onPay: () => _payBill(context, upcoming.first, now),
              ),
              const SizedBox(height: 16),
            ],
            const _SectionLabel('รายการล่าสุด'),
            const SizedBox(height: 4),
            if (monthTx.isEmpty)
              const _EmptyState()
            else
              ...monthTx.map((t) => TransactionTile(
                    tx: t,
                    onDelete: () => store.deleteTransaction(t.id!),
                  )),
          ],
        ),
      ),
    );
  }

  void _openAddSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => const AddTransactionSheet(),
    );
  }

  Future<void> _payBill(BuildContext context, Bill bill, DateTime month) async {
    final store = context.read<FinanceStore>();
    var amount = bill.amount;

    if (bill.isVariable) {
      final entered = await _askAmount(context, bill.name);
      if (entered == null) return;
      amount = entered;
    }
    await store.payBill(bill, amount: amount, month: month);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('จ่าย "${bill.name}" ${Money.baht(amount)} แล้ว')),
      );
    }
  }

  Future<double?> _askAmount(BuildContext context, String name) {
    final controller = TextEditingController();
    return showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceHigh,
        title: Text('จำนวนเงิน $name'),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(prefixText: '฿ ', labelText: 'จำนวน'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('ยกเลิก')),
          FilledButton(
            onPressed: () {
              final v = double.tryParse(controller.text.trim());
              if (v != null && v > 0) Navigator.pop(ctx, v);
            },
            child: const Text('ยืนยัน'),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(
            color: AppColors.muted,
            fontSize: 14,
            fontWeight: FontWeight.w600));
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          const Icon(Icons.receipt_long_outlined,
              size: 40, color: AppColors.muted),
          const SizedBox(height: 12),
          const Text('ยังไม่มีรายการเดือนนี้',
              style: TextStyle(color: AppColors.ink, fontSize: 15)),
          const SizedBox(height: 4),
          Text('แตะปุ่ม "ลงเงิน" เพื่อเริ่มบันทึก',
              style: TextStyle(color: AppColors.muted.withValues(alpha: 0.9))),
        ],
      ),
    );
  }
}
