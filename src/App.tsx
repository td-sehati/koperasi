import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  PlusCircle, 
  History, 
  LayoutDashboard, 
  Search, 
  ChevronRight, 
  Wallet, 
  CreditCard,
  ArrowLeft,
  Save,
  UserPlus,
  Calendar,
  MapPin,
  Briefcase,
  Edit,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Member, Saving, Loan, LoanPayment, MemberDetail, Stats, DailyReport, ActiveLoanReport, ScheduleItem, AuthUser, Account, PaymentInstructions } from './types';

const AUTH_TOKEN_KEY = 'fo_auth_token';

const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers || {});
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(input, { ...init, headers });
};

// --- Components ---

const Card = ({ children, className = "", ...props }: { children: React.ReactNode, className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
    {children}
  </div>
);

const Input = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
    <input 
      {...props} 
      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
    />
  </div>
);

const Button = ({ children, variant = 'primary', className = "", ...props }: { children: React.ReactNode, variant?: 'primary' | 'secondary' | 'danger', className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 active:scale-95'
  };
  return (
    <button 
      {...props} 
      className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const LoginView = ({ onLoginSuccess }: { onLoginSuccess: (token: string, user: AuthUser, instructions?: PaymentInstructions) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      const body = await res.json();
      if (!res.ok) {
        const extra = body?.paymentInstructions
          ? `\n\nBiaya: ${body.paymentInstructions.feeLabel}\nPembayaran: ${body.paymentInstructions.payTo}\nKonfirmasi: ${body.paymentInstructions.confirmTo}`
          : '';
        setError((body.error || 'Login gagal.') + extra);
        return;
      }
      onLoginSuccess(body.token, body.user, body.paymentInstructions);
    } catch {
      setError('Tidak bisa terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-6 space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-slate-900">Field Officer Login</h1>
            <p className="text-sm text-slate-500">Masuk untuk melanjutkan akses aplikasi</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Username" required value={username} onChange={(e) => setUsername(e.target.value)} />
            <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

// --- Views ---

const Dashboard = ({ stats, schedule, onSelectMember, lastUpdated }: { stats: Stats | null, schedule: ScheduleItem[], onSelectMember: (id: number) => void, lastUpdated: Date | null }) => (
  <div className="space-y-6 p-4 pb-24">
    <header className="space-y-1 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Ringkasan Hari Ini</h1>
      <p className="text-slate-500 text-sm">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p className="text-[11px] font-medium text-slate-400">
        Last updated: {lastUpdated ? lastUpdated.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
      </p>
    </header>

    <div className="grid grid-cols-2 gap-4">
      <Card className="p-4 bg-emerald-50 border-emerald-100">
        <div className="space-y-1">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Total Tagihan</p>
          <p className="text-xl font-black text-emerald-900">Rp {(stats?.todayCollections || 0).toLocaleString('id-ID')}</p>
        </div>
      </Card>
      <Card className="p-4 bg-blue-50 border-blue-100">
        <div className="space-y-1">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Anggota</p>
          <p className="text-xl font-black text-blue-900">{stats?.totalMembers || 0}</p>
        </div>
      </Card>
    </div>

    {/* Today's Schedule Section */}
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Jadwal Penagihan Hari Ini</h2>
        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">{schedule.length} Orang</span>
      </div>
      
      {schedule.length > 0 ? (
        <div className="space-y-3">
          {schedule.map(item => (
            <Card key={item.id} className="p-4 flex items-center justify-between active:bg-slate-50 transition-colors cursor-pointer" onClick={() => onSelectMember(item.id)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-bold">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <p className={`font-bold text-sm ${item.paid_today ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Cicilan: Rp {item.installment_amount.toLocaleString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sisa</p>
                <p className="font-bold text-rose-600 text-xs">Rp {item.total_to_pay.toLocaleString()}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center text-slate-400 text-sm border-dashed">
          Tidak ada jadwal penagihan untuk hari ini
        </Card>
      )}
    </div>

    <div className="space-y-4">
      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Detail Setoran</h2>
      <Card className="divide-y divide-slate-50">
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <Wallet size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-800">Simpanan (Net)</p>
              <p className="text-xs text-slate-500">Setoran - Pencairan</p>
            </div>
          </div>
          <p className="font-bold text-slate-900">Rp {(stats?.todaySavings || 0).toLocaleString('id-ID')}</p>
        </div>
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
              <Wallet size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-800">Pencairan Simpanan</p>
              <p className="text-xs text-slate-500">Pengambilan oleh anggota</p>
            </div>
          </div>
          <p className="font-bold text-rose-600">-Rp {(stats?.todayWithdrawals || 0).toLocaleString('id-ID')}</p>
        </div>
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <CreditCard size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-800">Cicilan Pinjaman</p>
              <p className="text-xs text-slate-500">Angsuran Mingguan</p>
            </div>
          </div>
          <p className="font-bold text-slate-900">Rp {(stats?.todayPayments || 0).toLocaleString('id-ID')}</p>
        </div>
      </Card>
    </div>

    <div className="p-6 bg-slate-900 rounded-3xl text-white relative overflow-hidden">
      <div className="relative z-10 space-y-4">
        <h3 className="text-lg font-bold">Koperasi Mitra Perintis Usaha</h3>
        <p className="text-slate-400 text-sm leading-relaxed">
          "Membangun ekonomi kerakyatan melalui digitalisasi pelayanan lapangan."
        </p>
        <div className="pt-2">
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded-full border border-emerald-500/30">
            Field Officer App v1.0
          </span>
        </div>
      </div>
      <div className="absolute -right-8 -bottom-8 opacity-10">
        <Users size={160} />
      </div>
    </div>
  </div>
);

const MemberList = ({ members, onSelectMember, onAddMember }: { members: Member[], onSelectMember: (id: number) => void, onAddMember: () => void }) => {
  const [search, setSearch] = useState('');
  const filtered = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.ktp?.includes(search)
  );

  return (
    <div className="space-y-4 p-4 pb-24">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Anggota</h1>
        <button 
          onClick={onAddMember}
          className="p-2 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-200 active:scale-90 transition-transform"
        >
          <UserPlus size={24} />
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text"
          placeholder="Cari nama atau No. KTP..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filtered.map(member => (
          <motion.div 
            key={member.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onSelectMember(member.id)}
          >
            <Card className="p-4 flex items-center justify-between active:bg-slate-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-lg">
                  {member.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{member.name}</p>
                  <p className="text-xs text-slate-500">KTP: {member.ktp || '-'}</p>
                </div>
              </div>
              <ChevronRight className="text-slate-300" size={20} />
            </Card>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Users className="mx-auto mb-2 opacity-20" size={48} />
            <p>Tidak ada anggota ditemukan</p>
          </div>
        )}
      </div>
    </div>
  );
};

const MemberForm = ({ onBack, onSuccess, initialData, memberId }: { 
  onBack: () => void, 
  onSuccess: () => void,
  initialData?: any,
  memberId?: number
}) => {
  const [formData, setFormData] = useState({
    name: '', ktp: '', address: '', rt_rw: '', kel: '', kec: '', 
    business: '', business_location: '', region: '', registration_no: '',
    collection_day: '',
    ...(initialData || {})
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = memberId ? `/api/members/${memberId}` : '/api/members';
    const method = memberId ? 'PUT' : 'POST';
    
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (res.ok) onSuccess();
  };

  return (
    <div className="p-4 pb-24 space-y-6">
      <header className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">
          {memberId ? 'Edit Anggota' : 'Tambah Anggota'}
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Identitas Pribadi</h2>
          <Input label="Nama Lengkap" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          <Input label="No. KTP" value={formData.ktp} onChange={e => setFormData({...formData, ktp: e.target.value})} />
          <Input label="Alamat" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="RT/RW" value={formData.rt_rw} onChange={e => setFormData({...formData, rt_rw: e.target.value})} />
            <Input label="Kelurahan" value={formData.kel} onChange={e => setFormData({...formData, kel: e.target.value})} />
          </div>
          <Input label="Kecamatan" value={formData.kec} onChange={e => setFormData({...formData, kec: e.target.value})} />
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Detail Usaha & Wilayah</h2>
          <Input label="Jenis Usaha" value={formData.business} onChange={e => setFormData({...formData, business: e.target.value})} />
          <Input label="Tempat Usaha" value={formData.business_location} onChange={e => setFormData({...formData, business_location: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Wilayah (Wil)" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} />
            <Input label="No. Registrasi" value={formData.registration_no} onChange={e => setFormData({...formData, registration_no: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Hari Penagihan</label>
            <select 
              required
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm text-sm"
              value={formData.collection_day}
              onChange={e => setFormData({...formData, collection_day: e.target.value})}
            >
              <option value="">- Pilih Hari -</option>
              {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
        </Card>

        <Button type="submit" className="w-full">
          <Save size={20} />
          Simpan Anggota
        </Button>
      </form>
    </div>
  );
};

const MemberDetailView = ({ id, onBack }: { id: number, onBack: () => void }) => {
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'savings' | 'loans'>('savings');
  const [showSavingForm, setShowSavingForm] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState<Loan | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const fetchMember = async () => {
    const res = await apiFetch(`/api/members/${id}`);
    const data = await res.json();
    setMember(data);
  };

  const handleDeleteMember = async () => {
    const confirmDelete = window.confirm(
      'Hapus anggota ini?\n\nCatatan: hanya anggota tanpa data pinjaman dan simpanan yang bisa dihapus.'
    );
    if (!confirmDelete) return;

    const finalConfirm = window.confirm('Konfirmasi terakhir: lanjutkan hapus anggota ini?');
    if (!finalConfirm) return;

    const res = await apiFetch(`/api/members/${id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(body.error || 'Gagal menghapus anggota.');
      return;
    }

    alert('Anggota berhasil dihapus.');
    onBack();
  };

  useEffect(() => { fetchMember(); }, [id]);

  if (!member) return <div className="p-8 text-center text-slate-400">Memuat data...</div>;

  const activeLoan = member.loans.find(l => l.status === 'active');
  const totalSavingsIn = member.savings.reduce((acc, s) => acc + s.total, 0);
  const totalSavingsOut = member.withdrawals.reduce((acc, w) => acc + w.amount, 0);
  const savingsBalance = totalSavingsIn - totalSavingsOut;
  const savingMovements = [
    ...member.savings.map((s) => ({
      id: `in-${s.id}`,
      date: s.date,
      description: s.description || 'Setoran Rutin',
      amount: s.total,
      type: 'in' as const,
      wajib: s.wajib,
      khusus: s.khusus
    })),
    ...member.withdrawals.map((w) => ({
      id: `out-${w.id}`,
      date: w.date,
      description: w.description || 'Pencairan Simpanan',
      amount: w.amount,
      type: 'out' as const
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (showEditForm) {
    const { savings, loans, ...memberData } = member;
    return (
      <MemberForm 
        memberId={id}
        initialData={memberData}
        onBack={() => setShowEditForm(false)}
        onSuccess={() => {
          setShowEditForm(false);
          fetchMember();
        }}
      />
    );
  }

  return (
    <div className="pb-24">
      <div className="bg-emerald-600 text-white p-6 pt-8 rounded-b-[40px] shadow-lg shadow-emerald-100">
        <div className="flex justify-between items-start mb-6">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={handleDeleteMember} className="p-2 hover:bg-rose-500/30 rounded-full transition-colors">
              <Trash2 size={20} />
            </button>
            <button onClick={() => setShowEditForm(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Edit size={20} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white font-black text-2xl border border-white/30">
            {member.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{member.name}</h1>
            <div className="flex items-center gap-2">
              <p className="text-emerald-100 text-sm opacity-80">{member.ktp || 'No KTP tidak tersedia'}</p>
              <button 
                onClick={() => setShowProfile(true)}
                className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-full transition-colors"
              >
                Tampilkan Profil
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 -mt-8">
        <Card className="p-4 grid grid-cols-2 gap-4 text-center">
          <div className="space-y-1 border-r border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo Simpanan</p>
            <p className="font-black text-slate-900">Rp {savingsBalance.toLocaleString('id-ID')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sisa Pinjaman</p>
            <p className="font-black text-rose-600">
              {activeLoan ? `Rp ${activeLoan.total_to_pay.toLocaleString('id-ID')}` : 'Rp 0'}
            </p>
          </div>
        </Card>
      </div>

      <div className="px-4 mt-6">
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('savings')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'savings' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
          >
            Simpanan
          </button>
          <button 
            onClick={() => setActiveTab('loans')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'loans' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
          >
            Pinjaman
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'savings' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Riwayat Simpanan</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowWithdrawForm(true)}
                  className="text-xs font-bold text-rose-600 flex items-center gap-1"
                >
                  <PlusCircle size={14} /> Tarik
                </button>
                <button 
                  onClick={() => setShowSavingForm(true)}
                  className="text-xs font-bold text-emerald-600 flex items-center gap-1"
                >
                  <PlusCircle size={14} /> Setor
                </button>
              </div>
            </div>
            <Card className="p-3 bg-slate-50 border-slate-100">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Setor</p>
                  <p className="font-bold text-emerald-600 text-xs">Rp {totalSavingsIn.toLocaleString('id-ID')}</p>
                </div>
                <div className="border-x border-slate-200">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tarik</p>
                  <p className="font-bold text-rose-600 text-xs">Rp {totalSavingsOut.toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Saldo</p>
                  <p className="font-bold text-slate-800 text-xs">Rp {savingsBalance.toLocaleString('id-ID')}</p>
                </div>
              </div>
            </Card>
            <Card className="divide-y divide-slate-50">
              {savingMovements.map(item => (
                <div key={item.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800">
                      {new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Pukul {new Date(item.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${item.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.type === 'in' ? '+' : '-'}Rp {item.amount.toLocaleString('id-ID')}
                    </p>
                    {item.type === 'in' ? (
                      <p className="text-[10px] text-slate-400">W: {(item.wajib || 0).toLocaleString()} | K: {(item.khusus || 0).toLocaleString()}</p>
                    ) : (
                      <p className="text-[10px] text-slate-400">Pencairan Simpanan</p>
                    )}
                  </div>
                </div>
              ))}
              {savingMovements.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">Belum ada riwayat simpanan</div>
              )}
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Status Pinjaman</h3>
              {!activeLoan && (
                <button 
                  onClick={() => setShowLoanForm(true)}
                  className="text-xs font-bold text-emerald-600 flex items-center gap-1"
                >
                  <PlusCircle size={14} /> Baru
                </button>
              )}
            </div>
            
            {activeLoan ? (
              <div className="space-y-6">
                <Card className="p-6 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Pinjaman</p>
                      <p className="text-2xl font-black text-slate-900">Rp {activeLoan.amount.toLocaleString('id-ID')}</p>
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-full">Aktif</span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-1 pt-4 border-t border-slate-50">
                    <div className="text-center">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Terbayar</p>
                      <p className="font-bold text-slate-800 text-xs">{activeLoan.payments?.length || 0}x</p>
                    </div>
                    <div className="text-center border-x border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Sisa Rp</p>
                      <p className="font-bold text-rose-600 text-xs">{(activeLoan.total_to_pay / 1000).toFixed(0)}k</p>
                    </div>
                    <div className="text-center border-r border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Sisa Kali</p>
                      <p className="font-bold text-amber-600 text-xs">{activeLoan.weeks - (activeLoan.payments?.length || 0)}x</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Next</p>
                      <p className="font-bold text-indigo-600 text-xs">Ke-{(activeLoan.payments?.length || 0) + 1}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cicilan</p>
                      <p className="font-bold text-slate-800">Rp {activeLoan.installment_amount.toLocaleString('id-ID')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Durasi</p>
                      <p className="font-bold text-slate-800">{activeLoan.weeks} Minggu</p>
                    </div>
                  </div>

                  <Button className="w-full" onClick={() => setShowPaymentForm(activeLoan)}>
                    Bayar Cicilan
                  </Button>
                </Card>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Riwayat Cicilan</h3>
                  <Card className="divide-y divide-slate-50">
                    {activeLoan.payments?.map((p, idx) => (
                      <div key={p.id} className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-800">
                            Cicilan Ke-{(activeLoan.payments?.length || 0) - idx}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {new Date(p.payment_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} • {new Date(p.payment_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-rose-600">-Rp {p.amount_paid.toLocaleString('id-ID')}</p>
                          <p className="text-[10px] text-slate-400">Sisa: Rp {p.remaining_balance.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                    {(!activeLoan.payments || activeLoan.payments.length === 0) && (
                      <div className="p-8 text-center text-slate-400 text-sm">Belum ada pembayaran cicilan</div>
                    )}
                  </Card>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400">
                <CreditCard className="mx-auto mb-2 opacity-20" size={48} />
                <p>Tidak ada pinjaman aktif</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showProfile && (
          <Modal title="Profil Nasabah" onClose={() => setShowProfile(false)}>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Lengkap</p>
                  <p className="font-bold text-slate-800">{member.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No. KTP</p>
                  <p className="font-bold text-slate-800">{member.ktp || '-'}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alamat Lengkap</p>
                <p className="font-bold text-slate-800">{member.address || '-'}</p>
                <p className="text-xs text-slate-500">RT/RW: {member.rt_rw || '-'} • Kel: {member.kel || '-'} • Kec: {member.kec || '-'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jenis Usaha</p>
                  <p className="font-bold text-slate-800">{member.business || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lokasi Usaha</p>
                  <p className="font-bold text-slate-800">{member.business_location || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wilayah</p>
                  <p className="font-bold text-slate-800">{member.region || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hari Penagihan</p>
                  <p className="font-bold text-emerald-600">{member.collection_day || 'Belum diatur'}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No. Registrasi</p>
                <p className="font-bold text-slate-800">{member.registration_no || '-'}</p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Terdaftar Sejak</p>
                <p className="text-center font-medium text-slate-600">
                  {new Date(member.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              <Button className="w-full" variant="secondary" onClick={() => setShowProfile(false)}>
                Tutup
              </Button>
            </div>
          </Modal>
        )}

        {showSavingForm && (
          <Modal title="Setoran Simpanan" onClose={() => setShowSavingForm(false)}>
            <SavingForm memberId={id} onCancel={() => setShowSavingForm(false)} onSuccess={() => { setShowSavingForm(false); fetchMember(); }} />
          </Modal>
        )}
        {showWithdrawForm && (
          <Modal title="Pencairan Simpanan" onClose={() => setShowWithdrawForm(false)}>
            <WithdrawalForm
              memberId={id}
              currentBalance={savingsBalance}
              onCancel={() => setShowWithdrawForm(false)}
              onSuccess={() => { setShowWithdrawForm(false); fetchMember(); }}
            />
          </Modal>
        )}
        {showLoanForm && (
          <Modal title="Pinjaman Baru" onClose={() => setShowLoanForm(false)}>
            <LoanForm memberId={id} onCancel={() => setShowLoanForm(false)} onSuccess={() => { setShowLoanForm(false); fetchMember(); }} />
          </Modal>
        )}
        {showPaymentForm && (
          <Modal title="Bayar Cicilan" onClose={() => setShowPaymentForm(null)}>
            <PaymentForm loan={showPaymentForm} onCancel={() => setShowPaymentForm(null)} onSuccess={() => { setShowPaymentForm(null); fetchMember(); }} />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

const Modal = ({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
  >
    <motion.div 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl"
    >
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">✕</button>
      </div>
      <div className="p-6">
        {children}
      </div>
    </motion.div>
  </motion.div>
);

const getLocalISOString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const SavingForm = ({ memberId, onCancel, onSuccess }: { memberId: number, onCancel: () => void, onSuccess: () => void }) => {
  const [data, setData] = useState({ 
    date: getLocalISOString(), 
    description: '', 
    wajib: '', 
    khusus: '' 
  });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Convert local datetime-local string to UTC ISO string for storage
    const utcDate = new Date(data.date).toISOString();
    const res = await apiFetch('/api/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, date: utcDate, member_id: memberId })
    });
    if (res.ok) onSuccess();
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Tanggal & Waktu" type="datetime-local" required value={data.date} onChange={e => setData({...data, date: e.target.value})} />
      <Input label="Simpanan Wajib (Rp)" type="number" value={data.wajib} onChange={e => setData({...data, wajib: e.target.value})} />
      <Input label="Simpanan Khusus (Rp)" type="number" value={data.khusus} onChange={e => setData({...data, khusus: e.target.value})} />
      <Input label="Keterangan" value={data.description} onChange={e => setData({...data, description: e.target.value})} />
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Batal</Button>
        <Button type="submit" className="flex-1">Simpan</Button>
      </div>
    </form>
  );
};

const WithdrawalForm = ({ memberId, currentBalance, onCancel, onSuccess }: { memberId: number, currentBalance: number, onCancel: () => void, onSuccess: () => void }) => {
  const [data, setData] = useState({
    date: getLocalISOString(),
    description: '',
    amount: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(data.amount) || 0;
    if (amount <= 0) {
      alert('Nominal pencairan harus lebih dari 0.');
      return;
    }
    if (amount > currentBalance) {
      alert('Nominal melebihi saldo simpanan.');
      return;
    }

    const utcDate = new Date(data.date).toISOString();
    const res = await apiFetch('/api/savings/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, amount, date: utcDate, member_id: memberId })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Pencairan gagal diproses.');
      return;
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Tanggal & Waktu Pencairan" type="datetime-local" required value={data.date} onChange={e => setData({ ...data, date: e.target.value })} />
      <Input label="Nominal Pencairan (Rp)" type="number" required value={data.amount} onChange={e => setData({ ...data, amount: e.target.value })} />
      <Input label="Keterangan" value={data.description} onChange={e => setData({ ...data, description: e.target.value })} />
      <div className="p-4 bg-slate-50 rounded-2xl">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo Tersedia</p>
        <p className="font-black text-slate-900">Rp {currentBalance.toLocaleString('id-ID')}</p>
      </div>
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Batal</Button>
        <Button type="submit" variant="danger" className="flex-1">Cairkan</Button>
      </div>
    </form>
  );
};

const LoanForm = ({ memberId, onCancel, onSuccess }: { memberId: number, onCancel: () => void, onSuccess: () => void }) => {
  const [data, setData] = useState({ 
    loan_date: getLocalISOString().split('T')[0], 
    amount: '', 
    admin_fee: '0',
    disbursed_amount: '0',
    initial_savings: '0',
    include_savings: true,
    installment_amount: '', 
    weeks: '10', 
    total_to_pay: '' 
  });
  
  const calculateTotal = (amount: string, weeks: string, includeSavings: boolean) => {
    const amt = parseInt(amount) || 0;
    const wks = parseInt(weeks) || 1;
    
    // New Rules: 5% Admin Fee
    const adminFee = Math.round(amt * 0.05);
    // Optional 5% Mandatory Savings
    const initialSavings = includeSavings ? Math.round(amt * 0.05) : 0;
    const disbursed = amt - adminFee - initialSavings;

    // 20% Interest on Principal (Updated from 10%)
    const interest = Math.round(amt * 0.2);
    const total = amt + interest;
    const inst = Math.ceil(total / wks);
    
    setData(prev => ({ 
      ...prev, 
      admin_fee: adminFee.toString(),
      initial_savings: initialSavings.toString(),
      disbursed_amount: disbursed.toString(),
      total_to_pay: total.toString(), 
      installment_amount: inst.toString() 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // For loan_date (date only), we can keep it as YYYY-MM-DD or convert to UTC start of day
    // Let's keep it simple and just use the date string, but for consistency let's use ISO
    const utcDate = new Date(data.loan_date).toISOString();
    const res = await apiFetch('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, loan_date: utcDate, member_id: memberId })
    });
    if (res.ok) onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Tanggal Pinjaman" type="date" required value={data.loan_date} onChange={e => setData({...data, loan_date: e.target.value})} />
      <Input 
        label="Besar Pinjaman (Rp)" 
        type="number" 
        required 
        value={data.amount} 
        onChange={e => {
          setData({...data, amount: e.target.value});
          calculateTotal(e.target.value, data.weeks, data.include_savings);
        }} 
      />

      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
        <input 
          type="checkbox" 
          id="include_savings"
          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          checked={data.include_savings}
          onChange={e => {
            const val = e.target.checked;
            setData({...data, include_savings: val});
            calculateTotal(data.amount, data.weeks, val);
          }}
        />
        <label htmlFor="include_savings" className="text-xs font-bold text-slate-700 cursor-pointer">
          Potong Simpanan Wajib (5%)
        </label>
      </div>
      
      <div className="p-4 bg-slate-50 rounded-2xl space-y-2 border border-slate-100">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Rincian Potongan</h4>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Biaya Admin (5%)</span>
          <span className="font-bold text-rose-500">-Rp {parseInt(data.admin_fee).toLocaleString()}</span>
        </div>
        {data.include_savings && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Simpanan Wajib (5%)</span>
            <span className="font-bold text-amber-600">-Rp {parseInt(data.initial_savings).toLocaleString()}</span>
          </div>
        )}
        <div className="pt-2 border-t border-slate-200 flex justify-between text-sm">
          <span className="font-bold text-slate-700">Diterima Bersih</span>
          <span className="font-black text-emerald-600">Rp {parseInt(data.disbursed_amount).toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input 
          label="Durasi (Minggu)" 
          type="number" 
          required 
          value={data.weeks} 
          onChange={e => {
            setData({...data, weeks: e.target.value});
            calculateTotal(data.amount, e.target.value, data.include_savings);
          }} 
        />
        <Input label="Cicilan / Minggu" type="number" readOnly value={data.installment_amount} />
      </div>
      <Input label="Total Harus Dibayar" type="number" readOnly value={data.total_to_pay} />
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Batal</Button>
        <Button type="submit" className="flex-1">Proses</Button>
      </div>
    </form>
  );
};

const PaymentForm = ({ loan, onCancel, onSuccess }: { loan: Loan, onCancel: () => void, onSuccess: () => void }) => {
  const [data, setData] = useState({ 
    payment_date: getLocalISOString(), 
    amount_paid: loan.installment_amount.toString() 
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paid = parseInt(data.amount_paid);
    const remaining = loan.total_to_pay - paid;
    
    // Convert local datetime-local string to UTC ISO string for storage
    const utcDate = new Date(data.payment_date).toISOString();
    
    const res = await apiFetch('/api/loan-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        loan_id: loan.id, 
        payment_date: utcDate, 
        installment_no: (loan.payments?.length || 0) + 1,
        amount_paid: paid,
        remaining_balance: remaining
      })
    });
    if (res.ok) onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Tanggal & Waktu Bayar" type="datetime-local" required value={data.payment_date} onChange={e => setData({...data, payment_date: e.target.value})} />
      <Input label="Jumlah Bayar (Rp)" type="number" required value={data.amount_paid} onChange={e => setData({...data, amount_paid: e.target.value})} />
      <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
        <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
          <span>Sisa Sebelumnya</span>
          <span className="text-slate-900">Rp {loan.total_to_pay.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
          <span>Sisa Setelah Bayar</span>
          <span className="text-emerald-600">Rp {(loan.total_to_pay - (parseInt(data.amount_paid) || 0)).toLocaleString()}</span>
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Batal</Button>
        <Button type="submit" className="flex-1">Konfirmasi</Button>
      </div>
    </form>
  );
};

const Reports = ({ currentUser, paymentInstructions }: { currentUser: AuthUser, paymentInstructions: PaymentInstructions | null }) => {
  const [dailyReport, setDailyReport] = useState<DailyReport[]>([]);
  const [activeLoans, setActiveLoans] = useState<ActiveLoanReport[]>([]);
  const [activeTab, setActiveTab] = useState<'daily' | 'loans'>('daily');
  const [isResetting, setIsResetting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newAccount, setNewAccount] = useState({ username: '', password: '', role: 'officer' as 'admin' | 'officer' });

  const fetchReports = async () => {
    const [dailyRes, loansRes] = await Promise.all([
      apiFetch('/api/reports/daily'),
      apiFetch('/api/reports/active-loans')
    ]);
    setDailyReport(await dailyRes.json());
    setActiveLoans(await loansRes.json());
  };

  useEffect(() => { fetchReports(); }, []);

  const fetchAccounts = async () => {
    if (currentUser.role !== 'admin') return;
    const res = await apiFetch('/api/admin/accounts');
    if (res.ok) setAccounts(await res.json());
  };

  useEffect(() => {
    fetchAccounts();
  }, [currentUser.role]);

  const handleResetData = async () => {
    const confirmed = window.confirm('Kosongkan semua data uji? Aksi ini akan menghapus anggota, pinjaman, simpanan, dan cicilan.');
    if (!confirmed) return;

    const doubleCheck = window.confirm('Konfirmasi terakhir: lanjutkan reset semua data?');
    if (!doubleCheck) return;

    try {
      setIsResetting(true);
      const res = await apiFetch('/api/testing/reset-data', { method: 'POST' });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        alert(errorBody.error || 'Reset data gagal.');
        return;
      }

      setDailyReport([]);
      setActiveLoans([]);
      alert('Data uji berhasil dikosongkan.');
      window.location.reload();
    } catch (err) {
      alert('Terjadi kendala saat reset data.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch('/api/admin/accounts', {
      method: 'POST',
      body: JSON.stringify(newAccount)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Gagal membuat akun.');
      return;
    }
    setNewAccount({ username: '', password: '', role: 'officer' });
    fetchAccounts();
  };

  const handleToggleAccount = async (acc: Account) => {
    const next = acc.active ? 0 : 1;
    const res = await apiFetch(`/api/admin/accounts/${acc.id}`, {
      method: 'PUT',
      body: JSON.stringify({ active: next })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Gagal mengubah status akun.');
      return;
    }
    fetchAccounts();
  };

  const handleDeleteAccount = async (acc: Account) => {
    const ok = window.confirm(`Hapus akun ${acc.username}?`);
    if (!ok) return;
    const res = await apiFetch(`/api/admin/accounts/${acc.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Gagal menghapus akun.');
      return;
    }
    fetchAccounts();
  };

  const handleRenewAccount = async (acc: Account) => {
    const ok = window.confirm(`Perpanjang akun ${acc.username} untuk 30 hari?`);
    if (!ok) return;
    const res = await apiFetch(`/api/admin/accounts/${acc.id}/renew`, {
      method: 'POST',
      body: JSON.stringify({ days: 30 })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Gagal memperpanjang akun.');
      return;
    }
    alert('Akun berhasil diperpanjang 30 hari.');
    fetchAccounts();
  };

  return (
    <div className="space-y-6 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Laporan</h1>
        <p className="text-slate-500 text-sm">Monitoring transaksi & status pinjaman</p>
      </header>

      {currentUser.role === 'admin' && (
        <Card className="p-4 border-rose-200 bg-rose-50">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-rose-700 uppercase tracking-widest">Mode Testing</p>
              <p className="text-sm text-rose-800">Gunakan untuk mengosongkan seluruh data pengujian secara cepat.</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full border border-rose-300 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              onClick={handleResetData}
              disabled={isResetting}
            >
              {isResetting ? 'Memproses...' : 'Kosongkan Semua Data Uji'}
            </Button>
          </div>
        </Card>
      )}

      {currentUser.role === 'admin' && (
        <Card className="p-4 border-indigo-100 bg-indigo-50 space-y-4">
          <div>
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest">Admin Panel Akun</p>
            <p className="text-sm text-indigo-800">Kelola akun user aplikasi langganan.</p>
          </div>
          <form onSubmit={handleCreateAccount} className="space-y-3">
            <Input label="Username Baru" required value={newAccount.username} onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })} />
            <Input label="Password Baru" type="password" required value={newAccount.password} onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })} />
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Role</label>
              <select
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={newAccount.role}
                onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value as 'admin' | 'officer' })}
              >
                <option value="officer">Officer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button type="submit" className="w-full">Tambah Akun</Button>
          </form>
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div key={acc.id} className="p-3 bg-white rounded-xl border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{acc.username}</p>
                    <p className="text-xs text-slate-500 uppercase">{acc.role} • {acc.active ? 'aktif' : 'nonaktif'}</p>
                    {acc.role === 'officer' && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Berlaku s/d: {acc.subscription_end_at ? new Date(acc.subscription_end_at).toLocaleDateString('id-ID') : '-'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {acc.role === 'officer' && (
                    <Button type="button" className="flex-1" onClick={() => handleRenewAccount(acc)}>
                      Perpanjang 30 Hari
                    </Button>
                  )}
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => handleToggleAccount(acc)}>
                    {acc.active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                  <Button type="button" variant="danger" className="flex-1" onClick={() => handleDeleteAccount(acc)}>
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
            {accounts.length === 0 && <p className="text-sm text-slate-500">Belum ada akun selain akun aktif saat ini.</p>}
            {paymentInstructions && (
              <div className="p-3 rounded-xl bg-white border border-indigo-100 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">Arahan Pembayaran Langganan Officer</p>
                <p>Biaya: {paymentInstructions.feeLabel}</p>
                <p>Pembayaran: {paymentInstructions.payTo}</p>
                <p>Konfirmasi: {paymentInstructions.confirmTo}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="flex bg-slate-100 p-1 rounded-2xl">
        <button 
          onClick={() => setActiveTab('daily')}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'daily' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
        >
          Harian
        </button>
        <button 
          onClick={() => setActiveTab('loans')}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'loans' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
        >
          Pinjaman Aktif
        </button>
      </div>

      {activeTab === 'daily' ? (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Riwayat Koleksi Harian</h3>
          <Card className="divide-y divide-slate-50">
            {dailyReport.map(day => (
              <div key={day.date} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">{new Date(day.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                    S: Rp {day.savings.toLocaleString()} | T: Rp {day.withdrawals.toLocaleString()} | Net: Rp {day.netSavings.toLocaleString()} | P: Rp {day.payments.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">Rp {(day.netSavings + day.payments).toLocaleString('id-ID')}</p>
                </div>
              </div>
            ))}
            {dailyReport.length === 0 && (
              <div className="p-12 text-center text-slate-400">Belum ada data transaksi</div>
            )}
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Daftar Pinjaman Aktif</h3>
          <div className="space-y-3">
            {activeLoans.map(loan => (
              <Card key={loan.id} className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-slate-900">{loan.member_name}</p>
                  <span className="text-[10px] font-bold text-slate-400">{new Date(loan.loan_date).toLocaleDateString('id-ID')}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pinjaman</p>
                    <p className="font-bold text-slate-800">Rp {loan.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sisa</p>
                    <p className="font-bold text-rose-600">Rp {loan.total_to_pay.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
            ))}
            {activeLoans.length === 0 && (
              <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                <p>Tidak ada pinjaman aktif</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'dashboard' | 'members' | 'add-member' | 'member-detail' | 'reports'>('dashboard');
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<PaymentInstructions | null>(null);

  const handleLoginSuccess = (token: string, user: AuthUser, instructions?: PaymentInstructions) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setCurrentUser(user);
    if (instructions) setPaymentInstructions(instructions);
  };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setCurrentUser(null);
    setPaymentInstructions(null);
    setView('dashboard');
  };

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setAuthLoading(false);
      return;
    }

    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) throw new Error('expired');
        const user = await res.json();
        const { paymentInstructions: instructions, ...authUser } = user;
        setCurrentUser(authUser);
        if (instructions) setPaymentInstructions(instructions);
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setCurrentUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    const [membersRes, statsRes, scheduleRes] = await Promise.all([
      apiFetch('/api/members'),
      apiFetch('/api/stats'),
      apiFetch('/api/schedule/today')
    ]);
    if ([membersRes.status, statsRes.status, scheduleRes.status].includes(401)) {
      await handleLogout();
      return;
    }
    setMembers(await membersRes.json());
    setStats(await statsRes.json());
    setSchedule(await scheduleRes.json());
    setLastUpdated(new Date());
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && view === 'dashboard') fetchData();
  }, [view, fetchData, currentUser]);

  useEffect(() => {
    if (view !== 'dashboard') return;

    let midnightIntervalId: number | undefined;
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();

    const midnightTimeoutId = window.setTimeout(() => {
      fetchData();
      midnightIntervalId = window.setInterval(() => {
        fetchData();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    return () => {
      window.clearTimeout(midnightTimeoutId);
      if (midnightIntervalId) window.clearInterval(midnightIntervalId);
    };
  }, [view, fetchData]);

  const renderView = () => {
    switch (view) {
      case 'dashboard': return (
        <Dashboard 
          stats={stats} 
          schedule={schedule} 
          lastUpdated={lastUpdated}
          onSelectMember={(id) => { setSelectedMemberId(id); setView('member-detail'); }}
        />
      );
      case 'reports': return currentUser ? <Reports currentUser={currentUser} paymentInstructions={paymentInstructions} /> : null;
      case 'members': return (
        <MemberList 
          members={members} 
          onSelectMember={(id) => { setSelectedMemberId(id); setView('member-detail'); }}
          onAddMember={() => setView('add-member')}
        />
      );
      case 'add-member': return (
        <MemberForm 
          onBack={() => setView('members')} 
          onSuccess={() => { fetchData(); setView('members'); }} 
        />
      );
      case 'member-detail': return (
        selectedMemberId ? (
          <MemberDetailView 
            id={selectedMemberId} 
            onBack={() => { fetchData(); setView('members'); }} 
          />
        ) : null
      );
    }
  };

  return (
    authLoading ? (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Memuat sesi...</div>
    ) : !currentUser ? (
      <LoginView onLoginSuccess={handleLoginSuccess} />
    ) : (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <main className="max-w-md mx-auto bg-white min-h-screen shadow-xl relative">
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100">
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <span className="min-w-0 text-[11px] font-bold uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-1 truncate">
              {currentUser.username} ({currentUser.role})
            </span>
            <button
              onClick={handleLogout}
              className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-3 py-1"
            >
              Keluar
            </button>
          </div>
        </div>
        {currentUser.role === 'officer' && currentUser.warningH2 && (
          <div className="mx-3 mt-3 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs space-y-1">
            <p className="font-bold">Langganan akan berakhir dalam {currentUser.daysLeft} hari.</p>
            {paymentInstructions && (
              <>
                <p>Biaya: {paymentInstructions.feeLabel}</p>
                <p>Pembayaran: {paymentInstructions.payTo}</p>
                <p>Konfirmasi: {paymentInstructions.confirmTo}</p>
              </>
            )}
          </div>
        )}
        {renderView()}

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/80 backdrop-blur-lg border-t border-slate-100 flex justify-around items-center py-3 px-6 z-40">
          <button 
            onClick={() => setView('dashboard')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'dashboard' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}
          >
            <LayoutDashboard size={22} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Beranda</span>
          </button>
          <button 
            onClick={() => setView('members')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'members' || view === 'member-detail' || view === 'add-member' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}
          >
            <Users size={22} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Anggota</span>
          </button>
          <button 
            onClick={() => setView('reports')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'reports' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}
          >
            <History size={22} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Laporan</span>
          </button>
        </nav>
      </main>
    </div>
    )
  );
}
