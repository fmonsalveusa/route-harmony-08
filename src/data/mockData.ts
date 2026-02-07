import { Load, Driver, Truck, Dispatcher, Investor, Payment, Invoice, User } from '@/types';

export const mockUsers: User[] = [
  { id: 'u1', name: 'Carlos Admin', email: 'admin@tms.com', role: 'admin' },
  { id: 'u2', name: 'María Contadora', email: 'accounting@tms.com', role: 'accounting' },
  { id: 'u3', name: 'Juan Dispatcher', email: 'dispatcher@tms.com', role: 'dispatcher', dispatcherId: 'd1' },
  { id: 'u4', name: 'Ana Dispatch', email: 'dispatcher2@tms.com', role: 'dispatcher', dispatcherId: 'd2' },
];

export const mockDispatchers: Dispatcher[] = [
  { id: 'd1', name: 'Juan Dispatcher', email: 'juan@tms.com', phone: '555-0101', status: 'active', commissionPercentage: 8, payType: 'per_rate', startDate: '2023-06-15', driversCount: 3, loadsThisMonth: 12, commissionsThisMonth: 4800, commissionsPending: 1200 },
  { id: 'd2', name: 'Ana Dispatch', email: 'ana@tms.com', phone: '555-0102', status: 'active', commissionPercentage: 10, payType: 'per_load', startDate: '2023-09-01', driversCount: 2, loadsThisMonth: 8, commissionsThisMonth: 3200, commissionsPending: 800 },
  { id: 'd3', name: 'Roberto Lopez', email: 'roberto@tms.com', phone: '555-0103', status: 'inactive', commissionPercentage: 7, payType: 'per_rate', startDate: '2022-01-10', driversCount: 0, loadsThisMonth: 0, commissionsThisMonth: 0, commissionsPending: 0 },
];

export const mockDrivers: Driver[] = [
  { id: 'dr1', name: 'Pedro Martinez', license: 'CDL-A-12345', phone: '555-1001', email: 'pedro@email.com', status: 'assigned', dispatcherId: 'd1', truckId: 't1', payPercentage: 30, hireDate: '2023-01-15', loadsThisMonth: 5, earningsThisMonth: 7500 },
  { id: 'dr2', name: 'Miguel Rodriguez', license: 'CDL-A-23456', phone: '555-1002', email: 'miguel@email.com', status: 'available', dispatcherId: 'd1', truckId: 't2', payPercentage: 28, hireDate: '2023-03-20', loadsThisMonth: 4, earningsThisMonth: 5600 },
  { id: 'dr3', name: 'Luis Garcia', license: 'CDL-A-34567', phone: '555-1003', email: 'luis@email.com', status: 'assigned', dispatcherId: 'd1', truckId: 't3', payPercentage: 32, hireDate: '2022-11-05', loadsThisMonth: 6, earningsThisMonth: 9600 },
  { id: 'dr4', name: 'Carlos Hernandez', license: 'CDL-A-45678', phone: '555-1004', email: 'carlos@email.com', status: 'available', dispatcherId: 'd2', truckId: 't4', payPercentage: 30, hireDate: '2023-07-01', loadsThisMonth: 3, earningsThisMonth: 4200 },
  { id: 'dr5', name: 'Jose Perez', license: 'CDL-A-56789', phone: '555-1005', email: 'jose@email.com', status: 'resting', dispatcherId: 'd2', payPercentage: 29, hireDate: '2023-05-10', loadsThisMonth: 4, earningsThisMonth: 5800 },
  { id: 'dr6', name: 'Fernando Diaz', license: 'CDL-A-67890', phone: '555-1006', email: 'fernando@email.com', status: 'inactive', dispatcherId: 'd3', payPercentage: 30, hireDate: '2022-06-01', loadsThisMonth: 0, earningsThisMonth: 0 },
];

export const mockTrucks: Truck[] = [
  { id: 't1', plateNumber: 'TX-4521', model: 'Freightliner Cascadia', year: 2022, status: 'on_route', investorId: 'inv1', driverId: 'dr1' },
  { id: 't2', plateNumber: 'CA-7832', model: 'Peterbilt 579', year: 2023, status: 'available', investorId: 'inv1', driverId: 'dr2' },
  { id: 't3', plateNumber: 'FL-1245', model: 'Kenworth T680', year: 2021, status: 'on_route', investorId: 'inv2', driverId: 'dr3' },
  { id: 't4', plateNumber: 'IL-9087', model: 'Volvo VNL 860', year: 2023, status: 'available', driverId: 'dr4' },
  { id: 't5', plateNumber: 'GA-3456', model: 'Mack Anthem', year: 2020, status: 'maintenance' },
];

export const mockInvestors: Investor[] = [
  { id: 'inv1', name: 'Ricardo Investments LLC', email: 'ricardo@invest.com', phone: '555-2001', trucks: ['t1', 't2'] },
  { id: 'inv2', name: 'TransCapital Group', email: 'info@transcapital.com', phone: '555-2002', trucks: ['t3'] },
];

export const mockLoads: Load[] = [
  { id: 'l1', referenceNumber: 'RC-2024-001', origin: 'Houston, TX', destination: 'Dallas, TX', pickupDate: '2024-01-15', deliveryDate: '2024-01-16', weight: 42000, cargoType: 'Dry Van', totalRate: 2500, status: 'delivered', driverId: 'dr1', truckId: 't1', dispatcherId: 'd1', brokerClient: 'ABC Logistics', driverPayAmount: 750, investorPayAmount: 375, dispatcherPayAmount: 200, companyProfit: 1175, createdAt: '2024-01-14' },
  { id: 'l2', referenceNumber: 'RC-2024-002', origin: 'Los Angeles, CA', destination: 'Phoenix, AZ', pickupDate: '2024-01-16', deliveryDate: '2024-01-17', weight: 38000, cargoType: 'Reefer', totalRate: 3200, status: 'in_transit', driverId: 'dr3', truckId: 't3', dispatcherId: 'd1', brokerClient: 'XYZ Freight', driverPayAmount: 1024, investorPayAmount: 480, dispatcherPayAmount: 256, companyProfit: 1440, createdAt: '2024-01-15' },
  { id: 'l3', referenceNumber: 'RC-2024-003', origin: 'Miami, FL', destination: 'Atlanta, GA', pickupDate: '2024-01-17', deliveryDate: '2024-01-18', weight: 35000, cargoType: 'Flatbed', totalRate: 2800, status: 'pending', driverId: undefined, truckId: undefined, dispatcherId: 'd2', brokerClient: 'Southern Transport', driverPayAmount: 0, investorPayAmount: 0, dispatcherPayAmount: 0, companyProfit: 0, createdAt: '2024-01-16' },
  { id: 'l4', referenceNumber: 'RC-2024-004', origin: 'Chicago, IL', destination: 'Detroit, MI', pickupDate: '2024-01-18', deliveryDate: '2024-01-19', weight: 40000, cargoType: 'Dry Van', totalRate: 1800, status: 'paid', driverId: 'dr4', truckId: 't4', dispatcherId: 'd2', brokerClient: 'MidWest Carriers', driverPayAmount: 540, investorPayAmount: 0, dispatcherPayAmount: 180, companyProfit: 1080, createdAt: '2024-01-17' },
  { id: 'l5', referenceNumber: 'RC-2024-005', origin: 'Denver, CO', destination: 'Salt Lake City, UT', pickupDate: '2024-01-19', deliveryDate: '2024-01-20', weight: 44000, cargoType: 'Reefer', totalRate: 3500, status: 'delivered', driverId: 'dr1', truckId: 't1', dispatcherId: 'd1', brokerClient: 'Mountain Freight', driverPayAmount: 1050, investorPayAmount: 525, dispatcherPayAmount: 280, companyProfit: 1645, createdAt: '2024-01-18' },
  { id: 'l6', referenceNumber: 'RC-2024-006', origin: 'Nashville, TN', destination: 'Memphis, TN', pickupDate: '2024-01-20', deliveryDate: '2024-01-20', weight: 25000, cargoType: 'Dry Van', totalRate: 1200, status: 'in_transit', driverId: 'dr2', truckId: 't2', dispatcherId: 'd1', brokerClient: 'Swift Connect', driverPayAmount: 336, investorPayAmount: 180, dispatcherPayAmount: 96, companyProfit: 588, createdAt: '2024-01-19' },
  { id: 'l7', referenceNumber: 'RC-2024-007', origin: 'San Antonio, TX', destination: 'El Paso, TX', pickupDate: '2024-01-21', deliveryDate: '2024-01-22', weight: 41000, cargoType: 'Flatbed', totalRate: 2900, status: 'pending', driverId: 'dr5', truckId: undefined, dispatcherId: 'd2', brokerClient: 'Border Logistics', driverPayAmount: 841, investorPayAmount: 0, dispatcherPayAmount: 290, companyProfit: 1769, createdAt: '2024-01-20' },
  { id: 'l8', referenceNumber: 'RC-2024-008', origin: 'Seattle, WA', destination: 'Portland, OR', pickupDate: '2024-01-22', deliveryDate: '2024-01-22', weight: 30000, cargoType: 'Dry Van', totalRate: 1500, status: 'cancelled', driverId: undefined, truckId: undefined, dispatcherId: 'd1', brokerClient: 'Pacific Routes', driverPayAmount: 0, investorPayAmount: 0, dispatcherPayAmount: 0, companyProfit: 0, createdAt: '2024-01-21' },
];

export const mockPayments: Payment[] = [
  { id: 'p1', loadId: 'l1', recipientId: 'dr1', recipientType: 'driver', recipientName: 'Pedro Martinez', amount: 750, status: 'paid', date: '2024-01-20', loadReference: 'RC-2024-001' },
  { id: 'p2', loadId: 'l1', recipientId: 'inv1', recipientType: 'investor', recipientName: 'Ricardo Investments LLC', amount: 375, status: 'paid', date: '2024-01-20', loadReference: 'RC-2024-001' },
  { id: 'p3', loadId: 'l1', recipientId: 'd1', recipientType: 'dispatcher', recipientName: 'Juan Dispatcher', amount: 200, status: 'paid', date: '2024-01-20', loadReference: 'RC-2024-001' },
  { id: 'p4', loadId: 'l5', recipientId: 'dr1', recipientType: 'driver', recipientName: 'Pedro Martinez', amount: 1050, status: 'pending', date: '', loadReference: 'RC-2024-005' },
  { id: 'p5', loadId: 'l5', recipientId: 'inv1', recipientType: 'investor', recipientName: 'Ricardo Investments LLC', amount: 525, status: 'pending', date: '', loadReference: 'RC-2024-005' },
  { id: 'p6', loadId: 'l5', recipientId: 'd1', recipientType: 'dispatcher', recipientName: 'Juan Dispatcher', amount: 280, status: 'pending', date: '', loadReference: 'RC-2024-005' },
  { id: 'p7', loadId: 'l4', recipientId: 'dr4', recipientType: 'driver', recipientName: 'Carlos Hernandez', amount: 540, status: 'paid', date: '2024-01-22', loadReference: 'RC-2024-004' },
  { id: 'p8', loadId: 'l4', recipientId: 'd2', recipientType: 'dispatcher', recipientName: 'Ana Dispatch', amount: 180, status: 'pending', date: '', loadReference: 'RC-2024-004' },
];

export const mockInvoices: Invoice[] = [
  { id: 'inv-1', loadId: 'l1', clientName: 'ABC Logistics', amount: 2500, status: 'paid', issueDate: '2024-01-16', dueDate: '2024-02-16' },
  { id: 'inv-2', loadId: 'l4', clientName: 'MidWest Carriers', amount: 1800, status: 'paid', issueDate: '2024-01-19', dueDate: '2024-02-19' },
  { id: 'inv-3', loadId: 'l5', clientName: 'Mountain Freight', amount: 3500, status: 'pending', issueDate: '2024-01-20', dueDate: '2024-02-20' },
  { id: 'inv-4', loadId: 'l2', clientName: 'XYZ Freight', amount: 3200, status: 'pending', issueDate: '2024-01-17', dueDate: '2024-02-17' },
];
