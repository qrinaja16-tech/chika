/**
 * Firebase Realtime Database Service for Personal Finance Hub
 * Connects directly to https://chika-c61d6-default-rtdb.firebaseio.com
 */

import { formatRupiah } from './nlpParser.js';

const DB_URL = process.env.FIREBASE_DB_URL || 'https://chika-c61d6-default-rtdb.firebaseio.com';

export async function fetchJson(path, options = {}) {
    const url = `${DB_URL}/${path.replace(/^\//, '')}.json`;
    const res = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });
    if (!res.ok) {
        throw new Error(`Firebase request failed (${res.status}): ${await res.text()}`);
    }
    return res.json();
}

/**
 * Seed default wallets, goals, and sample transactions if none exist
 */
export async function seedDatabaseIfEmpty() {
    try {
        const wallets = await fetchJson('wallets');
        if (!wallets || Object.keys(wallets).length === 0) {
            console.log('Seeding initial wallets...');
            const defaultWallets = {
                w_cash: {
                    id: 'w_cash',
                    name: 'Cash',
                    type: 'cash',
                    balance: 0,
                    color: '#10B981', // Emerald
                    icon: 'banknote',
                    accountNumber: 'Dompet Fisik',
                    createdAt: Date.now()
                },
                w_dana: {
                    id: 'w_dana',
                    name: 'DANA',
                    type: 'ewallet',
                    balance: 0,
                    color: '#118EEA', // DANA Blue
                    icon: 'smartphone',
                    accountNumber: '0812-3456-7890',
                    createdAt: Date.now()
                },
                w_seabank: {
                    id: 'w_seabank',
                    name: 'SeaBank',
                    type: 'bank',
                    balance: 0,
                    color: '#FF5722', // SeaBank Orange
                    icon: 'landmark',
                    accountNumber: '9012-3344-5566',
                    createdAt: Date.now()
                }
            };
            await fetchJson('wallets', {
                method: 'PUT',
                body: JSON.stringify(defaultWallets)
            });

            // Initial goals
            const defaultGoals = {
                goal_1: {
                    id: 'goal_1',
                    name: 'Dana Darurat 6 Bulan',
                    targetAmount: 15000000,
                    currentAmount: 4500000,
                    deadline: '2027-06-30',
                    color: '#8B5CF6',
                    createdAt: Date.now()
                },
                goal_2: {
                    id: 'goal_2',
                    name: 'Liburan Akhir Tahun',
                    targetAmount: 5000000,
                    currentAmount: 2000000,
                    deadline: '2026-12-25',
                    color: '#06B6D4',
                    createdAt: Date.now()
                }
            };
            await fetchJson('goals', {
                method: 'PUT',
                body: JSON.stringify(defaultGoals)
            });

            // Database seeded with clean 0 balance
            console.log('Database seeded with 0 balance successfully!');
        }
    } catch (err) {
        console.error('Error during database check/seeding:', err.message);
    }
}

/**
 * Get all wallets as an array
 */
export async function getWalletsList() {
    const data = await fetchJson('wallets');
    if (!data) return [];
    return Object.keys(data).map(key => ({ id: key, ...data[key] }));
}

/**
 * Get all transactions as an array sorted by createdAt desc
 */
export async function getTransactionsList() {
    const data = await fetchJson('transactions');
    if (!data) return [];
    return Object.keys(data)
        .map(key => ({ id: key, ...data[key] }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Get all savings goals
 */
export async function getGoalsList() {
    const data = await fetchJson('goals');
    if (!data) return [];
    return Object.keys(data).map(key => ({ id: key, ...data[key] }));
}

/**
 * Execute a transaction and update wallet balances atomically
 */
export async function recordTransaction({
    type, // 'income' | 'expense' | 'transfer'
    amount,
    walletId,
    targetWalletId = null,
    category,
    notes,
    date = new Date().toISOString().split('T')[0]
}) {
    const amt = parseInt(amount, 10);
    if (isNaN(amt) || amt <= 0) {
        throw new Error('Nominal transaksi tidak valid');
    }

    // Fetch current wallets
    const walletsObj = (await fetchJson('wallets')) || {};
    const sourceWallet = walletsObj[walletId];
    if (!sourceWallet) {
        throw new Error(`Dompet sumber '${walletId}' tidak ditemukan`);
    }

    let targetWallet = null;
    if (type === 'transfer') {
        if (!targetWalletId) {
            throw new Error('Dompet tujuan harus ditentukan untuk transfer');
        }
        if (walletId === targetWalletId) {
            throw new Error('Dompet sumber dan tujuan tidak boleh sama');
        }
        targetWallet = walletsObj[targetWalletId];
        if (!targetWallet) {
            throw new Error(`Dompet tujuan '${targetWalletId}' tidak ditemukan`);
        }
    }

    // Update balances
    const updates = {};
    if (type === 'income') {
        sourceWallet.balance = (sourceWallet.balance || 0) + amt;
        updates[`wallets/${walletId}/balance`] = sourceWallet.balance;
    } else if (type === 'expense') {
        sourceWallet.balance = (sourceWallet.balance || 0) - amt;
        updates[`wallets/${walletId}/balance`] = sourceWallet.balance;
    } else if (type === 'transfer') {
        sourceWallet.balance = (sourceWallet.balance || 0) - amt;
        targetWallet.balance = (targetWallet.balance || 0) + amt;
        updates[`wallets/${walletId}/balance`] = sourceWallet.balance;
        updates[`wallets/${targetWalletId}/balance`] = targetWallet.balance;
    }

    // Generate transaction ID
    const txId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const txRecord = {
        id: txId,
        type,
        amount: amt,
        walletId,
        walletName: sourceWallet.name,
        targetWalletId: targetWallet ? targetWalletId : null,
        targetWalletName: targetWallet ? targetWallet.name : null,
        category: category || (type === 'transfer' ? 'Transfer Antar-Dompet' : 'Lainnya'),
        notes: notes || '',
        date,
        createdAt: Date.now()
    };

    updates[`transactions/${txId}`] = txRecord;

    // Apply updates via Firebase PATCH
    await fetchJson('', {
        method: 'PATCH',
        body: JSON.stringify(updates)
    });

    return {
        transaction: txRecord,
        sourceWallet,
        targetWallet
    };
}

/**
 * Format WhatsApp confirmation message
 */
export function buildTransactionReply(tx, sourceWallet, targetWallet, allWallets) {
    const totalNetWorth = allWallets.reduce((acc, w) => acc + (w.balance || 0), 0);
    const dateStr = new Date().toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let typeTitle = 'Pengeluaran';
    let typeEmoji = '🔴';
    if (tx.type === 'income') {
        typeTitle = 'Pemasukan';
        typeEmoji = '🟢';
    } else if (tx.type === 'transfer') {
        typeTitle = 'Transfer Antar-Dompet';
        typeEmoji = '🔄';
    }

    let detailLines = '';
    if (tx.type === 'transfer') {
        detailLines = [
            `📤 Dari: *${sourceWallet.name}* (Sisa: ${formatRupiah(sourceWallet.balance)})`,
            `📥 Ke: *${targetWallet.name}* (Saldo: ${formatRupiah(targetWallet.balance)})`
        ].join('\n');
    } else {
        detailLines = [
            `💳 Dompet: *${sourceWallet.name}*`,
            `💰 Sisa Saldo: *${formatRupiah(sourceWallet.balance)}*`
        ].join('\n');
    }

    return `✅ *Transaksi Berhasil Dicatat!*
━━━━━━━━━━━━━━━━━━━━
${typeEmoji} Jenis: *${typeTitle}*
💵 Nominal: *${formatRupiah(tx.amount)}*
📁 Kategori: *${tx.category}*
📝 Catatan: *${tx.notes || '-'}*
⏰ Waktu: *${dateStr}*
━━━━━━━━━━━━━━━━━━━━
${detailLines}
🏦 *Total Net Worth: ${formatRupiah(totalNetWorth)}*

_Ketik "cek saldo" untuk melihat semua dompet._`;
}

/**
 * Format Balance summary for WhatsApp
 */
export function buildBalanceReply(wallets) {
    const total = wallets.reduce((acc, w) => acc + (w.balance || 0), 0);
    const walletLines = wallets.map(w => {
        let icon = '💵';
        if (w.type === 'ewallet' || w.name.toLowerCase().includes('dana')) icon = '📱';
        else if (w.type === 'bank' || w.name.toLowerCase().includes('seabank')) icon = '🏦';
        return `${icon} ${w.name}: *${formatRupiah(w.balance)}*`;
    }).join('\n');

    return `📊 *Ringkasan Saldo Dompet*
━━━━━━━━━━━━━━━━━━━━
${walletLines}
━━━━━━━━━━━━━━━━━━━━
💎 *Total Net Worth: ${formatRupiah(total)}*

_Catat transaksi baru dengan kirim pesan, misal:_
• "beli kopi 25rb pake dana"
• "gajian 5jt masuk seabank"
• "tarik tunai dari seabank ke cash 300rb"`;
}

/**
 * Format Daily Report for WhatsApp
 */
export function buildTodayReportReply(wallets, transactions) {
    const today = new Date().toISOString().split('T')[0];
    const todayTx = transactions.filter(t => (t.date === today || (t.createdAt && new Date(t.createdAt).toISOString().split('T')[0] === today)));

    let income = 0;
    let expense = 0;

    todayTx.forEach(t => {
        if (t.type === 'income') income += (t.amount || 0);
        if (t.type === 'expense') expense += (t.amount || 0);
    });

    const net = income - expense;
    const total = wallets.reduce((acc, w) => acc + (w.balance || 0), 0);

    return `📅 *Laporan Keuangan Hari Ini*
(${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })})
━━━━━━━━━━━━━━━━━━━━
🟢 Total Pemasukan: *${formatRupiah(income)}*
🔴 Total Pengeluaran: *${formatRupiah(expense)}*
⚖️ Arus Bersih: *${formatRupiah(net)}*
━━━━━━━━━━━━━━━━━━━━
📝 Jumlah Transaksi: *${todayTx.length} transaksi*
💎 Saldo Keseluruhan: *${formatRupiah(total)}*`;
}

/**
 * Format Help message
 */
export function buildHelpReply() {
    return `🤖 *Panduan WhatsApp Finance Bot*
━━━━━━━━━━━━━━━━━━━━
Kamu bisa mencatat keuangan secara alami dengan chat seperti biasa:

1️⃣ *Pengeluaran:*
• "beli kopi 25rb pake dana"
• "bensin 35k cash"
• "skincare 150.000 seabank"

2️⃣ *Pemasukan:*
• "gajian 5jt masuk seabank"
• "cuan jualan 300rb di dana"
• "terima transfer 500rb cash"

3️⃣ *Transfer Antar-Dompet:*
• "tarik tunai dari seabank ke cash 300rb"
• "transfer 100rb dari dana ke seabank"
• "pindah 500rb dari seabank ke dana"

4️⃣ *Cek Saldo & Laporan:*
• "cek saldo"
• "laporan hari ini"
━━━━━━━━━━━━━━━━━━━━
Data otomatis tersimpan & terupdate di Web Dashboard!`;
}

