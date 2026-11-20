import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    parseWithRegex,
    parseWithGemini,
    formatRupiah
} from './nlpParser.js';

import {
    seedDatabaseIfEmpty,
    getWalletsList,
    getTransactionsList,
    getGoalsList,
    recordTransaction,
    buildTransactionReply,
    buildBalanceReply,
    buildTodayReportReply,
    buildHelpReply,
    fetchJson
} from './firebaseService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(__dirname));

// Explicit route handlers for root and main HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/finance', (req, res) => {
    res.sendFile(path.join(__dirname, 'finance.html'));
});

app.get('/finance.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'finance.html'));
});

app.get('/real', (req, res) => {
    res.sendFile(path.join(__dirname, 'real.html'));
});

app.get('/real.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'real.html'));
});

// Seed database on startup
seedDatabaseIfEmpty().catch(err => console.error('Seed error:', err));

// ==========================================
// 1. HEALTH & STATUS
// ==========================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Chika Personal Finance Hub & WhatsApp Bot',
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// 2. REST API FOR FRONTEND
// ==========================================
app.get('/api/wallets', async (req, res) => {
    try {
        const wallets = await getWalletsList();
        res.json({ success: true, data: wallets });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/wallets', async (req, res) => {
    try {
        const { name, type, balance, color, icon, accountNumber } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Nama dompet wajib diisi' });

        const id = 'w_' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).substring(2, 6);
        const newWallet = {
            id,
            name,
            type: type || 'other',
            balance: parseInt(balance, 10) || 0,
            color: color || '#10B981',
            icon: icon || 'wallet',
            accountNumber: accountNumber || '-',
            createdAt: Date.now()
        };

        await fetchJson(`wallets/${id}`, {
            method: 'PUT',
            body: JSON.stringify(newWallet)
        });

        res.json({ success: true, data: newWallet });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/transactions', async (req, res) => {
    try {
        const transactions = await getTransactionsList();
        res.json({ success: true, data: transactions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/transactions', async (req, res) => {
    try {
        const result = await recordTransaction(req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.delete('/api/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const tx = await fetchJson(`transactions/${id}`);
        if (!tx) return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan' });

        // Revert wallet balances
        const wallets = (await fetchJson('wallets')) || {};
        const updates = {};

        if (tx.type === 'income' && wallets[tx.walletId]) {
            wallets[tx.walletId].balance = (wallets[tx.walletId].balance || 0) - tx.amount;
            updates[`wallets/${tx.walletId}/balance`] = wallets[tx.walletId].balance;
        } else if (tx.type === 'expense' && wallets[tx.walletId]) {
            wallets[tx.walletId].balance = (wallets[tx.walletId].balance || 0) + tx.amount;
            updates[`wallets/${tx.walletId}/balance`] = wallets[tx.walletId].balance;
        } else if (tx.type === 'transfer') {
            if (wallets[tx.walletId]) {
                wallets[tx.walletId].balance = (wallets[tx.walletId].balance || 0) + tx.amount;
                updates[`wallets/${tx.walletId}/balance`] = wallets[tx.walletId].balance;
            }
            if (wallets[tx.targetWalletId]) {
                wallets[tx.targetWalletId].balance = (wallets[tx.targetWalletId].balance || 0) - tx.amount;
                updates[`wallets/${tx.targetWalletId}/balance`] = wallets[tx.targetWalletId].balance;
            }
        }

        updates[`transactions/${id}`] = null; // Delete
        await fetchJson('', { method: 'PATCH', body: JSON.stringify(updates) });

        res.json({ success: true, message: 'Transaksi berhasil dihapus dan saldo disesuaikan' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/goals', async (req, res) => {
    try {
        const goals = await getGoalsList();
        res.json({ success: true, data: goals });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/goals', async (req, res) => {
    try {
        const { name, targetAmount, deadline, color } = req.body;
        if (!name || !targetAmount) {
            return res.status(400).json({ success: false, error: 'Nama target dan nominal target wajib diisi' });
        }
        const id = 'goal_' + Date.now();
        const newGoal = {
            id,
            name,
            targetAmount: parseInt(targetAmount, 10),
            currentAmount: 0,
            deadline: deadline || null,
            color: color || '#8B5CF6',
            createdAt: Date.now()
        };
        await fetchJson(`goals/${id}`, { method: 'PUT', body: JSON.stringify(newGoal) });
        res.json({ success: true, data: newGoal });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/goals/:id/allocate', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, walletId } = req.body;
        const amt = parseInt(amount, 10);
        if (isNaN(amt) || amt <= 0) return res.status(400).json({ success: false, error: 'Nominal tidak valid' });

        const goal = await fetchJson(`goals/${id}`);
        if (!goal) return res.status(404).json({ success: false, error: 'Goal tidak ditemukan' });

        const wallets = (await fetchJson('wallets')) || {};
        const wallet = wallets[walletId];
        if (!wallet) return res.status(400).json({ success: false, error: 'Dompet tidak ditemukan' });

        if ((wallet.balance || 0) < amt) {
            return res.status(400).json({ success: false, error: 'Saldo dompet tidak mencukupi' });
        }

        // Deduct from wallet & add to goal
        wallet.balance -= amt;
        goal.currentAmount = (goal.currentAmount || 0) + amt;

        const updates = {
            [`wallets/${walletId}/balance`]: wallet.balance,
            [`goals/${id}/currentAmount`]: goal.currentAmount
        };

        // Also record as expense/allocation
        const txId = 'tx_goal_' + Date.now();
        updates[`transactions/${txId}`] = {
            id: txId,
            type: 'expense',
            amount: amt,
            walletId,
            walletName: wallet.name,
            category: 'Tabungan & Impian',
            notes: `Alokasi dana untuk target: ${goal.name}`,
            date: new Date().toISOString().split('T')[0],
            createdAt: Date.now()
        };

        await fetchJson('', { method: 'PATCH', body: JSON.stringify(updates) });
        res.json({ success: true, goal, wallet });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 3. WHATSAPP NLP & PROCESSING CORE
// ==========================================
async function processIncomingFinancialMessage(messageText) {
    if (!messageText || !messageText.trim()) {
        return {
            reply: 'Mohon ketik pesan transaksi. Contoh: "beli kopi 25rb pake dana" atau "cek saldo".',
            parsed: null
        };
    }

    const wallets = await getWalletsList();
    const apiKey = process.env.GEMINI_API_KEY;

    let parsed;
    if (apiKey) {
        parsed = await parseWithGemini(messageText, apiKey, wallets);
    } else {
        parsed = parseWithRegex(messageText, wallets);
    }

    // 1. Check Balance
    if (parsed.intent === 'CHECK_BALANCE') {
        const reply = buildBalanceReply(wallets);
        return { reply, parsed };
    }

    // 2. Report Today
    if (parsed.intent === 'REPORT_TODAY') {
        const transactions = await getTransactionsList();
        const reply = buildTodayReportReply(wallets, transactions);
        return { reply, parsed };
    }

    // 3. Help
    if (parsed.intent === 'HELP') {
        const reply = buildHelpReply();
        return { reply, parsed };
    }

    // 4. Financial Transaction
    if (parsed.intent === 'TRANSACTION') {
        try {
            const { transaction, sourceWallet, targetWallet } = await recordTransaction({
                type: parsed.type,
                amount: parsed.amount,
                walletId: parsed.walletId,
                targetWalletId: parsed.targetWalletId,
                category: parsed.category,
                notes: parsed.notes
            });

            // Refresh wallet list for net worth
            const updatedWallets = await getWalletsList();
            const reply = buildTransactionReply(transaction, sourceWallet, targetWallet, updatedWallets);
            return { reply, parsed, transaction, sourceWallet, targetWallet };
        } catch (err) {
            return {
                reply: `❌ *Gagal Menyimpan Transaksi*\nAlasan: ${err.message}`,
                parsed,
                error: err.message
            };
        }
    }

    // Fallback unknown
    return {
        reply: `🤔 *Format Tidak Dikenal*\n\nContoh format yang didukung:\n• _"beli kopi 25rb pake dana"_\n• _"gajian 5jt masuk seabank"_\n• _"tarik tunai dari seabank ke cash 300rb"_\n• _"cek saldo"_`,
        parsed
    };
}

// ==========================================
// 4. WHATSAPP WEBHOOK ENDPOINT
// ==========================================
app.all('/api/webhook/whatsapp', async (req, res) => {
    // Support GET for Webhook Verification (e.g. Meta WhatsApp Cloud API)
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        if (mode && token === (process.env.WA_VERIFY_TOKEN || 'chika_finance_secret')) {
            return res.status(200).send(challenge);
        }
        return res.status(200).json({ message: 'WhatsApp Webhook Endpoint Ready' });
    }

    try {
        const body = req.body || {};
        console.log('Incoming WhatsApp Webhook Payload:', JSON.stringify(body));

        // Extract sender and message text across providers:
        // 1. Fonnte: { sender: '628xxx', message: '...' }
        // 2. Wablas: { phone: '628xxx', message: '...' }
        // 3. WhatsApp Cloud API: { entry: [{ changes: [{ value: { messages: [{ text: { body: '...' } }] } }] }] }
        // 4. Generic: { message: '...', sender: '...' }
        let messageText = '';
        let sender = '';

        if (body.message) {
            messageText = typeof body.message === 'string' ? body.message : body.message.text || '';
            sender = body.sender || body.phone || body.from || '';
        } else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const m = body.entry[0].changes[0].value.messages[0];
            sender = m.from;
            messageText = m.text?.body || '';
        } else if (body.text) {
            messageText = body.text;
            sender = body.sender || '';
        }

        if (!messageText) {
            return res.json({ status: true, message: 'No text message to process' });
        }

        const result = await processIncomingFinancialMessage(messageText);

        // Dynamic check for token from process.env or .env file with override
        dotenv.config({ override: true });
        const fonnteToken = process.env.FONNTE_TOKEN || 'eLTBxrmpUaZDDdoTru8C';

        console.log(`Processing message from ${sender}: "${messageText}"`);

        // If Fonnte token is set, dispatch reply via Fonnte Send API as well
        if (fonnteToken && sender) {
            try {
                const fRes = await fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': fonnteToken.trim(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        target: sender,
                        message: result.reply
                    })
                });
                const fData = await fRes.json();
                console.log('Fonnte auto-reply sent status:', fData.status, fData.detail || '');
            } catch (fErr) {
                console.error('Fonnte dispatch error:', fErr.message);
            }
        }

        // Return response in standard webhook format (Fonnte auto-reply supported formats)
        res.json({
            status: true,
            reply: result.reply,
            response: result.reply,
            message: result.reply,
            parsed: result.parsed,
            sender
        });
    } catch (err) {
        console.error('Webhook processing error:', err);
        res.status(500).json({ status: false, error: err.message });
    }
});

// Simulator endpoint for the web dashboard
app.post('/api/bot-simulate', async (req, res) => {
    try {
        const { message } = req.body;
        const result = await processIncomingFinancialMessage(message);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 Chika Finance Hub Server is running!`);
    console.log(`🌐 Local Web: http://localhost:${PORT}/index.html`);
    console.log(`💼 Finance Dashboard: http://localhost:${PORT}/finance.html`);
    console.log(`📲 WhatsApp Webhook: http://localhost:${PORT}/api/webhook/whatsapp`);
    console.log(`=========================================`);
});

