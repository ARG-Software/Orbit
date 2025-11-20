
import { Injectable, signal, inject, Injector } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { of, Observable, map } from 'rxjs';
import { JobPreferences } from './auth.service';

export interface TimeEntry {
  hours: number;
  description: string;
  memberId: number;
}

export interface ProjectFile {
  id: string;
  name: string;
  url: string;
  uploadedAt: Date;
  uploadedBy: number; // memberId
}

export interface ProjectComment {
  id: string;
  text: string;
  createdAt: Date;
  authorId: number;
}

export interface Project {
  id: number;
  clientId: number;
  name: string;
  description?: string;
  status: 'Active' | 'Completed' | 'On Hold';
  hours: { [week: string]: { [day: string]: TimeEntry } };
  allocatedTeamMemberIds: number[];
  memberRates: { [memberId: number]: number };
  files?: ProjectFile[];
  comments?: ProjectComment[];
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
  email: string; 
  role: string;
  avatarUrl: string;
  defaultHourlyRate: number;
  status: 'Active' | 'Invited' | 'Inactive';
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
  'Frontend Developer', 'Backend Developer', 'UI/UX Designer', 'Project Manager', 'DevOps Engineer', 
  'QA Tester', 'Data Scientist', 'Mobile Developer', 'Product Owner', 'System Architect'
];

// 1. Generate Clients (More data: 30 clients)
const MOCK_CLIENTS: Client[] = COMPANIES.map((name, i) => ({
    id: i + 1,
    name,
    contact: `contact@${name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
    phone: `555-01${String(i).padStart(2, '0')}`,
    address: `${100 + i} Enterprise Blvd, Tech City`,
    taxNumber: `US-${10000 + i}`,
    logoUrl: `https://picsum.photos/seed/${i + 50}/100/100`,
    color: ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6],
    status: i % 8 === 0 ? 'Paused' : 'Active',
    defaultTaxRate: 10 + (i % 10)
}));

// 2. Generate Members (More data: 25 members)
const MOCK_MEMBERS: TeamMember[] = NAMES.map((name, i) => ({
    id: i + 1,
    name,
    email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
    role: ROLES[i % ROLES.length],
    avatarUrl: `https://picsum.photos/seed/${name.replace(' ', '')}/100/100`,
    defaultHourlyRate: 50 + Math.floor(Math.random() * 100),
    status: i > 20 ? 'Invited' : (i > 22 ? 'Inactive' : 'Active')
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

// Helper for random hours (Dynamic relative to NOW)
const generateMockHours = (allocatedMembers: number[]) => {
   const hours: any = {};
   const today = new Date();
   
   // Generate for last 8 weeks including current and next
   for (let w = -6; w < 2; w++) {
       const d = new Date(today);
       d.setDate(today.getDate() + (w * 7));
       const weekId = getWeekId(d);
       
       hours[weekId] = {};
       const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
       
       days.forEach(day => {
           // 40% chance of logging time if members exist
           if(Math.random() > 0.6 && allocatedMembers.length > 0) {
               const memberId = allocatedMembers[Math.floor(Math.random()*allocatedMembers.length)];
               hours[weekId][day] = {
                   hours: Math.floor(Math.random() * 6) + 2, // 2 to 8 hours
                   description: ['Implemented feature', 'Fixed bugs', 'Meeting with client', 'Code review', 'Documentation', 'Testing'][Math.floor(Math.random() * 6)],
                   memberId
               };
           }
       });
   }
   return hours;
};

// 3. Generate Projects (More data: ~80 projects)
const MOCK_PROJECTS: Project[] = [];
let projectIdCounter = 1;
MOCK_CLIENTS.forEach(client => {
    const numProjects = Math.floor(Math.random() * 4) + 1; // 1 to 4 projects per client
    for (let i = 0; i < numProjects; i++) {
        const status: any = Math.random() > 0.7 ? 'Completed' : (Math.random() > 0.9 ? 'On Hold' : 'Active');
        const numMembers = Math.floor(Math.random() * 5) + 1;
        const members = [...MOCK_MEMBERS].sort(() => 0.5 - Math.random()).slice(0, numMembers);
        const memberRates: any = {};
        members.forEach(m => memberRates[m.id] = m.defaultHourlyRate);
        const memberIds = members.map(m => m.id);

        MOCK_PROJECTS.push({
            id: projectIdCounter++,
            clientId: client.id,
            name: `${client.name} Project ${String.fromCharCode(65 + i)}`,
            description: `Strategic project for ${client.name} focusing on growth and stability. Includes design, development, and deployment phases.`,
            status,
            allocatedTeamMemberIds: memberIds,
            memberRates,
            hours: generateMockHours(memberIds),
            files: [],
            comments: []
        });
    }
});

// 4. Generate Tasks & Boards (More data: ~500 tasks)
const MOCK_TASKS: Task[] = [];
const MOCK_BOARDS: Board[] = [];

MOCK_PROJECTS.forEach(project => {
    const boardId = `board-${project.id}`;
    MOCK_BOARDS.push({ id: boardId, projectId: project.id, name: 'Main Board' });

    const numTasks = Math.floor(Math.random() * 12) + 3; 
    for(let i=0; i<numTasks; i++) {
        const status: any = ['To Do', 'In Progress', 'On Hold', 'Completed'][Math.floor(Math.random() * 4)];
        const priority: any = ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)];
        const assignee = project.allocatedTeamMemberIds.length > 0 
            ? project.allocatedTeamMemberIds[Math.floor(Math.random() * project.allocatedTeamMemberIds.length)] 
            : MOCK_MEMBERS[0].id;
        
        MOCK_TASKS.push({
            id: crypto.randomUUID(),
            projectId: project.id,
            boardId: boardId,
            title: `Task ${i + 1}: ${['Implement', 'Design', 'Test', 'Review', 'Deploy', 'Fix'][Math.floor(Math.random()*6)]} Feature ${String.fromCharCode(65+i)}`,
            assignedMemberId: assignee,
            status,
            priority,
            isBilled: status === 'Completed' && Math.random() > 0.5,
            createdAt: new Date(Date.now() - Math.random() * 1000000000),
            updatedAt: new Date(Date.now() - Math.random() * 100000000),
            comments: []
        });
    }
});

// 5. Generate Invoices (More data: ~80 invoices)
const MOCK_INVOICES: Invoice[] = [];
for (let i=0; i < 80; i++) {
    const client = MOCK_CLIENTS[Math.floor(Math.random() * MOCK_CLIENTS.length)];
    const status: any = Math.random() > 0.4 ? 'Paid' : (Math.random() > 0.6 ? 'Pending' : 'Overdue');
    MOCK_INVOICES.push({
        id: crypto.randomUUID(),
        clientId: client.id,
        projectIds: [], 
        invoiceNumber: `INV-2024-${String(i + 1).padStart(3, '0')}`,
        invoiceDate: new Date(Date.now() - Math.floor(Math.random() * 120) * 86400000).toISOString(),
        dueDate: new Date(Date.now() + Math.floor(Math.random() * 30) * 86400000).toISOString(),
        total: Math.floor(Math.random() * 8000) + 500,
        status,
        paymentMethod: 'manual'
    });
}

// 6. Generate Meetings (New: ~30 meetings)
const MOCK_MEETINGS: Meeting[] = [];
const meetingTypes: ('Google Meet' | 'Zoom' | 'Phone' | 'In-Person')[] = ['Google Meet', 'Zoom', 'Phone', 'In-Person'];
for (let i = 0; i < 30; i++) {
    const client = MOCK_CLIENTS[Math.floor(Math.random() * MOCK_CLIENTS.length)];
    const future = Math.random() > 0.4; // 60% future meetings
    const dateOffset = future ? Math.floor(Math.random() * 14) : -Math.floor(Math.random() * 30);
    
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + dateOffset);
    startTime.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + 1);

    MOCK_MEETINGS.push({
        id: crypto.randomUUID(),
        title: `${['Weekly Sync', 'Project Kickoff', 'Review', 'Status Update', 'Emergency Call'][Math.floor(Math.random()*5)]} - ${client.name}`,
        clientId: client.id,
        clientName: client.name,
        guestEmail: client.contact,
        startTime,
        endTime,
        platform: meetingTypes[Math.floor(Math.random() * 4)],
        status: future ? 'Scheduled' : 'Completed',
        link: 'https://meet.google.com/abc-defg-hij',
        description: 'Regular sync to discuss progress.'
    });
}

// 7. Generate Jobs
const MOCK_JOBS: Job[] = Array.from({ length: 30 }, (_, i) => ({
    id: String(i + 1),
    title: ROLES[i % ROLES.length],
    company: COMPANIES[i % COMPANIES.length],
    companyLogo: `https://picsum.photos/seed/job${i}/50/50`,
    location: ['Remote', 'New York, NY', 'San Francisco, CA', 'London, UK', 'Berlin, DE'][i % 5],
    workModel: ['Remote', 'Hybrid', 'On-site'][i % 3] as any,
    salary: { 
        min: 80000 + (i * 1000), 
        max: 120000 + (i * 2000), 
        currency: 'USD', 
        period: 'year' 
    },
    description: 'We are looking for a talented individual to join our team...',
    tags: ['Tech', ROLES[i % ROLES.length].split(' ')[0]],
    postedDate: new Date(Date.now() - i * 86400000),
    url: '#'
}));


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

  // Observables - Explicitly created in constructor to ensure Injection Context
  private clients$!: Observable<Client[]>;
  private members$!: Observable<TeamMember[]>;
  private projects$!: Observable<Project[]>;
  private tasks$!: Observable<Task[]>;

  constructor() {
      // Robust initialization of observables using the injector
      this.clients$ = toObservable(this.clients, { injector: this.injector });
      this.members$ = toObservable(this.members, { injector: this.injector });
      this.projects$ = toObservable(this.projects, { injector: this.injector });
      this.tasks$ = toObservable(this.tasks, { injector: this.injector });
  }

  // --- Clients ---
  getClients() { return this.clients.asReadonly(); }
  
  getClientById(id: number): Observable<Client | undefined> {
    return this.clients$.pipe(
        map((clients: Client[]) => clients.find(c => c.id === id))
    );
  }

  addClient(client: Omit<Client, 'id' | 'status'>) {
    const newId = Math.max(...this.clients().map(c => c.id), 0) + 1;
    this.clients.update(current => [...current, { ...client, id: newId, status: 'Active' }]);
  }

  updateClient(client: Client) {
    this.clients.update(current => current.map(c => c.id === client.id ? client : c));
  }

  deleteClient(id: number) {
      this.clients.update(current => current.filter(c => c.id !== id));
      this.projects.update(projects => projects.filter(p => p.clientId !== id));
  }

  // --- Team Members ---
  getTeamMembers() { return this.members.asReadonly(); }

  getTeamMemberById(id: number): Observable<TeamMember | undefined> {
     return this.members$.pipe(
        map((members: TeamMember[]) => members.find(m => m.id === id))
     );
  }

  addTeamMember(member: Omit<TeamMember, 'id'>) {
      const newId = Math.max(...this.members().map(m => m.id), 0) + 1;
      this.members.update(current => [...current, { ...member, id: newId }]);
  }

  updateTeamMember(member: TeamMember) {
      this.members.update(current => current.map(m => m.id === member.id ? member : m));
  }

  deleteTeamMember(id: number) {
      this.members.update(current => current.filter(m => m.id !== id));
      this.projects.update(projects => projects.map(p => ({
          ...p,
          allocatedTeamMemberIds: p.allocatedTeamMemberIds.filter(mId => mId !== id),
          memberRates: Object.fromEntries(Object.entries(p.memberRates).filter(([key]) => Number(key) !== id))
      })));
  }

  // --- Projects ---
  getProjects() { return this.projects.asReadonly(); }
  
  getProjectById(id: number): Observable<Project | undefined> {
      return this.projects$.pipe(
        map((projects: Project[]) => projects.find(p => p.id === id))
      );
  }

  getProjectsByClientId(clientId: number): Observable<Project[]> {
    return this.projects$.pipe(
        map((projects: Project[]) => projects.filter(p => p.clientId === clientId))
    );
  }

  addProject(project: Omit<Project, 'id' | 'hours'>) {
      const newId = Math.max(...this.projects().map(p => p.id), 0) + 1;
      this.projects.update(current => [...current, { ...project, id: newId, hours: {} }]);
  }

  updateProject(project: Project) {
      this.projects.update(current => current.map(p => p.id === project.id ? project : p));
  }

  deleteProject(id: number) {
      this.projects.update(current => current.filter(p => p.id !== id));
  }

  // --- Hours / Timesheet ---
  submitHours(projectId: number, weekId: string, entries: { [day: string]: TimeEntry }) {
    this.projects.update(current => current.map(p => {
      if (p.id === projectId) {
        const weekHours = p.hours[weekId] || {};
        return {
          ...p,
          hours: {
            ...p.hours,
            [weekId]: { ...weekHours, ...entries }
          }
        };
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

  updateInvoice(invoice: Invoice) {
      this.invoices.update(curr => curr.map(i => i.id === invoice.id ? invoice : i));
  }
  
  // --- Dashboard Data (Aggregated) ---
  getDashboardData(dateRange: { startDate: Date; endDate: Date }): Observable<any> {
      // Returning plain observable without delay
      return of({}).pipe(
          map(() => {
             const revenue = {
                 totalEarnings: 154200,
                 avgHourlyRate: 95,
                 totalHours: 1620,
                 earningsByClient: this.clients().slice(0, 5).map(c => ({ name: c.name, value: Math.floor(Math.random() * 50000) })),
                 mostValuableProjects: this.projects().slice(0, 5).map(p => ({ name: p.name, clientName: this.clients().find(c=>c.id===p.clientId)?.name, value: Math.floor(Math.random() * 20000) }))
             };
             
             const clientData = {
                 activeClientsCount: this.clients().filter(c => c.status === 'Active').length,
                 mostValuableClients: this.clients().slice(0, 5).map(c => ({ name: c.name, value: Math.floor(Math.random() * 100000) })),
                 clientsWithMostBilledTime: this.clients().slice(0, 5).map(c => ({ name: c.name, hours: Math.floor(Math.random() * 500) })),
                 projectValuePerClient: this.clients().slice(0, 5).map(c => ({ name: c.name, avgValue: Math.floor(Math.random() * 15000) })),
                 invoiceStatusSummary: { 
                    paid: this.invoices().filter(i => i.status === 'Paid').length, 
                    pending: this.invoices().filter(i => i.status === 'Pending').length, 
                    overdue: this.invoices().filter(i => i.status === 'Overdue').length 
                 }
             };

             const memberData = {
                 activeMembersCount: this.members().filter(m => m.status === 'Active').length,
                 rankingByHours: this.members().slice(0, 5).map(m => ({ member: m, hours: Math.floor(Math.random() * 1000), earnings: Math.floor(Math.random() * 100000) })).sort((a,b) => b.hours - a.hours),
                 mostProfitableMember: { member: this.members()[0], hours: 1000, earnings: 120000 },
                 mostHoursLogged: { member: this.members()[1], hours: 1200, earnings: 95000 }
             };
             
             // Tasks
             const tasks = {
                 recentlyAddedTasks: this.tasks().slice(0, 5),
                 recentlyChangedTasks: this.tasks().slice(5, 10), 
                 boardActivity: this.boards().slice(0, 3).map(b => ({ name: b.name, projectId: b.projectId, count: Math.floor(Math.random() * 50) }))
             };

             return { revenue, clients: clientData, members: memberData, tasks };
          })
      );
  }

  // --- Job Board ---
  getJobs(preferences: JobPreferences): Observable<Job[]> {
      return of(MOCK_JOBS);
  }

  // --- Boards & Tasks ---
  getBoards() { return this.boards.asReadonly(); }
  addBoard(board: Omit<Board, 'id'>) { this.boards.update(b => [...b, { ...board, id: crypto.randomUUID() }]); }
  updateBoard(board: Board) { this.boards.update(b => b.map(x => x.id === board.id ? board : x)); }
  deleteBoard(id: string) { 
      this.boards.update(b => b.filter(x => x.id !== id));
      this.tasks.update(t => t.filter(x => x.boardId !== id));
  }

  getAllTasks() { return this.tasks.asReadonly(); }
  getTasksByProjectId(projectId: number): Observable<Task[]> {
      return this.tasks$.pipe(
        map((tasks: Task[]) => tasks.filter(t => t.projectId === projectId))
      );
  }
  addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments'>) {
      this.tasks.update(t => [...t, { ...task, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), comments: [] }]);
  }
  updateTask(task: Task) {
      this.tasks.update(t => t.map(x => x.id === task.id ? { ...task, updatedAt: new Date() } : x));
  }
  deleteTask(id: string) { this.tasks.update(t => t.filter(x => x.id !== id)); }
  addTaskComment(taskId: string, comment: Omit<TaskComment, 'id' | 'createdAt'>) {
      this.tasks.update(tasks => tasks.map(t => {
          if (t.id === taskId) {
              return {
                  ...t,
                  comments: [...t.comments, { ...comment, id: crypto.randomUUID(), createdAt: new Date() }]
              };
          }
          return t;
      }));
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

  // --- Project Details ---
  addProjectComment(projectId: number, comment: { text: string, authorId: number }) {
      this.projects.update(current => current.map(p => {
          if (p.id === projectId) {
              const newComment: ProjectComment = {
                  id: crypto.randomUUID(),
                  text: comment.text,
                  authorId: comment.authorId,
                  createdAt: new Date()
              };
              return { ...p, comments: [...(p.comments || []), newComment] };
          }
          return p;
      }));
  }

  addProjectFile(projectId: number, file: Omit<ProjectFile, 'id' | 'uploadedAt'>) {
      this.projects.update(current => current.map(p => {
          if (p.id === projectId) {
              const newFile: ProjectFile = {
                  ...file,
                  id: crypto.randomUUID(),
                  uploadedAt: new Date()
              };
              return { ...p, files: [...(p.files || []), newFile] };
          }
          return p;
      }));
  }
}
