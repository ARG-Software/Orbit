
import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { of, map } from 'rxjs';
import { JobPreferences } from './auth.service';

export interface TimeEntry {
  hours: number;
  description: string;
  memberId: number;
}

export interface Project {
  id: number;
  clientId: number;
  name: string;
  status: 'Active' | 'Completed' | 'On Hold';
  hours: { [week: string]: { [day: string]: TimeEntry } };
  allocatedTeamMemberIds: number[];
  memberRates: { [memberId: number]: number };
}

export interface Client {
  id: number;
  name: string;
  contact: string; // email
  phone: string;
  address: string;
  taxNumber: string;
  logoUrl: string;
  color: string; // New field for UI theming
  status: 'Active' | 'Paused';
  defaultTaxRate?: number;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  avatarUrl: string;
  defaultHourlyRate: number;
}

export interface Invoice {
  id: string;
  clientId: number;
  projectIds: number[];
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  paymentMethod?: 'manual' | 'paypal' | 'stripe';
}

export interface Proposal {
  id: string;
  clientId?: number | null; // Null if manual client
  clientName: string;
  projectName: string;
  createdAt: Date;
  startDate?: string;
  endDate?: string;
  totalAmount: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected';
  sections: any[]; // JSON structure of the estimate
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
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
  boardId: string;
  title: string;
  assignedMemberId: number;
  status: 'To Do' | 'In Progress' | 'On Hold' | 'Completed';
  priority: 'Low' | 'Medium' | 'High';
  isBilled: boolean;
  createdAt: Date;
  updatedAt: Date;
  comments: TaskComment[];
}

export interface Meeting {
  id: string;
  title: string;
  clientId?: number | null; // Optional for external guests
  clientName?: string; // Can be client name or guest name
  guestEmail?: string; // New: For external invites
  startTime: Date;
  endTime: Date;
  platform: 'Google Meet' | 'Zoom' | 'Phone' | 'In-Person';
  link?: string;
  description?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
}

// --- Helper to generate Week IDs relative to date ---
function getWeekId(d: Date): string {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  }

// --- Data Generators ---

const MOCK_MEMBERS: TeamMember[] = [
    { id: 1, name: 'Alex Doe', role: 'Frontend Developer', avatarUrl: 'https://picsum.photos/seed/alex/100/100', defaultHourlyRate: 85 },
    { id: 2, name: 'Jane Smith', role: 'UI/UX Designer', avatarUrl: 'https://picsum.photos/seed/jane/100/100', defaultHourlyRate: 95 },
    { id: 3, name: 'Samuel Green', role: 'Backend Developer', avatarUrl: 'https://picsum.photos/seed/samuel/100/100', defaultHourlyRate: 90 },
    { id: 4, name: 'Brenda Blue', role: 'Project Manager', avatarUrl: 'https://picsum.photos/seed/brenda/100/100', defaultHourlyRate: 110 },
    { id: 5, name: 'Mike Brown', role: 'DevOps Engineer', avatarUrl: 'https://picsum.photos/seed/mike/100/100', defaultHourlyRate: 100 },
    { id: 6, name: 'Olivia White', role: 'QA Tester', avatarUrl: 'https://picsum.photos/seed/olivia/100/100', defaultHourlyRate: 65 },
    { id: 7, name: 'Chris Black', role: 'Data Scientist', avatarUrl: 'https://picsum.photos/seed/chris/100/100', defaultHourlyRate: 120 },
];

const CLIENT_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'];

const MOCK_CLIENTS: Client[] = [
    { id: 1, name: 'Innovate Corp', contact: 'alice@innovate.com', phone: '123-456-7890', address: '123 Innovation Dr, Tech City', taxNumber: 'TAX12345', logoUrl: 'https://picsum.photos/seed/innovate/100/100', color: '#6366f1', status: 'Active', defaultTaxRate: 10 },
    { id: 2, name: 'Quantum Solutions', contact: 'bob@quantum.com', phone: '234-567-8901', address: '456 Quantum Way, Sci-Fi Town', taxNumber: 'TAX67890', logoUrl: 'https://picsum.photos/seed/quantum/100/100', color: '#10b981', status: 'Active', defaultTaxRate: 5 },
    { id: 3, name: 'Stellar Tech', contact: 'charlie@stellar.com', phone: '345-678-9012', address: '789 Stellar Ave, Spaceville', taxNumber: 'TAX24680', logoUrl: 'https://picsum.photos/seed/stellar/100/100', color: '#f59e0b', status: 'Paused', defaultTaxRate: 20 },
    { id: 4, name: 'Apex Dynamics', contact: 'diana@apex.com', phone: '456-789-0123', address: '101 Apex Blvd, Highpoint', taxNumber: 'TAX13579', logoUrl: 'https://picsum.photos/seed/apex/100/100', color: '#ef4444', status: 'Active', defaultTaxRate: 15 },
    { id: 5, name: 'FusionWorks', contact: 'eva@fusion.com', phone: '567-890-1234', address: '210 Fusion St, Metro City', taxNumber: 'TAX54321', logoUrl: 'https://picsum.photos/seed/fusion/100/100', color: '#8b5cf6', status: 'Active', defaultTaxRate: 0 },
    { id: 6, name: 'Synergy Systems', contact: 'frank@synergy.com', phone: '678-901-2345', address: '321 Synergy Rd, Collab Town', taxNumber: 'TAX98765', logoUrl: 'https://picsum.photos/seed/synergy/100/100', color: '#06b6d4', status: 'Active', defaultTaxRate: 12 },
    { id: 7, name: 'NextGen AI', contact: 'grace@nextgen.com', phone: '789-012-3456', address: '432 AI Lane, Futureville', taxNumber: 'TAX11223', logoUrl: 'https://picsum.photos/seed/nextgen/100/100', color: '#d946ef', status: 'Active', defaultTaxRate: 8.5 },
    { id: 8, name: 'EcoVibes', contact: 'heidi@eco.com', phone: '890-123-4567', address: '543 Green Way, Nature City', taxNumber: 'TAX44556', logoUrl: 'https://picsum.photos/seed/eco/100/100', color: '#84cc16', status: 'Paused', defaultTaxRate: 10 },
    { id: 9, name: 'Momentum Inc.', contact: 'ivan@momentum.com', phone: '901-234-5678', address: '654 Momentum Dr, Fastlane', taxNumber: 'TAX77889', logoUrl: 'https://picsum.photos/seed/momentum/100/100', color: '#f97316', status: 'Active', defaultTaxRate: 10 },
];

function generateProjectsAndHours(): Project[] {
    const projects: Project[] = [
        { id: 1, clientId: 1, name: 'Website Relaunch', status: 'Active', hours: {}, allocatedTeamMemberIds: [1, 2, 4], memberRates: {1: 90, 2: 100, 4: 120} },
        { id: 2, clientId: 1, name: 'Mobile App MVP', status: 'Active', hours: {}, allocatedTeamMemberIds: [1, 3, 5], memberRates: {1: 95, 3: 100, 5: 105} },
        { id: 3, clientId: 2, name: 'Quantum Leap API', status: 'Active', hours: {}, allocatedTeamMemberIds: [3, 5, 7], memberRates: {3: 110, 5: 115, 7: 130} },
        { id: 4, clientId: 3, name: 'Stellar Nav System', status: 'Completed', hours: {}, allocatedTeamMemberIds: [1, 5, 7], memberRates: {1: 90, 5: 100, 7: 120} },
        { id: 5, clientId: 4, name: 'Dynamics CRM', status: 'Active', hours: {}, allocatedTeamMemberIds: [2, 3, 4, 6], memberRates: {2: 110, 3: 110, 4: 125, 6: 75} },
        { id: 6, clientId: 5, name: 'FusionAuth Integration', status: 'On Hold', hours: {}, allocatedTeamMemberIds: [3, 5], memberRates: {3: 105, 5: 110} },
        { id: 7, clientId: 6, name: 'Synergy Platform', status: 'Active', hours: {}, allocatedTeamMemberIds: [1, 2, 3, 4, 5, 6, 7], memberRates: {} },
        { id: 8, clientId: 7, name: 'GenAI Chatbot', status: 'Active', hours: {}, allocatedTeamMemberIds: [1, 3, 7], memberRates: {1: 100, 3: 115, 7: 150} },
        { id: 9, clientId: 8, name: 'EcoVibes Marketing', status: 'On Hold', hours: {}, allocatedTeamMemberIds: [2, 6], memberRates: {} },
        { id: 10, clientId: 9, name: 'Momentum Dashboard', status: 'Active', hours: {}, allocatedTeamMemberIds: [1, 2, 4], memberRates: {1: 95, 2: 105, 4: 115} },
    ];

    const today = new Date();
    // Generate data for past 24 weeks
    for (let i = 0; i < 24; i++) {
        const weekDate = new Date(today);
        weekDate.setDate(today.getDate() - (i * 7));
        const weekId = getWeekId(weekDate);

        projects.forEach(p => {
            // Skip hours for paused/completed projects for recent weeks if logic required, 
            // but for simplicity we assume some historical data exists for all.
            
            if (p.status !== 'On Hold') {
                 p.allocatedTeamMemberIds.forEach(mId => {
                    // Random chance this member worked this week on this project
                    if (Math.random() > 0.4) {
                        if (!p.hours[weekId]) p.hours[weekId] = {};
                        
                        // Random days
                        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(day => {
                             if (Math.random() > 0.5) {
                                 p.hours[weekId][day] = {
                                     hours: Math.floor(Math.random() * 6) + 1, // 1-6 hours
                                     description: 'Feature development & maintenance',
                                     memberId: mId
                                 };
                             }
                        });
                    }
                 });
            }
        });
    }
    return projects;
}

function generateBoards(projects: Project[]): Board[] {
    return projects.flatMap(p => [
        { id: `board-${p.id}-1`, projectId: p.id, name: 'Development' },
        { id: `board-${p.id}-2`, projectId: p.id, name: 'Backlog' }
    ]);
}

function generateTasks(projects: Project[], boards: Board[]): Task[] {
    const tasks: Task[] = [];
    const today = new Date();
    
    projects.forEach(p => {
        const projectBoards = boards.filter(b => b.projectId === p.id);
        if(projectBoards.length === 0) return;

        const taskCount = Math.floor(Math.random() * 10) + 3; // 3-12 tasks per project
        
        for(let i = 0; i < taskCount; i++) {
            const isRecent = Math.random() > 0.3;
            const createdAt = new Date(today);
            createdAt.setDate(today.getDate() - Math.floor(Math.random() * 90)); // Last 90 days
            
            const updatedAt = new Date(createdAt);
            updatedAt.setDate(createdAt.getDate() + Math.floor(Math.random() * 10));

            const statusOptions: Task['status'][] = ['To Do', 'In Progress', 'Completed', 'On Hold'];
            const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];

            tasks.push({
                id: `task-${p.id}-${i}`,
                projectId: p.id,
                boardId: projectBoards[Math.floor(Math.random() * projectBoards.length)].id,
                title: `Task ${i+1} for ${p.name}`,
                assignedMemberId: p.allocatedTeamMemberIds[Math.floor(Math.random() * p.allocatedTeamMemberIds.length)],
                status: status,
                priority: Math.random() > 0.7 ? 'High' : (Math.random() > 0.4 ? 'Medium' : 'Low'),
                isBilled: status === 'Completed' && Math.random() > 0.5,
                createdAt: createdAt,
                updatedAt: updatedAt,
                comments: [] // Keep comments simple for now
            });
        }
    });
    return tasks;
}

function generateInvoices(clients: Client[]): Invoice[] {
    const invoices: Invoice[] = [];
    const today = new Date();
    let counter = 1;

    clients.forEach(client => {
         // Generate 2-5 invoices per client over the last year
         const count = Math.floor(Math.random() * 4) + 2;
         for(let i = 0; i < count; i++) {
             const invoiceDate = new Date(today);
             invoiceDate.setMonth(today.getMonth() - i - 1);
             invoiceDate.setDate(28); // End of monthish
             
             const dueDate = new Date(invoiceDate);
             dueDate.setDate(dueDate.getDate() + 30);

             const statusRoll = Math.random();
             let status: Invoice['status'] = 'Paid';
             if (i === 0) { // Most recent might be pending or overdue
                 if (statusRoll > 0.7) status = 'Pending';
                 else if (statusRoll > 0.9) status = 'Overdue';
             }

             invoices.push({
                 id: `inv-${client.id}-${i}`,
                 clientId: client.id,
                 projectIds: [], // Simplified for stats
                 invoiceNumber: `INV-${invoiceDate.getFullYear()}${(invoiceDate.getMonth()+1).toString().padStart(2, '0')}-${String(counter++).padStart(3, '0')}`,
                 invoiceDate: invoiceDate.toISOString().split('T')[0],
                 dueDate: dueDate.toISOString().split('T')[0],
                 total: Math.floor(Math.random() * 5000) + 1500,
                 status: status,
                 paymentMethod: Math.random() > 0.5 ? 'stripe' : 'manual'
             });
         }
    });
    return invoices;
}

function generateMeetings(clients: Client[]): Meeting[] {
  const meetings: Meeting[] = [];
  const today = new Date();

  clients.slice(0, 4).forEach((client, index) => {
    // Future meeting
    const start = new Date(today);
    start.setDate(today.getDate() + index + 1);
    start.setHours(10 + index, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    meetings.push({
      id: `meet-f-${index}`,
      title: `Sync with ${client.name}`,
      clientId: client.id,
      clientName: client.name,
      startTime: start,
      endTime: end,
      platform: index % 2 === 0 ? 'Google Meet' : 'Zoom',
      link: index % 2 === 0 ? `https://meet.google.com/abc-defg-hij` : `https://zoom.us/j/123456789`,
      status: 'Scheduled'
    });
  });
  
  return meetings;
}


@Injectable({ providedIn: 'root' })
export class MockDataService {
  private members = signal<TeamMember[]>(MOCK_MEMBERS);
  private clients = signal<Client[]>(MOCK_CLIENTS);
  
  // Initialize with generated data
  private generatedProjects = generateProjectsAndHours();
  private projects = signal<Project[]>(this.generatedProjects);
  
  private generatedBoards = generateBoards(this.generatedProjects);
  private boards = signal<Board[]>(this.generatedBoards);
  
  private tasks = signal<Task[]>(generateTasks(this.generatedProjects, this.generatedBoards));
  private invoices = signal<Invoice[]>(generateInvoices(MOCK_CLIENTS));
  
  private expenses = signal<Expense[]>([
    { id: 'exp1', date: '2024-07-15', category: 'Software', amount: 49.99, description: 'Design tool subscription' },
    { id: 'exp2', date: '2024-07-20', category: 'Office Supplies', amount: 120.50, description: 'New keyboard and mouse' },
  ]);

  private jobs = signal<Job[]>([
     { id: 'job1', title: 'Senior Frontend Engineer', company: 'Innovate Corp', companyLogo: 'https://picsum.photos/seed/innovate/100/100', location: 'Tech City, USA', workModel: 'Hybrid', salary: { min: 120000, max: 150000, currency: 'USD', period: 'year' }, description: '...', tags: ['Angular', 'TypeScript', 'RxJS'], postedDate: new Date('2024-07-28'), url: '#' },
     { id: 'job2', title: 'Lead UI/UX Designer', company: 'Quantum Solutions', companyLogo: 'https://picsum.photos/seed/quantum/100/100', location: 'Remote', workModel: 'Remote', salary: { min: 110000, max: 140000, currency: 'USD', period: 'year' }, description: '...', tags: ['Figma', 'User Research', 'Prototyping'], postedDate: new Date('2024-07-25'), url: '#' },
     { id: 'job3', title: 'Backend Developer (Node.js)', company: 'Stellar Tech', companyLogo: 'https://picsum.photos/seed/stellar/100/100', location: 'Spaceville, USA', workModel: 'On-site', salary: { min: 100000, max: 130000, currency: 'USD', period: 'year' }, description: '...', tags: ['Node.js', 'Express', 'PostgreSQL'], postedDate: new Date('2024-07-22'), url: '#' },
     { id: 'job4', title: 'Full-Stack Developer', company: 'Apex Dynamics', companyLogo: 'https://picsum.photos/seed/apex/100/100', location: 'Highpoint, USA', workModel: 'Hybrid', salary: { min: 130000, max: 160000, currency: 'USD', period: 'year' }, description: '...', tags: ['React', 'Node.js', 'AWS'], postedDate: new Date('2024-07-29'), url: '#' },
     { id: 'job5', title: 'DevOps Engineer', company: 'FusionWorks', companyLogo: 'https://picsum.photos/seed/fusion/100/100', location: 'Remote', workModel: 'Remote', salary: { min: 140000, max: 170000, currency: 'USD', period: 'year' }, description: '...', tags: ['Kubernetes', 'Docker', 'CI/CD'], postedDate: new Date('2024-07-20'), url: '#' },
     { id: 'job6', title: 'Data Scientist', company: 'NextGen AI', companyLogo: 'https://picsum.photos/seed/nextgen/100/100', location: 'Futureville, USA', workModel: 'On-site', salary: { min: 150000, max: 180000, currency: 'USD', period: 'year' }, description: '...', tags: ['Python', 'TensorFlow', 'Machine Learning'], postedDate: new Date('2024-07-18'), url: '#' },
  ]);

  // Mock Proposals
  private proposals = signal<Proposal[]>([
      { id: 'prop-1', clientId: 1, clientName: 'Innovate Corp', projectName: '2025 Strategy', createdAt: new Date('2024-01-10'), startDate: '2024-01-15', endDate: '2024-03-01', totalAmount: 5000, status: 'Sent', sections: [] },
      { id: 'prop-2', clientId: null, clientName: 'StartUp Inc', projectName: 'MVP Build', createdAt: new Date('2024-02-15'), startDate: '2024-03-01', endDate: '2024-06-01', totalAmount: 12000, status: 'Draft', sections: [] }
  ]);

  private meetings = signal<Meeting[]>(generateMeetings(MOCK_CLIENTS));

  // --- OBSERVABLES ---
  private clients$ = toObservable(this.clients);
  private projects$ = toObservable(this.projects);
  private members$ = toObservable(this.members);
  private invoices$ = toObservable(this.invoices);
  private jobs$ = toObservable(this.jobs);
  private tasks$ = toObservable(this.tasks);
  private boards$ = toObservable(this.boards);
  private proposals$ = toObservable(this.proposals);
  private meetings$ = toObservable(this.meetings);

  // Client Methods
  getClients() { return this.clients$; }
  getClientById(id: number) { return this.clients$.pipe(map((clients: Client[]) => clients.find(c => c.id === id))); }
  
  addClient(clientData: Omit<Client, 'id' | 'status'>) {
    this.clients.update(clients => {
        const maxId = clients.length > 0 ? Math.max(...clients.map(c => c.id)) : 0;
        const newClient: Client = {
            ...clientData,
            id: maxId + 1,
            logoUrl: clientData.logoUrl || `https://picsum.photos/seed/${clientData.name.replace(/\s+/g, '')}/100/100`,
            color: clientData.color || CLIENT_COLORS[Math.floor(Math.random() * CLIENT_COLORS.length)],
            status: 'Active'
        };
        return [...clients, newClient];
    });
  }

  updateClient(updatedClient: Client) {
    this.clients.update(clients => {
      const index = clients.findIndex(c => c.id === updatedClient.id);
      if (index > -1) {
        const newClients = [...clients];
        newClients[index] = updatedClient;
        return newClients;
      }
      return clients;
    });
  }
  
  deleteClient(clientId: number) {
    this.clients.update(clients => clients.filter(c => c.id !== clientId));
  }

  // Project Methods
  getProjects() { return this.projects$; }
  getProjectsByClientId(clientId: number) {
     return this.projects$.pipe(map((projects: Project[]) => projects.filter(p => p.clientId === clientId)));
  }

  addProject(projectData: Omit<Project, 'id' | 'hours'>) {
    this.projects.update(projects => {
      const maxId = projects.length > 0 ? Math.max(...projects.map(p => p.id)) : 0;
      const newProject: Project = {
        ...projectData,
        id: maxId + 1,
        hours: {},
        allocatedTeamMemberIds: projectData.allocatedTeamMemberIds || [],
        memberRates: projectData.memberRates || {}
      };
      return [...projects, newProject];
    });
  }
  
  updateProject(updatedProject: Project) {
    this.projects.update(projects => {
      const index = projects.findIndex(p => p.id === updatedProject.id);
      if (index > -1) {
        const newProjects = [...projects];
        newProjects[index] = updatedProject;
        return newProjects;
      }
      return projects;
    });
  }
  
  submitHours(projectId: number, weekId: string, hours: { [day: string]: TimeEntry }) {
    this.projects.update(projects => {
        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex > -1) {
            const updatedProjects = [...projects];
            const project = { ...updatedProjects[projectIndex] };
            if (!project.hours) project.hours = {};
            const updatedHours = { ...project.hours };
            if (Object.values(hours).some(entry => entry.hours > 0)) {
              updatedHours[weekId] = { ...(updatedHours[weekId] || {}), ...hours };
            } else {
              delete updatedHours[weekId];
            }
            project.hours = updatedHours;
            updatedProjects[projectIndex] = project;
            return updatedProjects;
        }
        return projects;
    });
  }

  // Board Methods
  getBoards() { return this.boards$; }
  
  addBoard(boardData: Omit<Board, 'id'>) {
    this.boards.update(boards => {
      const newBoard: Board = {
        ...boardData,
        id: `board-${crypto.randomUUID()}`
      };
      return [...boards, newBoard];
    });
  }

  updateBoard(updatedBoard: Board) {
    this.boards.update(boards => {
        const index = boards.findIndex(b => b.id === updatedBoard.id);
        if (index > -1) {
            const newBoards = [...boards];
            newBoards[index] = updatedBoard;
            return newBoards;
        }
        return boards;
    });
  }

  deleteBoard(boardId: string) {
    this.boards.update(boards => boards.filter(b => b.id !== boardId));
    // Cleanup tasks associated with the board
    this.tasks.update(tasks => tasks.filter(t => t.boardId !== boardId));
  }
  
  // Team Member Methods
  getTeamMembers() { return this.members$; }
  getTeamMemberById(id: number) { return this.members$.pipe(map((members: TeamMember[]) => members.find(m => m.id === id))); }
  
  addTeamMember(memberData: Omit<TeamMember, 'id'>) {
    this.members.update(members => {
      const maxId = members.length > 0 ? Math.max(...members.map(m => m.id)) : 0;
      const newMember: TeamMember = {
        ...memberData,
        id: maxId + 1,
        avatarUrl: memberData.avatarUrl || `https://picsum.photos/seed/${memberData.name.replace(/\s+/g, '')}/100/100`
      };
      return [...members, newMember];
    });
  }

  updateTeamMember(updatedMember: TeamMember) {
    this.members.update(members => {
      const index = members.findIndex(m => m.id === updatedMember.id);
      if (index > -1) {
        const newMembers = [...members];
        newMembers[index] = updatedMember;
        return newMembers;
      }
      return members;
    });
  }

  // Invoice Methods
  getInvoices() {
    return this.invoices$.pipe(
      map((invoices: Invoice[]) => invoices.sort((a,b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()))
    );
  }

  getInvoicesByClientId(clientId: number) {
    return this.invoices$.pipe(
      map((invoices: Invoice[]) => invoices.filter(inv => inv.clientId === clientId)
                              .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
      )
    );
  }

  addInvoice(invoiceData: Omit<Invoice, 'id'>) {
    this.invoices.update(invoices => {
      const newInvoice: Invoice = {
        ...invoiceData,
        id: crypto.randomUUID(),
      };
      return [...invoices, newInvoice];
    });
  }

  updateInvoice(updatedInvoice: Invoice) {
    this.invoices.update(invoices => {
      const index = invoices.findIndex(inv => inv.id === updatedInvoice.id);
      if (index > -1) {
        const newInvoices = [...invoices];
        newInvoices[index] = updatedInvoice;
        return newInvoices;
      }
      return invoices;
    });
  }

  // Proposal Methods
  getProposals() {
      return this.proposals$.pipe(
          map(proposals => proposals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
      );
  }

  addProposal(proposalData: Omit<Proposal, 'id' | 'createdAt' | 'status'>) {
      this.proposals.update(props => {
          const newProp: Proposal = {
              ...proposalData,
              id: `prop-${crypto.randomUUID()}`,
              createdAt: new Date(),
              status: 'Draft'
          };
          return [newProp, ...props];
      });
  }

  deleteProposal(id: string) {
      this.proposals.update(props => props.filter(p => p.id !== id));
  }


  // Job Methods
  getJobs(preferences: JobPreferences) {
    return this.jobs$.pipe(
      map((jobs: Job[]) => {
        return jobs.sort((a, b) => b.postedDate.getTime() - a.postedDate.getTime());
      })
    );
  }

  // Task Methods
  getAllTasks() {
    return this.tasks$;
  }
  
  getTasksByProjectId(projectId: number) {
    return this.tasks$.pipe(
      map((tasks: Task[]) => tasks.filter(t => t.projectId === projectId))
    );
  }

  addTask(taskData: Omit<Task, 'id' | 'updatedAt' | 'comments' | 'createdAt'>) {
    this.tasks.update(tasks => {
      const newTask: Task = {
        ...taskData,
        id: `task-${crypto.randomUUID()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        comments: []
      };
      return [...tasks, newTask];
    });
  }

  updateTask(updatedTask: Task) {
    this.tasks.update(tasks => {
        const index = tasks.findIndex(t => t.id === updatedTask.id);
        if (index > -1) {
            const newTasks = [...tasks];
            newTasks[index] = updatedTask;
            return newTasks;
        }
        return tasks;
    });
  }

  deleteTask(taskId: string) {
    this.tasks.update(tasks => tasks.filter(t => t.id !== taskId));
  }

  addTaskComment(taskId: string, commentData: Omit<TaskComment, 'id' | 'createdAt'>) {
      this.tasks.update(tasks => {
          const index = tasks.findIndex(t => t.id === taskId);
          if (index > -1) {
              const newTasks = [...tasks];
              const task = { ...newTasks[index] };
              const newComment: TaskComment = {
                  ...commentData,
                  id: crypto.randomUUID(),
                  createdAt: new Date()
              };
              task.comments = [...(task.comments || []), newComment];
              task.updatedAt = new Date();
              newTasks[index] = task;
              return newTasks;
          }
          return tasks;
      });
  }

  // Meeting Methods
  getMeetings() {
      return this.meetings$.pipe(
        map(meetings => meetings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()))
      );
  }

  addMeeting(meetingData: Omit<Meeting, 'id' | 'status'>) {
    this.meetings.update(meetings => {
        const newMeeting: Meeting = {
            ...meetingData,
            id: `meet-${crypto.randomUUID()}`,
            status: 'Scheduled'
        };
        return [...meetings, newMeeting];
    });
  }

  deleteMeeting(meetingId: string) {
      this.meetings.update(meetings => meetings.filter(m => m.id !== meetingId));
  }
  
  // Dashboard Data
  getDashboardData(range: { startDate: Date, endDate: Date }) {
      return this.clients$.pipe(
        map(clients => {
            const projects = this.projects();
            const invoices = this.invoices();
            const members = this.members();
            const tasks = this.tasks();

            // Helpers
            const isWithin = (dateStr: string | Date) => {
                const d = new Date(dateStr);
                return d >= range.startDate && d <= range.endDate;
            };

            // 1. Revenue
            const filteredInvoices = invoices.filter(inv => isWithin(inv.invoiceDate) && inv.status === 'Paid');
            const totalEarnings = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
            
            const earningsByClient = clients.map(c => ({
                name: c.name,
                value: filteredInvoices.filter(inv => inv.clientId === c.id).reduce((sum, inv) => sum + inv.total, 0)
            })).filter(i => i.value > 0).sort((a,b) => b.value - a.value);

            // ... Simplify specific metrics for dashboard mock ...
            
            return {
                revenue: {
                    totalEarnings,
                    earningsByClient,
                    mostValuableProjects: [], 
                    avgHourlyRate: 95, 
                    totalHours: 1240 
                },
                clients: {
                    mostValuableClients: earningsByClient,
                    activeClientsCount: clients.filter(c => c.status === 'Active').length,
                    clientsWithMostBilledTime: [],
                    projectValuePerClient: [],
                    invoiceStatusSummary: {
                        paid: invoices.filter(i => i.status === 'Paid' && isWithin(i.invoiceDate)).length,
                        pending: invoices.filter(i => i.status === 'Pending').length,
                        overdue: invoices.filter(i => i.status === 'Overdue').length
                    }
                },
                members: {
                    activeMembersCount: members.length,
                    rankingByHours: members.map(m => ({ member: m, hours: Math.random() * 100 + 20, earnings: Math.random() * 5000 + 2000 })).sort((a,b) => b.hours - a.hours),
                    mostProfitableMember: undefined,
                    mostHoursLogged: undefined
                },
                tasks: {
                    recentlyAddedTasks: tasks.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5),
                    recentlyChangedTasks: tasks.sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5),
                    boardActivity: this.boards().map(b => ({ name: b.name, projectId: b.projectId, count: tasks.filter(t => t.boardId === b.id).length })).sort((a,b) => b.count - a.count).slice(0, 5)
                }
            };
        })
      );
  }
}
