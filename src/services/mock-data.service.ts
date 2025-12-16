
import { Injectable, signal, inject, Injector } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { of, Observable, map } from 'rxjs';
import { JobPreferences } from './auth.service';

export interface TimeEntry {
  hours: number;
  description: string;
  memberId: number;
  date?: Date; // Added for precise tracking
}

export interface ProjectFile {
  id: string;
  name: string;
  url: string;
  type: 'doc' | 'sheet' | 'image' | 'pdf' | 'other';
  size: string;
  uploadedAt: Date;
  uploadedBy: number;
}

export interface ProjectComment {
  id: string;
  text: string;
  createdAt: Date;
  authorId: number;
}

export interface WikiSection {
  id: string;
  title: string;
  content: string;
  lastUpdated: Date;
}

export interface Project {
  id: number;
  clientId: number;
  name: string;
  description?: string;
  status: 'Active' | 'Completed' | 'Paused' | 'Archived';
  billingType: 'hourly' | 'fixed';
  fixedPrice?: number;
  defaultRate?: number;
  hours: { [week: string]: { [day: string]: TimeEntry } };
  allocatedTeamMemberIds: number[];
  memberRates: { [memberId: number]: number }; // Cost to owner
  memberPaymentTypes?: { [memberId: number]: 'hourly' | 'fixed' }; // How member is paid
  files?: ProjectFile[];
  comments?: ProjectComment[];
  createdAt: Date;
  color?: string;
  wiki: WikiSection[]; // Replaces specifics string
  isPinned?: boolean; // New property for sidebar favorites
}

export interface Client {
  id: number;
  name: string;
  contact: string;
  phone: string;
  address: string;
  taxNumber: string;
  logoUrl: string;
  status: 'Active' | 'Paused';
  defaultTaxRate?: number;
  notes?: string;
}

export interface TeamMember {
  id: number;
  name: string;
  email: string; 
  role: string;
  avatarUrl: string;
  defaultHourlyRate: number;
  status: 'Active' | 'Invited' | 'Inactive';
  paymentDetails?: {
      iban?: string;
      bankName?: string;
      swift?: string;
      wiseEmail?: string;
      paypalEmail?: string;
      revolutTag?: string;
  };
}

export interface Invoice {
  id: string;
  type: 'Revenue' | 'Expense'; 
  clientId?: number | null; 
  teamMemberId?: number | null; 
  manualClientDetails?: {
      name: string;
      email: string;
      address: string;
      taxNumber?: string;
  };
  projectIds: number[];
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Generated'; 
  paymentMethod?: 'manual' | 'paypal' | 'stripe';
}

export interface Proposal {
  id: string;
  clientId?: number | null; 
  clientName: string;
  projectName: string;
  createdAt: Date;
  startDate?: string;
  endDate?: string;
  totalAmount: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected';
  sections: any[]; 
}

export interface Job {
    id: string;
    title: string;
    company: string;
    companyLogo: string;
    location: string;
    workModel: 'Remote' | 'Hybrid' | 'On-site';
    salary: { min: number; max: number; currency: string; period: 'year' | 'hour' };
    description: string;
    tags: string[];
    postedDate: Date;
    url: string;
}

export interface Board {
  id: string;
  projectId: number;
  name: string;
  color?: string;
}

export interface TaskComment {
  id: string;
  authorId: number; 
  text: string;
  createdAt: Date;
}

export interface Task {
  id: string;
  projectId: number;
  boardId: string | null; 
  title: string;
  description?: string;
  estimatedDays?: number;
  assignedMemberId: number;
  status: 'To Do' | 'In Progress' | 'On Hold' | 'Completed' | 'Archived';
  priority: 'Low' | 'Medium' | 'High';
  isBilled: boolean;
  createdAt: Date;
  updatedAt: Date;
  comments: TaskComment[];
  order: number;
}

export interface Meeting {
  id: string;
  title: string;
  clientId?: number | null; 
  clientName?: string; 
  guestEmail?: string; 
  startTime: Date;
  endTime: Date;
  platform: 'Google Meet' | 'Zoom' | 'Phone' | 'In-Person';
  link?: string;
  description?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
}

export interface Payment {
    id: string;
    recipientName: string;
    recipientRole: string;
    recipientEmail?: string;
    amount: number;
    currency: string;
    date: Date;
    status: 'Paid' | 'Pending' | 'Processing' | 'Failed';
    method: 'Revolut' | 'Wise' | 'Viva' | 'PayPal' | 'Manual';
    description: string;
    externalReference?: string;
    projectId?: number; // Linked project for debt calculation
    memberId?: number; // Linked member
}

// --- Data Generators ---

const COMPANIES = [
  'Acme Corp', 'Globex', 'Soylent Corp', 'Initech', 'Umbrella Corp', 'Stark Ind', 'Wayne Ent', 
  'Cyberdyne', 'Massive Dynamic', 'Hooli', 'Pied Piper', 'E Corp', 'Vandelay Ind', 'Aperture Science', 
  'Black Mesa', 'Tyrell Corp', 'Oceanic Airlines', 'Virtucon', 'Genco', 'Oscorp', 'Nakatomi', 
  'Prestige Worldwide', 'Stark Industries', 'Cyberdyne Systems', 'Weyland-Yutani', 'Dharma Initiative',
  'Sterling Cooper', 'Los Pollos Hermanos', 'Vehement Capital', 'Strickland Propane'
];

const NAMES = [
  'Alex Doe', 'Jane Smith', 'Samuel Green', 'Brenda Blue', 'Mike Brown', 'Olivia White', 'Chris Black', 
  'Sarah Connor', 'John Wick', 'Ellen Ripley', 'Marty McFly', 'Doc Brown', 'Luke Skywalker', 
  'Leia Organa', 'Han Solo', 'Tony Stark', 'Bruce Wayne', 'Clark Kent', 'Diana Prince', 'Peter Parker',
  'Natasha Romanoff', 'Steve Rogers', 'Wanda Maximoff', 'Vision', 'Thor Odinson'
];

const ROLES = [
  'Founder', 'Frontend Developer', 'Backend Developer', 'UI/UX Designer', 'Project Manager', 'DevOps Engineer', 
  'QA Tester', 'Data Scientist', 'Mobile Developer', 'Product Owner', 'System Architect'
];

const PALETTE = ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981'];

// 1. Generate Clients (30 clients)
const MOCK_CLIENTS: Client[] = COMPANIES.map((name, i) => ({
    id: i + 1,
    name,
    contact: `contact@${name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
    phone: `555-01${String(i).padStart(2, '0')}`,
    address: `${100 + i} Enterprise Blvd, Tech City`,
    taxNumber: `US-${10000 + i}`,
    logoUrl: `https://picsum.photos/seed/${i + 50}/100/100`,
    status: i % 8 === 0 ? 'Paused' : 'Active',
    defaultTaxRate: 10 + (i % 10),
    notes: 'Key client account. Prefer weekly updates on Fridays.'
}));

// 2. Generate Members (25 members)
const MOCK_MEMBERS: TeamMember[] = NAMES.map((name, i) => ({
    id: i + 1,
    name,
    email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
    role: i === 0 ? 'Founder' : ROLES[i % ROLES.length], // Ensure first user is founder
    avatarUrl: `https://picsum.photos/seed/${name.replace(' ', '')}/100/100`,
    defaultHourlyRate: 50 + Math.floor(Math.random() * 100),
    status: i > 20 ? 'Invited' : (i > 22 ? 'Inactive' : 'Active'),
    paymentDetails: {
        iban: `US${Math.floor(Math.random() * 1000000000000)}`,
        bankName: 'Global Tech Bank',
        paypalEmail: `${name.toLowerCase().replace(' ', '.')}@example.com`,
        revolutTag: `@${name.toLowerCase().replace(' ', '')}`
    }
}));

// Helper for week ID
const getWeekId = (d: Date): string => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

const generateMockHours = (allocatedMembers: number[]) => {
   const hours: any = {};
   const today = new Date();
   for (let w = -6; w < 2; w++) {
       const d = new Date(today);
       d.setDate(today.getDate() + (w * 7));
       const weekId = getWeekId(d);
       hours[weekId] = {};
       const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
       days.forEach(day => {
           if(Math.random() > 0.6 && allocatedMembers.length > 0) {
               const memberId = allocatedMembers[Math.floor(Math.random()*allocatedMembers.length)];
               const entryDate = new Date(d);
               // simple date offset for mock
               entryDate.setDate(d.getDate() + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(day)); 
               
               hours[weekId][day] = {
                   hours: Math.floor(Math.random() * 6) + 2, 
                   description: 'Work log',
                   memberId,
                   date: entryDate
               };
           }
       });
   }
   return hours;
};

const MOCK_PROJECTS: Project[] = [];
let projectIdCounter = 1;
MOCK_CLIENTS.forEach((client, idx) => {
    const numProjects = Math.floor(Math.random() * 4) + 1; 
    for (let i = 0; i < numProjects; i++) {
        const status: any = Math.random() > 0.7 ? 'Completed' : 'Active';
        const billingType: 'hourly' | 'fixed' = Math.random() > 0.8 ? 'fixed' : 'hourly';
        const numMembers = Math.floor(Math.random() * 5) + 1;
        const members = [...MOCK_MEMBERS].sort(() => 0.5 - Math.random()).slice(0, numMembers);
        
        const memberRates: any = {};
        const memberPaymentTypes: any = {};
        
        members.forEach(m => {
            memberRates[m.id] = m.defaultHourlyRate;
            memberPaymentTypes[m.id] = 'hourly';
        });

        const memberIds = members.map(m => m.id);
        const fixedPrice = billingType === 'fixed' ? (Math.floor(Math.random() * 50) + 10) * 100 : undefined;
        const defaultRate = billingType === 'hourly' ? (Math.floor(Math.random() * 10) + 5) * 10 : undefined;
        
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 365));

        // Generate Mock Files
        const numFiles = Math.floor(Math.random() * 8) + 2;
        const files: ProjectFile[] = [];
        for(let f=0; f<numFiles; f++) {
            const types: ProjectFile['type'][] = ['doc', 'sheet', 'pdf', 'image'];
            const type = types[Math.floor(Math.random() * types.length)];
            files.push({
                id: crypto.randomUUID(),
                name: `${client.name} ${type === 'sheet' ? 'Budget' : 'Specs'} v${f+1}.${type === 'sheet' ? 'xlsx' : (type === 'doc' ? 'docx' : type === 'pdf' ? 'pdf' : 'png')}`,
                type,
                size: `${Math.floor(Math.random() * 10) + 1} MB`,
                url: '#',
                uploadedAt: new Date(createdAt.getTime() + Math.floor(Math.random() * 100000000)),
                uploadedBy: memberIds[0]
            });
        }

        MOCK_PROJECTS.push({
            id: projectIdCounter++,
            clientId: client.id,
            name: `${client.name} Project ${String.fromCharCode(65 + i)}`,
            description: `Strategic project for ${client.name}.`,
            wiki: [
                { id: '1', title: 'Overview', content: 'This project aims to deliver a high-quality solution.', lastUpdated: new Date() },
                { id: '2', title: 'Tech Stack', content: '- Angular v18\n- Node.js\n- PostgreSQL', lastUpdated: new Date() },
                { id: '3', title: 'Credentials', content: '**Staging:**\nUser: admin\nPass: admin123', lastUpdated: new Date() }
            ],
            status,
            billingType,
            fixedPrice,
            defaultRate,
            allocatedTeamMemberIds: memberIds,
            memberRates,
            memberPaymentTypes,
            hours: billingType === 'hourly' ? generateMockHours(memberIds) : {},
            files: files,
            comments: [],
            createdAt,
            color: PALETTE[(idx + i) % PALETTE.length],
            isPinned: Math.random() > 0.9 // Randomly pin some projects
        });
    }
});

const MOCK_TASKS: Task[] = [];
const MOCK_BOARDS: Board[] = [];
MOCK_PROJECTS.forEach((project, idx) => {
    const boardId = `board-${project.id}`;
    MOCK_BOARDS.push({ 
      id: boardId, 
      projectId: project.id, 
      name: 'Main Board',
      color: PALETTE[(idx + 2) % PALETTE.length] 
    });
    const numTasks = Math.floor(Math.random() * 12) + 3; 
    for(let i=0; i<numTasks; i++) {
        MOCK_TASKS.push({
            id: crypto.randomUUID(),
            projectId: project.id,
            boardId: boardId,
            title: `Task ${i + 1}: Implementation`,
            description: 'Implement core features and ensure responsiveness.',
            estimatedDays: Math.floor(Math.random() * 5) + 1,
            assignedMemberId: project.allocatedTeamMemberIds[0] || 1,
            status: 'To Do',
            priority: 'Medium',
            isBilled: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            comments: [],
            order: i * 1000 // Spaced order for easier insertion
        });
    }
});

const MOCK_INVOICES: Invoice[] = []; 
for (let i=0; i < 150; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 120));
    
    const client = MOCK_CLIENTS[Math.floor(Math.random() * MOCK_CLIENTS.length)];
    const statusRand = Math.random();
    let status: Invoice['status'] = 'Paid';
    if(statusRand > 0.8) status = 'Pending';
    else if(statusRand > 0.95) status = 'Overdue';

    MOCK_INVOICES.push({
        id: crypto.randomUUID(),
        type: 'Revenue',
        clientId: client.id,
        projectIds: [], 
        invoiceNumber: `INV-${1000 + i}`,
        invoiceDate: date.toISOString(),
        dueDate: new Date(date.setDate(date.getDate() + 30)).toISOString(),
        total: Math.floor(Math.random() * 5000) + 500,
        status: status,
        paymentMethod: 'manual'
    });
}

const MOCK_MEETINGS: Meeting[] = [];
const meetingTypes = ['Sync', 'Kickoff', 'Review', 'Discovery', 'Feedback', 'Planning'];
const platforms: Meeting['platform'][] = ['Google Meet', 'Zoom', 'Phone', 'In-Person'];

for (let i = 0; i < 60; i++) {
    const isClient = Math.random() > 0.3;
    let clientId = null;
    let clientName = '';
    let guestEmail = '';

    if (isClient) {
        const client = MOCK_CLIENTS[Math.floor(Math.random() * MOCK_CLIENTS.length)];
        clientId = client.id;
        clientName = client.name;
        guestEmail = client.contact;
    } else {
        const name = NAMES[Math.floor(Math.random() * NAMES.length)];
        clientName = name;
        guestEmail = `${name.toLowerCase().replace(' ', '.')}@external.com`;
    }

    const type = meetingTypes[Math.floor(Math.random() * meetingTypes.length)];
    const date = new Date();
    const dayOffset = Math.floor(Math.random() * 40) - 10;
    date.setDate(date.getDate() + dayOffset);
    date.setHours(9 + Math.floor(Math.random() * 9), 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(date.getHours() + 1);

    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    
    MOCK_MEETINGS.push({
        id: crypto.randomUUID(),
        title: `${type} with ${clientName}`,
        clientId,
        clientName,
        guestEmail,
        startTime: date,
        endTime: endDate,
        platform,
        link: platform === 'In-Person' || platform === 'Phone' ? undefined : `https://meet.mock.com/${crypto.randomUUID()}`,
        description: `Agenda: Discuss project progress and next steps for ${type.toLowerCase()}.`,
        status: date < new Date() ? 'Completed' : 'Scheduled'
    });
}

const JOB_TITLES = [
    'Senior Frontend Engineer', 'Product Designer', 'UX Researcher', 'Full Stack Developer', 
    'Marketing Manager', 'Content Strategist', 'DevOps Specialist', 'Mobile Developer (iOS)',
    'Growth Hacker', 'Technical Writer', 'Art Director', 'React Native Developer'
];

const MOCK_JOBS: Job[] = JOB_TITLES.map((title, i) => {
    const company = COMPANIES[i % COMPANIES.length];
    const postedDate = new Date();
    postedDate.setDate(postedDate.getDate() - Math.floor(Math.random() * 10));

    return {
        id: crypto.randomUUID(),
        title,
        company,
        companyLogo: `https://picsum.photos/seed/${company}/100/100`,
        location: Math.random() > 0.6 ? 'Remote' : (Math.random() > 0.5 ? 'New York, USA' : 'London, UK'),
        workModel: Math.random() > 0.4 ? 'Remote' : (Math.random() > 0.5 ? 'Hybrid' : 'On-site'),
        salary: {
            min: 80000 + (Math.floor(Math.random() * 40) * 1000),
            max: 140000 + (Math.floor(Math.random() * 60) * 1000),
            currency: 'USD',
            period: 'year'
        },
        description: `We are looking for a talented ${title} to join our team at ${company}. You will be working on cutting-edge technologies and shaping the future of our product.`,
        tags: ['React', 'TypeScript', 'Design', 'Agile', 'Remote'].sort(() => 0.5 - Math.random()).slice(0, 3),
        postedDate,
        url: 'https://example.com/apply'
    };
});

const MOCK_PAYMENTS: Payment[] = [];
const paymentMethods: Payment['method'][] = ['Revolut', 'Wise', 'PayPal', 'Manual', 'Viva'];
// Generate payments linked to members and projects to allow debt calculation
MOCK_PROJECTS.forEach(project => {
    project.allocatedTeamMemberIds.forEach(memberId => {
        // Randomly pay some members some amount
        if (Math.random() > 0.5) {
            const member = MOCK_MEMBERS.find(m => m.id === memberId);
            if (member && member.role !== 'Founder') {
                const amount = Math.floor(Math.random() * 1000) + 200;
                MOCK_PAYMENTS.push({
                    id: crypto.randomUUID(),
                    recipientName: member.name,
                    recipientRole: member.role,
                    recipientEmail: member.email,
                    memberId: member.id,
                    projectId: project.id,
                    amount: amount,
                    currency: 'USD',
                    date: new Date(),
                    status: 'Paid',
                    method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
                    description: `Partial payment for ${project.name}`
                });
            }
        }
    });
});


@Injectable({ providedIn: 'root' })
export class MockDataService {
  private injector = inject(Injector);

  // Signals
  private clients = signal<Client[]>(MOCK_CLIENTS);
  private members = signal<TeamMember[]>(MOCK_MEMBERS);
  private projects = signal<Project[]>(MOCK_PROJECTS);
  private invoices = signal<Invoice[]>(MOCK_INVOICES);
  private proposals = signal<Proposal[]>([]);
  private meetings = signal<Meeting[]>(MOCK_MEETINGS);
  private boards = signal<Board[]>(MOCK_BOARDS);
  private tasks = signal<Task[]>(MOCK_TASKS);
  private payments = signal<Payment[]>(MOCK_PAYMENTS);

  // Observables
  private clients$!: Observable<Client[]>;
  private members$!: Observable<TeamMember[]>;
  private projects$!: Observable<Project[]>;
  private tasks$!: Observable<Task[]>;

  constructor() {
      this.clients$ = toObservable(this.clients, { injector: this.injector });
      this.members$ = toObservable(this.members, { injector: this.injector });
      this.projects$ = toObservable(this.projects, { injector: this.injector });
      this.tasks$ = toObservable(this.tasks, { injector: this.injector });
  }

  // --- Clients ---
  getClients() { return this.clients.asReadonly(); }
  getClientById(id: number) { return this.clients$.pipe(map(clients => clients.find(c => c.id === id))); }
  addClient(client: Omit<Client, 'id' | 'status'>) {
    const newId = Math.max(...this.clients().map(c => c.id), 0) + 1;
    this.clients.update(current => [...current, { ...client, id: newId, status: 'Active' }]);
  }
  updateClient(client: Client) { this.clients.update(current => current.map(c => c.id === client.id ? client : c)); }
  deleteClient(id: number) { this.clients.update(current => current.filter(c => c.id !== id)); }

  // --- Team Members ---
  getTeamMembers() { return this.members.asReadonly(); }
  getTeamMemberById(id: number) { return this.members$.pipe(map(members => members.find(m => m.id === id))); }
  addTeamMember(member: Omit<TeamMember, 'id'>) {
      const newId = Math.max(...this.members().map(m => m.id), 0) + 1;
      this.members.update(current => [...current, { ...member, id: newId }]);
  }
  updateTeamMember(member: TeamMember) { this.members.update(current => current.map(m => m.id === member.id ? member : m)); }
  deleteTeamMember(id: number) { this.members.update(current => current.filter(m => m.id !== id)); }

  // --- Projects ---
  getProjects() { return this.projects.asReadonly(); }
  getProjectById(id: number) { return this.projects$.pipe(map(projects => projects.find(p => p.id === id))); }
  getProjectsByClientId(clientId: number) { return this.projects$.pipe(map(projects => projects.filter(p => p.clientId === clientId))); }
  addProject(project: Omit<Project, 'id' | 'hours' | 'createdAt' | 'wiki' | 'isPinned'>) {
      const newId = Math.max(...this.projects().map(p => p.id), 0) + 1;
      this.projects.update(current => [...current, { ...project, id: newId, hours: {}, createdAt: new Date(), wiki: [], isPinned: false }]);
  }
  updateProject(project: Project) { this.projects.update(current => current.map(p => p.id === project.id ? project : p)); }
  deleteProject(id: number) { this.projects.update(current => current.filter(p => p.id !== id)); }
  toggleProjectPin(id: number) {
      this.projects.update(current => current.map(p => p.id === id ? { ...p, isPinned: !p.isPinned } : p));
  }

  // --- Hours ---
  submitHours(projectId: number, weekId: string, entries: { [day: string]: TimeEntry }) {
    this.projects.update(current => current.map(p => {
      if (p.id === projectId) {
        const weekHours = p.hours[weekId] || {};
        return { ...p, hours: { ...p.hours, [weekId]: { ...weekHours, ...entries } } };
      }
      return p;
    }));
  }
  deleteTimeEntry(projectId: number, weekId: string, day: string) {
      this.projects.update(current => current.map(p => {
          if (p.id === projectId && p.hours[weekId]) {
              const newWeek = { ...p.hours[weekId] };
              delete newWeek[day];
              return { ...p, hours: { ...p.hours, [weekId]: newWeek } };
          }
          return p;
      }));
  }

  // --- Invoices ---
  getInvoices() { return this.invoices.asReadonly(); }
  addInvoice(invoice: Omit<Invoice, 'id'>) {
      const newId = crypto.randomUUID();
      this.invoices.update(curr => [...curr, { ...invoice, id: newId }]);
  }
  updateInvoice(invoice: Invoice) { this.invoices.update(curr => curr.map(i => i.id === invoice.id ? invoice : i)); }
  
  // --- Job Board ---
  getJobs(pref: any): Observable<Job[]> { return of(MOCK_JOBS); }

  // --- Boards & Tasks ---
  getBoards() { return this.boards.asReadonly(); }
  addBoard(board: Omit<Board, 'id'>) { this.boards.update(b => [...b, { ...board, id: crypto.randomUUID() }]); }
  updateBoard(board: Board) { this.boards.update(b => b.map(x => x.id === board.id ? board : x)); }
  deleteBoard(id: string) { this.boards.update(b => b.filter(x => x.id !== id)); }
  getAllTasks() { return this.tasks.asReadonly(); }
  getTasksByProjectId(projectId: number) { return this.tasks$.pipe(map(tasks => tasks.filter(t => t.projectId === projectId))); }
  addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments' | 'order'>) {
      const maxOrder = Math.max(...this.tasks().map(t => t.order || 0), 0);
      this.tasks.update(t => [...t, { 
          ...task, 
          id: crypto.randomUUID(), 
          createdAt: new Date(), 
          updatedAt: new Date(), 
          comments: [],
          order: maxOrder + 1000 
      }]);
  }
  updateTask(task: Task) { this.tasks.update(t => t.map(x => x.id === task.id ? { ...task, updatedAt: new Date() } : x)); }
  deleteTask(id: string) { this.tasks.update(t => t.filter(x => x.id !== id)); }
  addTaskComment(taskId: string, comment: any) {
      this.tasks.update(tasks => tasks.map(t => t.id === taskId ? { ...t, comments: [...t.comments, { ...comment, id: crypto.randomUUID(), createdAt: new Date() }] } : t));
  }
  
  reorderTasks(reorderedTasks: Task[]) {
      const updates = new Map(reorderedTasks.map(t => [t.id, t]));
      this.tasks.update(currentTasks => currentTasks.map(t => updates.get(t.id) || t));
  }

  // --- Proposals ---
  getProposals() { return this.proposals.asReadonly(); }
  addProposal(prop: Omit<Proposal, 'id' | 'createdAt' | 'status'>) {
      this.proposals.update(p => [...p, { ...prop, id: crypto.randomUUID(), createdAt: new Date(), status: 'Draft' }]);
  }
  deleteProposal(id: string) { this.proposals.update(p => p.filter(x => x.id !== id)); }
  
  // --- Meetings ---
  getMeetings() { return this.meetings.asReadonly(); }
  addMeeting(m: Omit<Meeting, 'id' | 'status'>) { this.meetings.update(x => [...x, { ...m, id: crypto.randomUUID(), status: 'Scheduled' }]); }
  deleteMeeting(id: string) { this.meetings.update(x => x.filter(m => m.id !== id)); }

  // --- Payments (New) ---
  getPayments() { return this.payments.asReadonly(); }
  addPayment(payment: Omit<Payment, 'id' | 'status' | 'date'>) {
      this.payments.update(p => [
          { 
              ...payment, 
              id: crypto.randomUUID(), 
              status: 'Pending', 
              date: new Date() 
          },
          ...p
      ]);
  }

  // Calculate Debt: Cost of work - Payments made
  getMemberDebt(memberId: number, projectId: number): number {
      const project = this.projects().find(p => p.id === projectId);
      if (!project) return 0;

      const member = this.members().find(m => m.id === memberId);
      // Founders have no debt (cost is 0)
      if (!member || member.role === 'Founder' || member.role === 'Admin') return 0;

      let totalCost = 0;
      Object.values(project.hours).forEach(week => {
          Object.values(week).forEach((entry: any) => {
              if (entry.memberId === memberId) {
                  const rate = project.memberRates[memberId] ?? member.defaultHourlyRate;
                  totalCost += entry.hours * rate;
              }
          });
      });

      const totalPaid = this.payments()
          .filter(p => p.memberId === memberId && p.projectId === projectId && p.status === 'Paid')
          .reduce((sum, p) => sum + p.amount, 0);

      return Math.max(0, totalCost - totalPaid);
  }

  // --- Project Details ---
  addProjectComment(projectId: number, comment: { text: string, authorId: number }) {
      this.projects.update(current => current.map(p => p.id === projectId ? { ...p, comments: [...(p.comments || []), { id: crypto.randomUUID(), text: comment.text, authorId: comment.authorId, createdAt: new Date() }] } : p));
  }
  addProjectFile(projectId: number, file: Omit<ProjectFile, 'id' | 'uploadedAt'>) {
      this.projects.update(current => current.map(p => p.id === projectId ? { ...p, files: [...(p.files || []), { ...file, id: crypto.randomUUID(), uploadedAt: new Date() }] } : p));
  }
}
