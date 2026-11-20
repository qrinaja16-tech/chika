/**
 * Natural Language Parser for Indonesian Personal Finance
 * Handles AI (Gemini) and Rule-based Regex extraction
 */

// Helper: Parse Indonesian amount strings (e.g., 25rb, 25k, 5jt, 1.5jt, 50000, 50.000, Rp 25.000)
export function parseIndonesianAmount(text) {
    if (!text) return null;
    const clean = text.toLowerCase().trim();

    // Match juta / jt (e.g., 5jt, 1.5jt, 2,5 juta)
    const jtMatch = clean.match(/([\d]+(?:[.,]\d+)?)\s*(?:jt|juta)\b/i);
    if (jtMatch) {
        const val = parseFloat(jtMatch[1].replace(',', '.'));
        return Math.round(val * 1000000);
    }

    // Match ribu / rb / k (e.g., 25rb, 25k, 150 ribu)
    const rbMatch = clean.match(/([\d]+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/i);
    if (rbMatch) {
        const val = parseFloat(rbMatch[1].replace(',', '.'));
        return Math.round(val * 1000);
    }

    // Match plain numbers or formatted with dots / commas (e.g. Rp 25.000, 25000, 150.000)
    const numMatch = clean.match(/(?:rp\.?\s*)?([\d]{1,3}(?:\.[\d]{3})+|[\d]{4,})/i);
    if (numMatch) {
        const valStr = numMatch[1].replace(/\./g, '');
        const val = parseInt(valStr, 10);
        if (!isNaN(val) && val > 0) return val;
    }

    // Fallback: simple digits
    const digitsMatch = clean.match(/\b(\d+)\b/);
    if (digitsMatch) {
        const val = parseInt(digitsMatch[1], 10);
        if (!isNaN(val) && val > 0) return val;
    }

    return null;
}

// Format number to Rupiah string
export function formatRupiah(number) {
    return 'Rp ' + Number(number || 0).toLocaleString('id-ID');
}

// Category inference based on keywords
export function inferCategory(text) {
    const t = text.toLowerCase();

    if (/(kopi|makan|minum|sarapan|lunch|dinner|resto|warung|cafe|mie|bakso|ayam|nasi|snack|jajan|gofood|grabfood|shopeefood)/i.test(t)) {
        return 'Makanan & Minuman';
    }
    if (/(bensin|bbm|pertalite|pertamax|ojol|gojek|grab|maxim|taksi|parkir|tol|kereta|krl|mrt|busway|angkut)/i.test(t)) {
        return 'Transportasi';
    }
    if (/(skincare|serum|sunscreen|facial|makeup|salon|lipstik|bedak|creambath|parfum|lotion)/i.test(t)) {
        return 'Skincare & Perawatan';
    }
    if (/(belanja|baju|sepatu|celana|tas|shopee|tokopedia|lazada|tiktok shop|indomaret|alfamart|superindo)/i.test(t)) {
        return 'Belanja';
    }
    if (/(listrik|pln|token|wifi|indihome|pdam|air|pulsa|paket data|kuota|bpjs|netflix|spotify|youtube|iuran)/i.test(t)) {
        return 'Tagihan & Langganan';
    }
    if (/(nonton|bioskop|cinema|game|steam|topup|liburan|hotel|staycation|wisata|karaoke)/i.test(t)) {
        return 'Hiburan & Rekreasi';
    }
    if (/(obat|dokter|klinik|apotek|vitamin|rs|rumah sakit|dental|gigi)/i.test(t)) {
        return 'Kesehatan';
    }
    if (/(buku|kursus|seminar|pelatihan|udemy|kuliah|spp)/i.test(t)) {
        return 'Edukasi';
    }
    if (/(gaji|gajian|salary|fee|freelance|bonus|cuan|dividen|profit|hasil usaha|jual)/i.test(t)) {
        return 'Gaji & Pendapatan';
    }
    if (/(infaq|sedekah|donasi|zakat|hadiah|kado)/i.test(t)) {
        return 'Amal & Hadiah';
    }
    return 'Lainnya';
}

// Wallet normalizer
export function normalizeWallet(name, availableWallets = []) {
    if (!name) return null;
    const n = name.toLowerCase().trim();

    // Check exact or partial match from available wallets
    for (const w of availableWallets) {
        if (w.name.toLowerCase() === n || w.id.toLowerCase() === n) return w;
    }

    if (n.includes('seabank') || n.includes('sea bank') || n.includes('sea')) {
        return availableWallets.find(w => w.name.toLowerCase().includes('seabank')) || { id: 'w_seabank', name: 'SeaBank' };
    }
    if (n.includes('dana')) {
        return availableWallets.find(w => w.name.toLowerCase().includes('dana')) || { id: 'w_dana', name: 'DANA' };
    }
    if (n.includes('cash') || n.includes('tunai') || n.includes('kantong') || n.includes('dompet')) {
        return availableWallets.find(w => w.name.toLowerCase().includes('cash')) || { id: 'w_cash', name: 'Cash' };
    }
    if (n.includes('bca')) {
        return availableWallets.find(w => w.name.toLowerCase().includes('bca')) || { id: 'w_bca', name: 'BCA' };
    }
    if (n.includes('gopay')) {
        return availableWallets.find(w => w.name.toLowerCase().includes('gopay')) || { id: 'w_gopay', name: 'GoPay' };
    }
    if (n.includes('ovo')) {
        return availableWallets.find(w => w.name.toLowerCase().includes('ovo')) || { id: 'w_ovo', name: 'OVO' };
    }
    if (n.includes('shopeepay') || n.includes('spay')) {
        return availableWallets.find(w => w.name.toLowerCase().includes('shopee')) || { id: 'w_shopee', name: 'ShopeePay' };
    }

    return availableWallets[0] || { id: 'w_cash', name: 'Cash' };
}

/**
 * Intelligent Rule-based NLP Parser for Indonesian WhatsApp messages
 */
export function parseWithRegex(text, availableWallets = []) {
    const raw = text.trim();
    const lower = raw.toLowerCase();

    // 1. Check for Query / Command: Cek Saldo / Laporan
    if (/^(cek saldo|saldo|cek|dompet|balance|info saldo)/i.test(lower)) {
        return {
            intent: 'CHECK_BALANCE',
            raw
        };
    }

    if (/^(laporan|rekap|summary|laporan hari ini|ringkasan|pengeluaran hari ini)/i.test(lower)) {
        return {
            intent: 'REPORT_TODAY',
            raw
        };
    }

    if (/^(bantuan|help|menu|format|panduan)/i.test(lower)) {
        return {
            intent: 'HELP',
            raw
        };
    }

    // Extract amount
    const amount = parseIndonesianAmount(raw);
    if (!amount) {
        return {
            intent: 'UNKNOWN',
            error: 'Nominal tidak terdeteksi. Contoh format: "beli kopi 25rb pake dana" atau "gajian 5jt masuk seabank"',
            raw
        };
    }

    // 2. Check for Transfer: e.g. "tarik tunai dari seabank ke cash 300rb", "transfer 100rb dari dana ke seabank"
    const transferMatch = lower.match(/(?:tarik tunai|transfer|tf|pindah(?:kan)?|kirim uang|geser)(?:\s+(?:sebesar\s+)?[\w.,]+)?\s+(?:dari\s+)?([a-z0-9\s]+?)\s+(?:ke|menuju)\s+([a-z0-9\s]+)/i);
    const altTransfer = lower.match(/(?:dari\s+)([a-z0-9]+)\s+(?:ke\s+)([a-z0-9]+)/i);

    if (transferMatch || altTransfer) {
        const fromRaw = (transferMatch ? transferMatch[1] : altTransfer[1]).replace(/dari|sebesar|nominal/gi, '').trim();
        const toRaw = (transferMatch ? transferMatch[2] : altTransfer[2]).replace(/sebesar|nominal|rp/gi, '').trim();

        const sourceWallet = normalizeWallet(fromRaw, availableWallets);
        const targetWallet = normalizeWallet(toRaw, availableWallets);

        let note = raw;
        if (/tarik tunai/i.test(raw)) {
            note = 'Tarik Tunai';
        } else {
            note = `Transfer dari ${sourceWallet.name} ke ${targetWallet.name}`;
        }

        return {
            intent: 'TRANSACTION',
            type: 'transfer',
            amount,
            wallet: sourceWallet.name,
            walletId: sourceWallet.id,
            target_wallet: targetWallet.name,
            targetWalletId: targetWallet.id,
            category: 'Transfer Antar-Dompet',
            notes: note,
            raw
        };
    }

    // 3. Check for Income: e.g. "gajian 5jt masuk seabank", "dapat transfer 200rb di bca", "pemasukan 500rb cash"
    const isIncome = /(masuk|gajian|gaji|terima|dapat|cuan|bonus|pemasukan|income|nambah)/i.test(lower);
    if (isIncome) {
        // Detect wallet
        let wallet = null;
        if (/seabank|sea bank/i.test(lower)) wallet = normalizeWallet('seabank', availableWallets);
        else if (/dana/i.test(lower)) wallet = normalizeWallet('dana', availableWallets);
        else if (/cash|tunai/i.test(lower)) wallet = normalizeWallet('cash', availableWallets);
        else if (/bca/i.test(lower)) wallet = normalizeWallet('bca', availableWallets);
        else if (/gopay/i.test(lower)) wallet = normalizeWallet('gopay', availableWallets);
        else if (/ovo/i.test(lower)) wallet = normalizeWallet('ovo', availableWallets);
        else if (/shopee/i.test(lower)) wallet = normalizeWallet('shopeepay', availableWallets);
        else wallet = normalizeWallet('cash', availableWallets);

        // Clean notes
        let notes = raw.replace(/(masuk|ke|pake|pakai|di|sebesar|sebank|seabank|dana|cash|bca|gopay|ovo)\b/gi, '').trim();
        if (!notes) notes = 'Pemasukan';

        return {
            intent: 'TRANSACTION',
            type: 'income',
            amount,
            wallet: wallet.name,
            walletId: wallet.id,
            target_wallet: null,
            targetWalletId: null,
            category: inferCategory(raw),
            notes: notes.charAt(0).toUpperCase() + notes.slice(1),
            raw
        };
    }

    // 4. Default: Expense: e.g. "beli kopi 25rb pake dana", "bensin 30rb cash", "makan siang 45rb"
    let wallet = null;
    if (/pake\s+dana|pakai\s+dana|\bdana\b/i.test(lower)) wallet = normalizeWallet('dana', availableWallets);
    else if (/pake\s+seabank|pakai\s+seabank|\bseabank\b|\bsea\s+bank\b/i.test(lower)) wallet = normalizeWallet('seabank', availableWallets);
    else if (/pake\s+cash|pakai\s+cash|\bcash\b|\btunai\b/i.test(lower)) wallet = normalizeWallet('cash', availableWallets);
    else if (/bca/i.test(lower)) wallet = normalizeWallet('bca', availableWallets);
    else if (/gopay/i.test(lower)) wallet = normalizeWallet('gopay', availableWallets);
    else if (/ovo/i.test(lower)) wallet = normalizeWallet('ovo', availableWallets);
    else if (/shopee/i.test(lower)) wallet = normalizeWallet('shopeepay', availableWallets);
    else {
        // Default to Cash or first wallet
        wallet = normalizeWallet('cash', availableWallets);
    }

    // Extract notes by removing amount and wallet keywords
    let cleanNotes = raw
        .replace(/(pake|pakai|lewat|via|dari|menggunakan)\s+(dana|seabank|cash|tunai|bca|gopay|ovo|spay)/gi, '')
        .replace(/\b(dana|seabank|cash|tunai|bca|gopay|ovo)\b/gi, '')
        .replace(/([\d]+(?:[.,]\d+)?)\s*(?:jt|juta|rb|ribu|k)\b/gi, '')
        .replace(/(?:rp\.?\s*)?([\d]{1,3}(?:\.[\d]{3})+|[\d]{3,})/gi, '')
        .trim();

    if (!cleanNotes) cleanNotes = 'Pengeluaran';

    return {
        intent: 'TRANSACTION',
        type: 'expense',
        amount,
        wallet: wallet.name,
        walletId: wallet.id,
        target_wallet: null,
        targetWalletId: null,
        category: inferCategory(raw),
        notes: cleanNotes.charAt(0).toUpperCase() + cleanNotes.slice(1),
        raw
    };
}

/**
 * AI Parser using Google Gemini API (if GEMINI_API_KEY is configured)
 */
export async function parseWithGemini(text, apiKey, availableWallets = []) {
    if (!apiKey) {
        return parseWithRegex(text, availableWallets);
    }

    const walletNames = availableWallets.map(w => w.name).join(', ') || 'Cash, DANA, SeaBank';

    const systemPrompt = `You are a financial natural language transaction parser for Indonesian text.
Your task is to parse user input into structured JSON.
Available wallets in this system: [${walletNames}].

If the user wants to check balance (e.g. "cek saldo", "info saldo"), return:
{"intent": "CHECK_BALANCE"}

If the user wants today's report (e.g. "laporan", "rekap hari ini"), return:
{"intent": "REPORT_TODAY"}

If the user asks for help (e.g. "bantuan", "help"), return:
{"intent": "HELP"}

If the input is a financial transaction, extract:
- "intent": "TRANSACTION"
- "type": "income" | "expense" | "transfer"
- "amount": integer (e.g., 25rb = 25000, 5jt = 5000000, 1.5jt = 1500000)
- "wallet": string (matching one of available wallets, or best guess like "Cash", "DANA", "SeaBank")
- "target_wallet": string or null (only if type is "transfer", e.g. "Cash")
- "category": string (e.g., "Makanan & Minuman", "Transportasi", "Skincare & Perawatan", "Belanja", "Tagihan & Langganan", "Gaji & Pendapatan", "Transfer Antar-Dompet", etc.)
- "notes": string (short clean description of the item/purpose)

Return ONLY valid JSON without markdown fences.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { text: `User message: "${text}"` }
                    ]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.1
                }
            })
        });

        if (!response.ok) {
            console.warn('Gemini API call failed, falling back to Regex parser:', response.status);
            return parseWithRegex(text, availableWallets);
        }

        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawContent) return parseWithRegex(text, availableWallets);

        const parsed = JSON.parse(rawContent);

        // Normalize wallets to IDs
        if (parsed.intent === 'TRANSACTION') {
            const wObj = normalizeWallet(parsed.wallet, availableWallets);
            parsed.wallet = wObj.name;
            parsed.walletId = wObj.id;

            if (parsed.type === 'transfer' && parsed.target_wallet) {
                const twObj = normalizeWallet(parsed.target_wallet, availableWallets);
                parsed.target_wallet = twObj.name;
                parsed.targetWalletId = twObj.id;
            }
        }

        parsed.raw = text;
        return parsed;
    } catch (err) {
        console.warn('Error with Gemini parser, falling back to Regex:', err.message);
        return parseWithRegex(text, availableWallets);
    }
}

