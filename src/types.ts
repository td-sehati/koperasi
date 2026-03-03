export interface Member {
  id: number;
  name: string;
  ktp: string;
  address: string;
  rt_rw: string;
  kel: string;
  kec: string;
  business: string;
  business_location: string;
  region: string;
  registration_no: string;
  collection_day: string;
  created_at: string;
}

export interface Saving {
  id: number;
  member_id: number;
  date: string;
  description: string;
  wajib: number;
  khusus: number;
  total: number;
}

export interface SavingWithdrawal {
  id: number;
  member_id: number;
  date: string;
  description: string;
  amount: number;
}

export interface Loan {
  id: number;
  member_id: number;
  loan_date: string;
  amount: number;
  admin_fee: number;
  disbursed_amount: number;
  installment_amount: number;
  weeks: number;
  total_to_pay: number;
  status: 'active' | 'closed';
  payments?: LoanPayment[];
}

export interface LoanPayment {
  id: number;
  loan_id: number;
  payment_date: string;
  installment_no: number;
  amount_paid: number;
  remaining_balance: number;
}

export interface MemberDetail extends Member {
  savings: Saving[];
  withdrawals: SavingWithdrawal[];
  loans: Loan[];
}

export interface Stats {
  totalMembers: number;
  todayCollections: number;
  todaySavings: number;
  todayWithdrawals: number;
  todayPayments: number;
}

export interface DailyReport {
  date: string;
  savings: number;
  withdrawals: number;
  netSavings: number;
  payments: number;
}

export interface ActiveLoanReport extends Loan {
  member_name: string;
}

export interface ScheduleItem extends Member {
  amount: number;
  total_to_pay: number;
  installment_amount: number;
  paid_today: number;
}

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'officer';
  subscription_start_at?: string | null;
  subscription_end_at?: string | null;
  daysLeft?: number | null;
  warningH2?: boolean;
  expired?: boolean;
}

export interface Account extends AuthUser {
  active: number;
  created_at: string;
}

export interface PaymentInstructions {
  feeLabel: string;
  payTo: string;
  confirmTo: string;
}
