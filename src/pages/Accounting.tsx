import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, where, getDocs, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Transaction, UserRole, AccountingCategory } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  Edit3, 
  Filter, 
  X, 
  Calendar, 
  DollarSign, 
  PieChart as PieChartIcon,
  ChevronDown,
  ArrowRight,
  Search,
  Download,
  Image as ImageIcon,
  Eye,
  FileText,
  AlertCircle,
  Mail,
  CheckCircle,
  Clock,
  User as UserIcon,
  Share2,
  Tag,
  List,
  Edit2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend
} from 'recharts';

const DEFAULT_CATEGORIES: Omit<AccountingCategory, 'id' | 'createdAt'>[] = [
  { name: 'Fund Replenish', type: 'income' },
  { name: 'Dues', type: 'income' },
  { name: 'Donations', type: 'income' },
  { name: 'Pledge', type: 'income' },
  { name: 'Fundraiser', type: 'income' },
  { name: 'Other', type: 'income' },
  { name: 'Supplies', type: 'expense' },
  { name: 'Rent', type: 'expense' },
  { name: 'Events', type: 'expense' },
  { name: 'Charity', type: 'expense' },
  { name: 'Administrative', type: 'expense' },
  { name: 'Other', type: 'expense' }
];

export default function Accounting() {
  const { profile, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<AccountingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<AccountingCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('income');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    amount: '',
    category: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    receiptUrl: ''
  });

  const canAccess = (profile?.roles || []).some(r => 
    ['admin', 'president', 'treasurer', 'vice_president', 'auditor'].includes(r)
  );

  const canEdit = (profile?.roles || []).some(r => 
    ['admin', 'president', 'treasurer'].includes(r)
  );

  const canApprove = (profile?.roles || []).some(r => 
    ['admin', 'president', 'auditor'].includes(r)
  );

  useEffect(() => {
    if (!canAccess) return;

    // Fetch Transactions
    const transactionsQuery = query(collection(db, 'accounting'), orderBy('date', 'desc'));
    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setLoading(false);
      setFetchError(null);
    }, (err) => {
      console.error(err);
      setFetchError("Permission denied or database error.");
      setLoading(false);
      handleFirestoreError(err, OperationType.GET, 'accounting');
    });

    // Fetch Categories
    const categoriesQuery = query(collection(db, 'accounting_categories'), orderBy('name', 'asc'));
    const unsubscribeCategories = onSnapshot(categoriesQuery, (snap) => {
      if (snap.empty) {
        // Initialize with defaults if empty
        const batch = writeBatch(db);
        DEFAULT_CATEGORIES.forEach(cat => {
          const newDocRef = doc(collection(db, 'accounting_categories'));
          batch.set(newDocRef, { ...cat, createdAt: serverTimestamp() });
        });
        batch.commit().catch(err => console.error("Failed to seed categories", err));
      } else {
        setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountingCategory)));
      }
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeCategories();
    };
  }, [canAccess]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;
    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'accounting_categories', editingCategory.id!), {
          name: newCategoryName,
          type: newCategoryType
        });
        setEditingCategory(null);
      } else {
        await addDoc(collection(db, 'accounting_categories'), {
          name: newCategoryName,
          type: newCategoryType,
          createdAt: serverTimestamp()
        });
      }
      setNewCategoryName('');
    } catch (err) {
      console.error(err);
      alert("Failed to save category");
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (transactions.some(t => t.category === name)) {
      alert("Cannot delete category because it is being used by transactions.");
      return;
    }
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'accounting_categories', id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!formData.amount || !formData.category || !formData.date) return;

    const data: any = {
      type: formData.type,
      amount: parseFloat(formData.amount),
      category: formData.category,
      description: formData.description,
      date: formData.date,
      receiptUrl: formData.receiptUrl,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingId) {
        data.lastModifiedBy = user.uid;
        data.lastModifiedByName = profile.displayName;
        await updateDoc(doc(db, 'accounting', editingId), data);
      } else {
        await addDoc(collection(db, 'accounting'), {
          ...data,
          status: 'pending',
          processedBy: user.uid,
          processedByName: profile.displayName,
          createdAt: serverTimestamp()
        });
      }
      setIsEditorOpen(false);
      setEditingId(null);
      setFormData({ 
        type: 'income', 
        amount: '', 
        category: categories.find(c => c.type === 'income')?.name || '', 
        description: '', 
        date: format(new Date(), 'yyyy-MM-dd'),
        receiptUrl: ''
      });
    } catch (err) {
      console.error(err);
      alert("Failed to save transaction");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await deleteDoc(doc(db, 'accounting', id));
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (t: Transaction) => {
    setEditingId(t.id || null);
    setFormData({ 
      type: t.type, 
      amount: t.amount.toString(), 
      category: t.category, 
      description: t.description, 
      date: t.date,
      receiptUrl: t.receiptUrl || ''
    });
    setIsEditorOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // Keep under 800KB for Firestore limits
      alert("File is too large. Please select an image under 800KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, receiptUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleApprove = async (id: string) => {
    if (!user || !profile) return;
    try {
      await updateDoc(doc(db, 'accounting', id), {
        status: 'approved',
        approvedBy: user.uid,
        approvedByName: profile.displayName,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      alert("Failed to approve transaction");
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Status', 'Processed By', 'Approved By'];
    const rows = filteredTransactions.map(t => [
      t.date,
      t.type,
      t.category,
      t.description || '',
      t.amount,
      t.status || 'pending',
      t.processedByName || '',
      t.approvedByName || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `financial-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Financial Report - ${format(new Date(), 'MMM yyyy')}`);
    const summary = `Financial Summary:\nIncome: ¥${stats.income.toLocaleString()}\nExpenses: ¥${stats.expense.toLocaleString()}\nBalance: ¥${balance.toLocaleString()}\n\nTransactions exported: ${filteredTransactions.length}`;
    const body = encodeURIComponent(`${summary}\n\nPlease find the detailed report attached in the system.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const filteredTransactions = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    
    // Only filter by date if BOTH are set
    if (startDate && endDate) {
      try {
        const transDate = parseISO(t.date);
        const start = startOfDay(parseISO(startDate));
        const end = endOfDay(parseISO(endDate));
        if (!isWithinInterval(transDate, { start, end })) return false;
      } catch (e) {
        console.error("Date parsing error", e);
      }
    }
    
    return true;
  });

  const stats = transactions.reduce((acc, t) => {
    if (t.type === 'income') acc.income += t.amount;
    else acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const balance = stats.income - stats.expense;

  // Chart Data (Last 6 Months)
  const chartData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const month = format(d, 'MMM');
    const monthStart = startOfMonth(d);
    const monthEnd = endOfMonth(d);

    const monthTransactions = transactions.filter(t => {
      const transDate = parseISO(t.date);
      return transDate >= monthStart && transDate <= monthEnd;
    });

    const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    return { name: month, income, expense };
  }).reverse();

  if (!canAccess) {
    return <div className="p-20 text-center font-serif text-gray-400">Access Denied. Accounting features are restricted to Treasurer and President.</div>;
  }

  if (loading) return <div className="p-8 text-center font-serif italic text-gray-400">Loading financial records...</div>;

  if (fetchError) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 bg-red-50 border border-red-100 rounded-[32px] text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-serif text-red-900 mb-2">Database Error</h2>
        <p className="text-red-700 text-sm mb-6">{fetchError}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-red-600 text-white rounded-full text-xs font-bold uppercase tracking-widest"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-serif flex items-center gap-3 text-gray-900 dark:text-white">
            <Wallet className="text-[#5A5A40] dark:text-[#8a8a65]" />
            Treasury & Accounting
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-serif italic text-sm mt-1">Manage community funds, income, and expenditures.</p>
        </div>
        <div className="flex items-center gap-4">
          {canEdit && (
            <button
              onClick={() => setIsCategoryManagerOpen(true)}
              className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-[#1e1e1a] text-gray-600 dark:text-[#f5f5f0] rounded-full font-bold text-xs uppercase tracking-widest border border-gray-100 dark:border-white/5 shadow-sm hover:bg-gray-50 dark:hover:bg-[#252520] transition-all font-sans"
              title="Manage Categories"
            >
              <Tag size={16} />
              Categories
            </button>
          )}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-[#1e1e1a] text-gray-600 dark:text-[#f5f5f0] rounded-full font-bold text-xs uppercase tracking-widest border border-gray-100 dark:border-white/5 shadow-sm hover:bg-gray-50 dark:hover:bg-[#252520] transition-all"
            title="Download CSV"
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={shareViaEmail}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-[#1e1e1a] text-gray-600 dark:text-[#f5f5f0] rounded-full font-bold text-xs uppercase tracking-widest border border-gray-100 dark:border-white/5 shadow-sm hover:bg-gray-50 dark:hover:bg-[#252520] transition-all"
            title="Send Summary via Email"
          >
            <Mail size={16} />
            Share
          </button>
          {canEdit && (
            <button
              onClick={() => {
                const firstIncome = categories.find(c => c.type === 'income')?.name || '';
                setFormData(prev => ({ ...prev, category: firstIncome, type: 'income' }));
                setIsEditorOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] text-white rounded-full font-bold text-xs uppercase tracking-widest shadow-soft hover:shadow-lg transition-all"
            >
              <Plus size={16} />
              Record Transaction
            </button>
          )}
        </div>
      </header>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-50 dark:border-white/5 shadow-sm flex items-center gap-6"
        >
          <div className="w-14 h-14 bg-green-50 dark:bg-green-950/20 text-green-600 rounded-2xl flex items-center justify-center">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Available Balance</p>
            <h3 className={cn("text-3xl font-serif", balance >= 0 ? "text-gray-900 dark:text-white" : "text-red-500")}>
              ¥{balance.toLocaleString()}
            </h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-50 dark:border-white/5 shadow-sm flex items-center gap-6"
        >
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-2xl flex items-center justify-center">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Total Income</p>
            <h3 className="text-3xl font-serif text-gray-900 dark:text-white">
              ¥{stats.income.toLocaleString()}
            </h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-50 dark:border-white/5 shadow-sm flex items-center gap-6"
        >
          <div className="w-14 h-14 bg-orange-50 dark:bg-orange-950/20 text-orange-600 rounded-2xl flex items-center justify-center">
            <TrendingDown size={28} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Total Expenses</p>
            <h3 className="text-3xl font-serif text-gray-900 dark:text-white">
              ¥{stats.expense.toLocaleString()}
            </h3>
          </div>
        </motion.div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <section className="lg:col-span-2 bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif flex items-center gap-2 text-gray-900 dark:text-white">
              <PieChartIcon className="text-[#5A5A40] dark:text-[#8a8a65]" size={20} />
              Financial Overview
            </h2>
          </div>
          <div className="h-[300px] w-full col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={profile?.preferences?.darkMode ? "#2a2a24" : "#f1f1f1"} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip 
                  contentStyle={profile?.preferences?.darkMode ? { background: '#1e1e1a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)', color: '#f5f5f0' } : { borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: profile?.preferences?.darkMode ? '#252520' : '#f9fafb' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="income" name="Income" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="expense" name="Expense" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Categories Section */}
        <section className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif flex items-center gap-2 text-gray-900 dark:text-white">
                <Filter className="text-[#5A5A40] dark:text-[#8a8a65]" size={20} />
                Filters
              </h2>
              {(startDate || endDate || filterType !== 'all' || filterCategory !== 'all') && (
                <button 
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setFilterType('all');
                    setFilterCategory('all');
                  }}
                  className="text-[10px] font-bold text-[#5A5A40] dark:text-[#8a8a65] uppercase tracking-tighter hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1 px-1">Date Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-[#252520] border-none rounded-xl text-[10px] focus:ring-1 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] text-gray-900 dark:text-[#f5f5f0] outline-none"
                />
                <span className="text-gray-300 dark:text-gray-600 text-xs">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-[#252520] border-none rounded-xl text-[10px] focus:ring-1 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] text-gray-900 dark:text-[#f5f5f0] outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2 px-1">Type</label>
              <div className="flex gap-2">
                {['all', 'income', 'expense'].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t as any)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border",
                      filterType === t 
                        ? "bg-[#5A5A40] text-white border-[#5A5A40] dark:bg-[#8a8a65] dark:text-[#141411] dark:border-[#8a8a65]" 
                        : "bg-gray-50 dark:bg-[#252520] text-gray-400 dark:text-gray-500 border-transparent hover:bg-gray-100 dark:hover:bg-[#2c2c25]"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2 px-1">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#252520] border-none rounded-xl text-xs focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] text-gray-900 dark:text-[#f5f5f0] outline-none font-medium"
              >
                <option value="all" className="bg-white dark:bg-[#1e1e1a]">All Categories</option>
                {categories.filter(c => filterType === 'all' || c.type === filterType).map(c => (
                  <option key={c.id} value={c.name} className="bg-white dark:bg-[#1e1e1a]">{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </div>

      {/* Transaction List */}
      <section className="bg-white dark:bg-[#1e1e1a] rounded-[40px] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
        <div className="p-8 border-b border-gray-50 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-serif text-gray-900 dark:text-white">Recent Transactions</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
              Showing {filteredTransactions.length} records
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-[#252520]/50 border-b border-gray-100 dark:border-white/5">
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Date</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Type</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Category</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Description</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Amount</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Receipt</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {filteredTransactions.map((t, idx) => (
                <motion.tr 
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="hover:bg-gray-50/50 dark:hover:bg-[#252520]/20 transition-colors"
                >
                  <td className="px-8 py-5 text-sm font-medium text-gray-600 dark:text-gray-300">
                    {format(parseISO(t.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider",
                      t.type === 'income' ? "bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400" : "bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400"
                    )}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">
                    {t.category}
                  </td>
                  <td className="px-8 py-5 text-sm text-gray-500 max-w-xs">
                    <div className="truncate text-gray-900 dark:text-gray-200">{t.description || '-'}</div>
                    <div className="flex flex-col gap-0.5 mt-1">
                      <div className="flex items-center gap-1 text-[8px] text-gray-300 dark:text-gray-600 font-bold uppercase tracking-widest">
                        <UserIcon size={8} /> Added by {t.processedByName}
                      </div>
                      {t.lastModifiedByName && (
                        <div className="flex items-center gap-1 text-[8px] text-gray-300 dark:text-gray-600 font-bold uppercase tracking-widest italic">
                          <Edit3 size={8} /> Edited by {t.lastModifiedByName}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={cn(
                    "px-8 py-5 text-sm font-bold text-right",
                    t.type === 'income' ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                  )}>
                    {t.type === 'income' ? '+' : '-'}¥{t.amount.toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn(
                        "px-2 px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest flex items-center gap-1",
                        t.status === 'approved' ? "bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400" : "bg-gray-50 dark:bg-[#252520] text-gray-400 dark:text-gray-500"
                      )}>
                        {t.status === 'approved' ? <CheckCircle size={10} /> : <Clock size={10} />}
                        {t.status || 'pending'}
                      </span>
                      {t.approvedByName && (
                        <span className="text-[7px] text-gray-300 dark:text-gray-500 uppercase font-bold tracking-tighter">By {t.approvedByName}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    {t.receiptUrl ? (
                      <button 
                        onClick={() => setSelectedReceipt(t.receiptUrl || null)}
                        className="p-2 text-[#5A5A40] dark:text-[#8a8a65] hover:bg-gray-100 dark:hover:bg-[#252520] rounded-full transition-all inline-flex items-center gap-1"
                        title="View Receipt"
                      >
                        <ImageIcon size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">View</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-300 dark:text-gray-600 uppercase tracking-widest font-bold">None</span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 pr-4">
                      {canApprove && t.status !== 'approved' && (
                        <button 
                          onClick={() => t.id && handleApprove(t.id)}
                          className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 rounded-full transition-all"
                          title="Approve Transaction"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {canEdit && (
                        <>
                          <button 
                            onClick={() => startEdit(t)}
                            className="p-2 text-gray-400 hover:text-[#5A5A40] dark:hover:text-[#8a8a65] hover:bg-white dark:hover:bg-[#252520] rounded-full transition-all"
                            title="Edit"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => t.id && handleDelete(t.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-[#252520] rounded-full transition-all"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-gray-400 dark:text-gray-500 italic font-serif">
                    No transactions found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AnimatePresence>
        {isCategoryManagerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1e1e1a] w-full max-w-xl rounded-[40px] overflow-hidden shadow-2xl border dark:border-white/5"
            >
              <div className="p-8 border-b border-gray-50 dark:border-white/5 flex items-center justify-between">
                <h2 className="text-2xl font-serif text-gray-900 dark:text-white">Manage Categories</h2>
                <button 
                  onClick={() => {
                    setIsCategoryManagerOpen(false);
                    setEditingCategory(null);
                    setNewCategoryName('');
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-[#252520] rounded-full transition-all text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      required
                      placeholder="Category Name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] text-gray-900 dark:text-white transition-all text-sm outline-none"
                    />
                    <div className="flex gap-2 p-1 bg-gray-50 dark:bg-[#252520] rounded-xl">
                      {(['income', 'expense'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewCategoryType(t)}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                            newCategoryType === t 
                              ? "bg-white dark:bg-[#121210] shadow-sm text-gray-900 dark:text-white" 
                              : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-6 bg-[#5A5A40] text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-soft hover:shadow-lg transition-all h-[56px]"
                  >
                    {editingCategory ? 'Update' : 'Add'}
                  </button>
                </form>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#252520] rounded-2xl">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          cat.type === 'income' ? "bg-green-500" : "bg-orange-500"
                        )} />
                        <span className="text-sm font-medium text-gray-700 dark:text-[#f5f5f0]">{cat.name}</span>
                        <span className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-100 dark:bg-[#1e1e1a] px-1.5 py-0.5 rounded">
                          {cat.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingCategory(cat);
                            setNewCategoryName(cat.name);
                            setNewCategoryType(cat.type);
                          }}
                          className="p-2 text-gray-400 hover:text-[#5A5A40] dark:hover:text-[#8a8a65] hover:bg-white dark:hover:bg-[#1e1e1a] rounded-full transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => cat.id && deleteCategory(cat.id, cat.name)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-[#1e1e1a] rounded-full transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor Modal */}
      <AnimatePresence>
        {isEditorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1e1e1a] w-full max-w-xl rounded-[40px] overflow-hidden shadow-2xl border dark:border-white/5"
            >
              <div className="p-8 border-b border-gray-50 dark:border-white/5 flex items-center justify-between">
                <h2 className="text-2xl font-serif text-gray-900 dark:text-white">{editingId ? 'Edit Record' : 'Record Transaction'}</h2>
                <button 
                  onClick={() => setIsEditorOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-[#252520] rounded-full transition-all text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'income', category: categories.find(c => c.type === 'income')?.name || '' }))}
                    className={cn(
                      "py-4 rounded-2xl flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-[10px] transition-all border-2",
                      formData.type === 'income' 
                        ? "bg-green-50 border-green-500 text-green-600 dark:bg-green-950/20 dark:border-green-500/50" 
                        : "bg-gray-50 dark:bg-[#252520] border-transparent text-gray-400 dark:text-gray-500"
                    )}
                  >
                    <TrendingUp size={16} />
                    Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'expense', category: categories.find(c => c.type === 'expense')?.name || '' }))}
                    className={cn(
                      "py-4 rounded-2xl flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-[10px] transition-all border-2",
                      formData.type === 'expense' 
                        ? "bg-orange-50 border-orange-500 text-orange-600 dark:bg-orange-950/20 dark:border-orange-500/50" 
                        : "bg-gray-50 dark:bg-[#252520] border-transparent text-gray-400 dark:text-gray-500"
                    )}
                  >
                    <TrendingDown size={16} />
                    Expense
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2 px-1">Amount (¥)</label>
                    <input
                      type="number"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] text-gray-900 dark:text-white transition-all font-bold text-lg outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2 px-1">Date</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] text-gray-900 dark:text-white transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2 px-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] text-gray-900 dark:text-white transition-all outline-none"
                  >
                    {categories.filter(c => c.type === formData.type).map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2 px-1">Description (Optional)</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] text-gray-900 dark:text-white transition-all resize-none outline-none"
                    placeholder="Provide some context..."
                  />
                </div>

                {formData.type === 'expense' && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2 px-1">Receipt Upload</label>
                    <div className="flex items-center gap-4">
                      <label className="flex-1 cursor-pointer">
                        <div className="px-6 py-4 bg-gray-50 dark:bg-[#252520] border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-[#2c2c25] transition-all">
                          <ImageIcon className="text-gray-400" size={24} />
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                            {formData.receiptUrl ? 'Change Receipt' : 'Attach Receipt'}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      {formData.receiptUrl && (
                        <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 flex-shrink-0 group">
                          <img src={formData.receiptUrl} alt="Receipt Preview" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, receiptUrl: '' }))}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="text-white" size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-[#5A5A40] text-white rounded-full font-bold text-xs uppercase tracking-widest shadow-soft hover:shadow-lg transition-all"
                  >
                    {editingId ? 'Save Changes' : 'Record Transaction'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="flex-1 py-4 bg-gray-100 dark:bg-[#252520] text-gray-500 dark:text-gray-450 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-[#2c2c25] transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Receipt Modal */}
      <AnimatePresence>
        {selectedReceipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setSelectedReceipt(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedReceipt(null)}
                className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X size={24} />
              </button>
              <img 
                src={selectedReceipt} 
                alt="Receipt" 
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" 
              />
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full">
                <FileText size={14} className="text-gray-300" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Receipt Document</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
