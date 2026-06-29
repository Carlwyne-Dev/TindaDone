import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Product, Transaction, TransactionItem, UtangRecord, RestockLog, BusinessSettings, Expense } from './types';

const PRODUCTS_KEY = '@tindadone/products';
const TRANSACTIONS_KEY = '@tindadone/transactions';
const UTANG_KEY = '@tindadone/utang';
const RESTOCKS_KEY = '@tindadone/restocks';
const EXPENSES_KEY = '@tindadone/expenses';
const SETTINGS_KEY = '@tindadone/settings';
const WELCOME_KEY = '@tindadone/welcome_seen';
const PIN_KEY = '@tindadone/pin';

// Partitioning keys
const TRANSACTION_MONTHS_KEY = '@tindadone/transaction_months'; // Index of months YYYY-MM
const TRANS_PARTITION_PREFIX = '@tindadone/transactions/'; // @tindadone/transactions/YYYY-MM


export async function hashPIN(pin: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin
  );
}

export async function getPIN(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(PIN_KEY);
    if (!stored) return null;

    // MIGRATION: If stored PIN is a 4-digit numeric string, it's plaintext.
    // Hashed PINs (SHA-256) are 64 characters long hex strings.
    if (stored.length === 4 && /^\d+$/.test(stored)) {
      const hashed = await hashPIN(stored);
      await AsyncStorage.setItem(PIN_KEY, hashed); // Migrate to hashed version
      return hashed;
    }
    
    return stored;
  } catch (e) {
    console.error('Error fetching PIN:', e);
    return null;
  }
}

export async function savePIN(pin: string): Promise<void> {
  try {
    const hashed = await hashPIN(pin);
    await AsyncStorage.setItem(PIN_KEY, hashed);
  } catch (e) {
    console.error('Error saving PIN:', e);
  }
}
export async function clearPIN(): Promise<void> {
  try { await AsyncStorage.removeItem(PIN_KEY); } catch {}
}

// --- Partitioning Helpers ---

/** Get YYYY-MM from a date or ISO string */
export function getYearMonth(date: string | Date | number): string {
  const d = new Date(date);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${d.getFullYear()}-${month}`;
}

/** Get the AsyncStorage key for a specific month */
export function getPartitionKey(monthKey: string): string {
  return `${TRANS_PARTITION_PREFIX}${monthKey}`;
}

/** Register a month in the master index if not already present */
async function registerMonthInIndex(monthKey: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TRANSACTION_MONTHS_KEY);
    let index: string[] = raw ? JSON.parse(raw) : [];
    if (!index.includes(monthKey)) {
      index.push(monthKey);
      // Sort descending (latest months first)
      index.sort((a, b) => b.localeCompare(a));
      await AsyncStorage.setItem(TRANSACTION_MONTHS_KEY, JSON.stringify(index));
    }
  } catch (e) {
    console.error('Error updating month index:', e);
  }
}

async function getMonthIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(TRANSACTION_MONTHS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const DEFAULT_CATEGORIES = ['Food', 'Drinks', 'Personal Care', 'Household', 'Others'];
export const CATEGORIES = DEFAULT_CATEGORIES; // For backward compatibility in legacy code

const PRESET_PRODUCTS: Array<{name: string, price: number, category: string}> = [];

export async function getProducts(): Promise<Product[]> {
  try {
    const raw = await AsyncStorage.getItem(PRODUCTS_KEY);
    if (!raw) {
      return await seedPresetProducts();
    }
    const items: Product[] = JSON.parse(raw);
    return items; // Show all products including preset ones
  } catch (e) {
    console.error('Error fetching products:', e);
    return [];
  }
}

async function seedPresetProducts(): Promise<Product[]> {
  const products: Product[] = PRESET_PRODUCTS.map((p, index) => ({
    id: `preset-${index}`,
    name: p.name,
    price: p.price,
    category: p.category,
    stock: 0,
    lowStockThreshold: 5,
    unit: 'pc',
    createdAt: new Date().toISOString(),
  }));
  await saveProducts(products);
  return products;
}

export async function saveProducts(products: Product[]): Promise<void> {
  try {
    const data = JSON.stringify(products);
    await AsyncStorage.setItem(PRODUCTS_KEY, data);
  } catch (e) {
    console.error('CRITICAL: Error saving products:', e);
    throw new Error('Failed to save to storage. The image might be too large or disk is full.');
  }
}

export async function addProduct(product: Product): Promise<void> {
  try {
    const products = await getProducts();
    products.unshift(product);
    await saveProducts(products);
  } catch (e) {
    console.error('Error adding product:', e);
    throw e;
  }
}

export async function updateProduct(updated: Product): Promise<void> {
  const products = await getProducts();
  const index = products.findIndex((p) => p.id === updated.id);
  if (index !== -1) {
    products[index] = updated;
    await saveProducts(products);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const products = await getProducts();
  const filtered = products.filter((p) => p.id !== id);
  await saveProducts(filtered);
}

/** One-time migration from monolithic transactions to partitioned storage */
async function migrateLegacyTransactions(): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    if (!legacy) return;

    const all: Transaction[] = JSON.parse(legacy);
    if (all.length === 0) {
      await AsyncStorage.removeItem(TRANSACTIONS_KEY);
      return;
    }

    // Group by month
    const groups: Record<string, Transaction[]> = {};
    for (const t of all) {
      const mk = getYearMonth(t.timestamp);
      if (!groups[mk]) groups[mk] = [];
      groups[mk].push(t);
    }

    // Save each partition and update index
    for (const [mk, trans] of Object.entries(groups)) {
      const key = getPartitionKey(mk);
      // Multi-save logic (Legacy was already newest-first)
      await AsyncStorage.setItem(key, JSON.stringify(trans));
      await registerMonthInIndex(mk);
    }

    // Retire legacy key
    await AsyncStorage.removeItem(TRANSACTIONS_KEY);
    console.info(`MIGRATION: Success. Moved ${all.length} transactions to partitioned storage.`);
  } catch (e) {
    console.error('Migration failed:', e);
  }
}

// Transactions
export async function getTransactions(): Promise<Transaction[]> {
  try {
    // 1. One-time Migration check as we transition
    await migrateLegacyTransactions();

    // 2. Load from partitions via index
    const index = await getMonthIndex();
    if (index.length === 0) return [];

    let allTransactions: Transaction[] = [];
    // Currently loads everything to maintain all-time stats, but partitioned keys match.
    // Optimization: In a real POS, we'd limit this to 'Recent' or 'Current Year' only.
    for (const monthKey of index) {
      const raw = await AsyncStorage.getItem(getPartitionKey(monthKey));
      if (raw) {
        const part: Transaction[] = JSON.parse(raw);
        allTransactions = allTransactions.concat(part);
      }
    }
    return allTransactions;
  } catch (e) {
    console.error('Error fetching partitioned transactions:', e);
    return [];
  }
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  try {
    const products = await getProducts();
    
    // VALIDATION: Check if stock is sufficient for all items
    for (const item of transaction.items) {
      const p = products.find(p => p.id === item.productId);
      if (p) {
        const deduction = item.isPack ? item.qty * (p.piecesPerPack || 1) : item.qty;
        if (p.stock < deduction) {
          throw new Error(`Insufficient stock for ${p.name}. Only ${p.stock} units remaining.`);
        }
      }
    }

    const monthKey = getYearMonth(transaction.timestamp);
    const partitionKey = getPartitionKey(monthKey);
    
    const raw = await AsyncStorage.getItem(partitionKey);
    const transactions: Transaction[] = raw ? JSON.parse(raw) : [];
    
    transactions.unshift(transaction);
    await AsyncStorage.setItem(partitionKey, JSON.stringify(transactions));
    await registerMonthInIndex(monthKey);
    
    // Decrement stock
    transaction.items.forEach(item => {
      const p = products.find(p => p.id === item.productId);
      if (p) {
        const deduction = item.isPack ? item.qty * (p.piecesPerPack || 1) : item.qty;
        p.stock -= deduction;
      }
    });
    await saveProducts(products);
  } catch (e) {
    console.error('Error saving transaction:', e);
    throw e;
  }
}

/**
 * Save a payment/settlement transaction WITHOUT touching stock.
 * Used when a debt is paid — items already left inventory at credit time.
 */
export async function savePaymentTransaction(transaction: Transaction): Promise<void> {
  try {
    const monthKey = getYearMonth(transaction.timestamp);
    const partitionKey = getPartitionKey(monthKey);
    const raw = await AsyncStorage.getItem(partitionKey);
    const transactions: Transaction[] = raw ? JSON.parse(raw) : [];
    transactions.unshift(transaction);
    await AsyncStorage.setItem(partitionKey, JSON.stringify(transactions));
    await registerMonthInIndex(monthKey);
  } catch (e) {
    console.error('Error saving payment transaction:', e);
    throw e;
  }
}

export async function getTodaysTransactions(): Promise<Transaction[]> {
  try {
    const mk = getYearMonth(new Date());
    const raw = await AsyncStorage.getItem(getPartitionKey(mk));
    const transactions: Transaction[] = raw ? JSON.parse(raw) : [];
    const today = new Date().toISOString().split('T')[0];
    return transactions.filter((t) => t.timestamp.startsWith(today));
  } catch {
    return [];
  }
}

export async function voidTransaction(id: string): Promise<void> {
  try {
    const index = await getMonthIndex();
    let foundTrans: Transaction | null = null;
    let foundMK: string | null = null;

    // Search partitions
    for (const mk of index) {
      const key = getPartitionKey(mk);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const trans: Transaction[] = JSON.parse(raw);
        const t = trans.find(tr => tr.id === id);
        if (t) {
          foundTrans = t;
          foundMK = mk;
          break;
        }
      }
    }

    if (!foundTrans || !foundMK) return;

    // 1. Restore Stock
    const products = await getProducts();
    foundTrans.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        const restoration = item.isPack ? item.qty * (p.piecesPerPack || 1) : item.qty;
        p.stock += restoration;
      }
    });
    await saveProducts(products);

    // 2. Remove from storage
    const key = getPartitionKey(foundMK);
    const raw = await AsyncStorage.getItem(key);
    const trans: Transaction[] = raw ? JSON.parse(raw) : [];
    const filtered = trans.filter(t => t.id !== id);
    
    if (filtered.length === 0) {
      // Remove empty partition and update index
      await AsyncStorage.removeItem(key);
      const updatedIndex = index.filter(m => m !== foundMK);
      await AsyncStorage.setItem(TRANSACTION_MONTHS_KEY, JSON.stringify(updatedIndex));
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(filtered));
    }
  } catch (e) {
    console.error('Error voiding transaction:', e);
    throw e;
  }
}

export async function updateTransactionPayment(id: string, type: 'cash' | 'gcash'): Promise<void> {
  try {
    const index = await getMonthIndex();
    for (const mk of index) {
      const key = getPartitionKey(mk);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const trans: Transaction[] = JSON.parse(raw);
        const tIdx = trans.findIndex(tr => tr.id === id);
        if (tIdx !== -1) {
          trans[tIdx].paymentType = type;
          await AsyncStorage.setItem(key, JSON.stringify(trans));
          return;
        }
      }
    }
  } catch (e) {
    console.error('Error updating transaction payment:', e);
    throw e;
  }
}

// Utang (Credit)
export async function getUtangRecords(): Promise<UtangRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(UTANG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error fetching utang:', e);
    return [];
  }
}

/** Merges two lists of transaction items, consolidating quantities for matching product IDs */
function mergeTransactionItems(existing?: TransactionItem[], incoming?: TransactionItem[]): TransactionItem[] | undefined {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const merged = [...existing];
  incoming.forEach(inItem => {
    const foundIdx = merged.findIndex(exItem => exItem.productId === inItem.productId);
    if (foundIdx !== -1) {
      merged[foundIdx] = {
        ...merged[foundIdx],
        qty: merged[foundIdx].qty + inItem.qty
      };
    } else {
      merged.push(inItem);
    }
  });
  return merged;
}

export async function addUtangRecord(record: UtangRecord): Promise<void> {
  const products = await getProducts();
  
  // VALIDATION: Check if stock is sufficient for all items
  if (record.items) {
    for (const item of record.items) {
      const p = products.find(p => p.id === item.productId);
      if (p && p.stock < item.qty) {
        throw new Error(`Insufficient stock for ${p.name}. Only ${p.stock} remaining.`);
      }
    }
  }

  const raw = await AsyncStorage.getItem(UTANG_KEY);
  const records: UtangRecord[] = raw ? JSON.parse(raw) : [];
  
  // SMART MERGE: Check for existing unpaid record with same name
  const existingIdx = records.findIndex(r => 
    !r.isPaid && 
    r.customerName.trim().toLowerCase() === record.customerName.trim().toLowerCase()
  );

  if (existingIdx !== -1) {
    // MERGE logic
    const existing = records[existingIdx];
    existing.amount += record.amount;
    existing.items = mergeTransactionItems(existing.items, record.items);
    if (record.note) {
      existing.note = existing.note ? `${existing.note} | ${record.note}` : record.note;
    }
  } else {
    // NEW record logic
    records.unshift(record);
  }

  await AsyncStorage.setItem(UTANG_KEY, JSON.stringify(records));

  // Decrement stock for the INCOMING items
  if (record.items) {
    record.items.forEach(item => {
      const p = products.find(p => p.id === item.productId);
      if (p) {
        p.stock -= item.qty;
      }
    });
  }
  await saveProducts(products);
}

export async function updateUtangRecord(updated: UtangRecord): Promise<void> {
  try {
    const records = await getUtangRecords();
    const index = records.findIndex((r) => r.id === updated.id);
    if (index === -1) return;

    const oldRecord = records[index];
    const products = await getProducts();

    // 1. REVERSE inventory for old items
    if (oldRecord.items) {
      oldRecord.items.forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        if (p) {
          p.stock += item.qty; // Reverse decrement
        }
      });
    }

    // 2. APPLY inventory for new items
    if (updated.items) {
      updated.items.forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        if (p) {
          p.stock -= item.qty; // Apply new decrement
        }
      });
    }

    records[index] = updated;
    await saveProducts(products);
    await AsyncStorage.setItem(UTANG_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Error updating utang:', e);
    throw e;
  }
}

export async function markUtangPaid(id: string, paymentType: 'cash' | 'gcash'): Promise<void> {
  try {
    const records = await getUtangRecords();
    const index = records.findIndex((r) => r.id === id);
    if (index !== -1) {
      const record = records[index];
      record.isPaid = true;
      record.paymentType = paymentType;
      record.paidAt = new Date().toISOString();
      
      // Save the updated utang record
      await AsyncStorage.setItem(UTANG_KEY, JSON.stringify(records));

      // Create a payment Transaction for stats — include original items for profit calc
      // We use savePaymentTransaction so stock is NOT touched again.
      const paymentTransaction: Transaction = {
        id: `pay-${record.id}-${Date.now()}`,
        items: record.items || [],
        total: record.amount,
        paymentType: paymentType,
        timestamp: new Date().toISOString()
      };
      
      await savePaymentTransaction(paymentTransaction);
    }
  } catch (e) {
    console.error('Error marking utang paid:', e);
    throw e;
  }
}

export async function deleteUtangRecord(id: string): Promise<void> {
  try {
    const records = await getUtangRecords();
    const record = records.find(r => r.id === id);
    if (!record) return;

    // Optional: Should deleting a debt return stock to products? 
    // Usually no, as the items were actually taken/used. Keeping as is.
    const filtered = records.filter((r) => r.id !== id);
    await AsyncStorage.setItem(UTANG_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error deleting utang:', e);
  }
}

// Restocks
export async function getRestockLogs(): Promise<RestockLog[]> {
  try {
    const raw = await AsyncStorage.getItem(RESTOCKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error fetching restocks:', e);
    return [];
  }
}

export async function addRestockLog(log: RestockLog): Promise<void> {
  const logs = await getRestockLogs();
  logs.unshift(log);
  await AsyncStorage.setItem(RESTOCKS_KEY, JSON.stringify(logs));
  
  // Update product stock
  const products = await getProducts();
  const p = products.find((prod) => prod.id === log.productId);
  if (p) {
    p.stock += log.qtyAdded;
    await saveProducts(products);
  }
}

// Expenses
export async function getExpenses(): Promise<Expense[]> {
  try {
    const raw = await AsyncStorage.getItem(EXPENSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error fetching expenses:', e);
    return [];
  }
}

export async function addExpense(expense: Expense): Promise<void> {
  try {
    const expenses = await getExpenses();
    expenses.unshift(expense);
    await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  } catch (e) {
    console.error('Error adding expense:', e);
    throw e;
  }
}

export async function deleteExpense(id: string): Promise<void> {
  try {
    const expenses = await getExpenses();
    const filtered = expenses.filter(e => e.id !== id);
    await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error deleting expense:', e);
  }
}

// Settings
export async function getBusinessSettings(): Promise<BusinessSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Error fetching settings:', e);
    return {};
  }
}

export async function saveBusinessSettings(settings: BusinessSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Welcome
export async function hasSeenWelcome(): Promise<boolean> {
  const res = await AsyncStorage.getItem(WELCOME_KEY);
  return res === 'true';
}

export async function markWelcomeAsSeen(): Promise<void> {
  await AsyncStorage.setItem(WELCOME_KEY, 'true');
}

// Backup & Export
export async function exportData(): Promise<void> {
  try {
    const keys = [PRODUCTS_KEY, TRANSACTIONS_KEY, UTANG_KEY, RESTOCKS_KEY, SETTINGS_KEY];
    const pairs = await AsyncStorage.multiGet(keys);
    const backup = Object.fromEntries(pairs);
    
    const dataStr = JSON.stringify(backup);

    if (Platform.OS === 'web') {
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tindadone_backup.json';
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const uri = (FileSystem.documentDirectory || '') + 'tindadone_backup.json';
    await FileSystem.writeAsStringAsync(uri, dataStr);
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
  } catch (e) {
    console.error('Error exporting data:', e);
  }
}

export async function seedDemoItems(): Promise<void> {
  const demoProducts: Product[] = [
    {
      id: 'demo-coke',
      name: 'Coca-Cola 1.5L',
      price: 75,
      costPrice: 62,
      unit: 'pc',
      stock: 15,
      lowStockThreshold: 3,
      category: 'Drinks',
      barcode: '4800002201015',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-nescafe',
      name: 'Nescafe 3-in-1 Original',
      price: 10,
      costPrice: 8.5,
      unit: 'pc',
      stock: 48,
      lowStockThreshold: 10,
      category: 'Drinks',
      barcode: '4800003302025',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-luckyme',
      name: 'Lucky Me! Pancit Canton Extra Hot',
      price: 22,
      costPrice: 17.5,
      unit: 'pc',
      stock: 35,
      lowStockThreshold: 8,
      category: 'Food',
      barcode: '4800016601050',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-safeguard',
      name: 'Safeguard White Soap 130g',
      price: 48,
      costPrice: 39.5,
      unit: 'pc',
      stock: 12,
      lowStockThreshold: 2,
      category: 'Personal Care',
      barcode: '4800085501065',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-tide',
      name: 'Tide Powder Detergent Sachet',
      price: 12,
      costPrice: 9.8,
      unit: 'pc',
      stock: 60,
      lowStockThreshold: 15,
      category: 'Household',
      barcode: '4800052203040',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-kopiko',
      name: 'Kopiko Brown Coffee Sachet',
      price: 12,
      costPrice: 10,
      unit: 'pc',
      stock: 75,
      lowStockThreshold: 15,
      category: 'Drinks',
      barcode: '4800007705052',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-chippy',
      name: 'Chippy BBQ Chips Large',
      price: 24,
      costPrice: 19.5,
      unit: 'pc',
      stock: 20,
      lowStockThreshold: 5,
      category: 'Food',
      barcode: '4800016603098',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-sanmiguel',
      name: 'San Miguel Pale Pilsen Can',
      price: 85,
      costPrice: 70,
      unit: 'pc',
      stock: 24,
      lowStockThreshold: 6,
      category: 'Drinks',
      barcode: '4800005504018',
      createdAt: new Date().toISOString(),
    }
  ];

  // Load existing products
  let products = await getProducts();
  
  // Filter out duplicates
  const existingIds = new Set(products.map(p => p.id));
  const newDemos = demoProducts.filter(dp => !existingIds.has(dp.id));
  
  if (newDemos.length > 0) {
    products = [...newDemos, ...products];
    await saveProducts(products);
  }

  // Seed demo transactions over last 5 days if none exist
  const allTrans = await getTransactions();
  if (allTrans.length === 0) {
    const today = new Date();
    const demoTransactions: Transaction[] = [];
    
    for (let i = 4; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      const transCount = Math.floor(Math.random() * 3) + 2; 
      for (let j = 0; j < transCount; j++) {
        const item1 = demoProducts[Math.floor(Math.random() * demoProducts.length)];
        const item2 = demoProducts[Math.floor(Math.random() * demoProducts.length)];
        
        const qty1 = Math.floor(Math.random() * 3) + 1;
        const qty2 = Math.floor(Math.random() * 2) + 1;
        
        const itemsList: TransactionItem[] = [
          {
            productId: item1.id,
            productName: item1.name,
            qty: qty1,
            priceAtSale: item1.price,
            costPriceAtSale: item1.costPrice,
          }
        ];
        
        if (item1.id !== item2.id) {
          itemsList.push({
            productId: item2.id,
            productName: item2.name,
            qty: qty2,
            priceAtSale: item2.price,
            costPriceAtSale: item2.costPrice,
          });
        }
        
        const total = itemsList.reduce((sum, item) => sum + (item.priceAtSale * item.qty), 0);
        const randomHour = Math.floor(Math.random() * 10) + 8; // 8 AM to 6 PM
        const transDate = new Date(date);
        transDate.setHours(randomHour, Math.floor(Math.random() * 60));
        
        demoTransactions.push({
          id: `demo-trans-${i}-${j}-${Date.now()}`,
          items: itemsList,
          total: total,
          paymentType: Math.random() > 0.3 ? 'cash' : 'gcash',
          timestamp: transDate.toISOString(),
        });
      }
    }
    
    demoTransactions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    const groups: Record<string, Transaction[]> = {};
    for (const t of demoTransactions) {
      const mk = getYearMonth(t.timestamp);
      if (!groups[mk]) groups[mk] = [];
      groups[mk].push(t);
    }
    
    for (const [mk, trans] of Object.entries(groups)) {
      const key = getPartitionKey(mk);
      await AsyncStorage.setItem(key, JSON.stringify(trans));
      await registerMonthInIndex(mk);
    }
  }

  // Seed demo Utang
  const allUtang = await getUtangRecords();
  if (allUtang.length === 0) {
    const today = new Date();
    const demoUtang: UtangRecord[] = [
      {
        id: 'demo-utang-1',
        customerName: 'Aling Nena',
        amount: 250,
        isPaid: false,
        note: 'Pay on Saturday',
        items: [
          {
            productId: 'demo-coke',
            productName: 'Coca-Cola 1.5L',
            qty: 2,
            priceAtSale: 75,
            costPriceAtSale: 62,
          },
          {
            productId: 'demo-luckyme',
            productName: 'Lucky Me! Pancit Canton Extra Hot',
            qty: 4,
            priceAtSale: 22,
            costPriceAtSale: 17.5,
          }
        ],
        createdAt: new Date(today.getTime() - 2 * 24 * 3600000).toISOString(),
      },
      {
        id: 'demo-utang-2',
        customerName: 'Mang Jose',
        amount: 85,
        isPaid: false,
        note: 'Beer credit',
        items: [
          {
            productId: 'demo-sanmiguel',
            productName: 'San Miguel Pale Pilsen Can',
            qty: 1,
            priceAtSale: 85,
            costPriceAtSale: 70,
          }
        ],
        createdAt: new Date(today.getTime() - 1 * 24 * 3600000).toISOString(),
      }
    ];
    await AsyncStorage.setItem(UTANG_KEY, JSON.stringify(demoUtang));
  }

  // Seed demo Expenses
  const allExpenses = await getExpenses();
  if (allExpenses.length === 0) {
    const today = new Date();
    const demoExpenses: Expense[] = [
      {
        id: 'demo-exp-1',
        description: 'Store Electricity bill',
        amount: 350,
        category: 'Utility',
        timestamp: new Date(today.getTime() - 4 * 24 * 3600000).toISOString(),
      },
      {
        id: 'demo-exp-2',
        description: 'Tricycle Fare for grocery supplies',
        amount: 50,
        category: 'Transport',
        timestamp: new Date(today.getTime() - 2 * 24 * 3600000).toISOString(),
      }
    ];
    await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(demoExpenses));
  }
}

export async function clearDemoItems(): Promise<void> {
  // Remove demo products
  const products = await getProducts();
  await saveProducts(products.filter(p => !p.id.startsWith('demo-')));

  // Remove demo transactions from every partition
  const index = await getMonthIndex();
  for (const mk of index) {
    const key = getPartitionKey(mk);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;
    const trans: Transaction[] = JSON.parse(raw);
    const filtered = trans.filter(t => !t.id.startsWith('demo-'));
    if (filtered.length === 0) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(filtered));
    }
  }

  // Remove demo utang
  const utang = await getUtangRecords();
  await AsyncStorage.setItem(UTANG_KEY, JSON.stringify(utang.filter(u => !u.id.startsWith('demo-'))));

  // Remove demo expenses
  const expenses = await getExpenses();
  await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses.filter(e => !e.id.startsWith('demo-'))));
}
