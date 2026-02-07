export type UserRole = 'admin' | 'accounting' | 'dispatcher';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  dispatcherId?: string;
}

export interface Load {
  id: string;
  referenceNumber: string;
  origin: string;
  destination: string;
  pickupDate: string;
  deliveryDate: string;
  weight: number;
  cargoType: string;
  totalRate: number;
  status: 'pending' | 'in_transit' | 'delivered' | 'paid' | 'cancelled';
  driverId?: string;
  truckId?: string;
  dispatcherId: string;
  brokerClient: string;
  driverPayAmount: number;
  investorPayAmount: number;
  dispatcherPayAmount: number;
  companyProfit: number;
  createdAt: string;
}

export interface Driver {
  id: string;
  name: string;
  license: string;
  phone: string;
  email: string;
  status: 'available' | 'assigned' | 'resting' | 'inactive';
  dispatcherId: string;
  truckId?: string;
  payPercentage: number;
  hireDate: string;
  loadsThisMonth: number;
  earningsThisMonth: number;
}

export interface Truck {
  id: string;
  plateNumber: string;
  model: string;
  year: number;
  status: 'available' | 'on_route' | 'maintenance';
  investorId?: string;
  driverId?: string;
}

export interface Dispatcher {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  commissionPercentage: number;
  commissionFixed?: number;
  payType: 'per_load' | 'per_rate';
  startDate: string;
  driversCount: number;
  loadsThisMonth: number;
  commissionsThisMonth: number;
  commissionsPending: number;
}

export interface Investor {
  id: string;
  name: string;
  email: string;
  phone: string;
  trucks: string[];
}

export interface Payment {
  id: string;
  loadId: string;
  recipientId: string;
  recipientType: 'driver' | 'investor' | 'dispatcher';
  recipientName: string;
  amount: number;
  status: 'pending' | 'processing' | 'paid';
  date: string;
  loadReference: string;
}

export interface Invoice {
  id: string;
  loadId: string;
  clientName: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  issueDate: string;
  dueDate: string;
}
