
import { Component, ChangeDetectionStrategy, inject, Signal, effect, signal, computed, WritableSignal } from '@angular/core';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { MockDataService, Project, TeamMember, Client, Task, Board, ProjectFile, WikiSection } from '../../services/mock-data.service';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, NgClass, DatePipe, CurrencyPipe, SlicePipe } from '@angular/common';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { TaskModalComponent } from '../modals/task-modal/task-modal.component';
import { PaymentModalComponent } from '../modals/payment-modal/payment-modal.component';
import * as d3 from 'd3';

interface ChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: Date;
  isMe: boolean;
}

@Component({
  selector: 'app-project-detail',
  templateUrl: './project-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DecimalPipe, NgClass, DatePipe, PaginationComponent, TaskModalComponent, CurrencyPipe, SlicePipe, PaymentModalComponent],
})
export class ProjectDetailComponent {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;

  // Route Param Data
  project: Signal<Project | undefined> = toSignal(
    this.route.paramMap.pipe(
      map((params: ParamMap) => Number(params.get('id'))),
      switchMap((id: number) => this.dataService.getProjectById(id))
    )
  );

  // Global Data
  clients = this.dataService.getClients();
  allMembers = this.dataService.getTeamMembers();
  allTasks = this.dataService.getAllTasks();
  allBoards = this.dataService.getBoards();

  // Tab State
  activeTab = signal<'overview' | 'wiki' | 'tasks' | 'files' | 'team' | 'chat'>('overview');

  // Payment Modal State
  isPaymentModalOpen = signal(false);
  payMemberId = signal<number | null>(null);
  payAmount = signal<number | null>(null);

  // Task Filter State
  taskFilterAssignee = signal<number | null>(null);
  taskFilterPriority = signal<'All' | 'High' | 'Medium' | 'Low'>('All');
  taskSearch = signal('');

  // --- Overview State ---
  projectStats = computed(() => {
      const p = this.project();
      if (!p) return null;
      const tasks = this.projectTasks();
      const done = tasks.filter(t => t.status === 'Completed').length;
      const total = tasks.length;
      const progress = total > 0 ? (done / total) * 100 : 0;
      return { totalTasks: total, completedTasks: done, progress };
  });

  // Financial Calculations
  projectFinancials = computed(() => {
      const p = this.project();
      if (!p) return { income: 0, expense: 0, profit: 0, profitMargin: 0 };

      // 1. Calculate Expenses (Cost of Team, excluding Admins/Founders)
      let totalExpense = 0;
      Object.values(p.hours).forEach(week => {
          Object.values(week).forEach((entry: any) => {
              const member = this.allMembers().find(m => m.id === entry.memberId);
              // Admins and Founders do not count as expense
              if (member && member.role !== 'Founder' && member.role !== 'Admin') {
                  const rate = p.memberRates[entry.memberId] ?? 0;
                  const cost = entry.hours * rate;
                  totalExpense += cost;
              }
          });
      });

      // 2. Calculate Income (Revenue)
      let totalIncome = 0;
      if (p.billingType === 'fixed') {
          totalIncome = p.fixedPrice || 0;
      } else {
          // Hourly billing to client
          const defaultClientRate = p.defaultRate || 0;
          let totalHours = 0;
          Object.values(p.hours).forEach(week => {
              Object.values(week).forEach((entry: any) => {
                  totalHours += entry.hours;
              });
          });
          totalIncome = totalHours * defaultClientRate;
      }

      const profit = totalIncome - totalExpense;
      const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

      return { income: totalIncome, expense: totalExpense, profit, profitMargin };
  });

  // D3 Chart Logic
  chartWidth = 600;
  chartHeight = 250;
  
  financialChartPaths = computed(() => {
      const p = this.project();
      if (!p) return null;

      // 1. Aggregate Data by Date
      const timelineMap = new Map<string, { date: Date, revenue: number, expense: number }>();
      
      const startKey = new Date(p.createdAt).toISOString().split('T')[0];
      timelineMap.set(startKey, { date: new Date(p.createdAt), revenue: 0, expense: 0 });

      Object.entries(p.hours).forEach(([weekId, days]) => {
          Object.entries(days).forEach(([dayName, entry]: [string, any]) => {
              const date = new Date(p.createdAt); 
              date.setDate(date.getDate() + (Math.abs(weekId.hashCode()) % 60));
              
              const key = date.toISOString().split('T')[0];
              const current = timelineMap.get(key) || { date, revenue: 0, expense: 0 };
              
              const member = this.allMembers().find(m => m.id === entry.memberId);
              // Only add to expense if not founder
              if (member && member.role !== 'Founder' && member.role !== 'Admin') {
                  const memberRate = p.memberRates[entry.memberId] ?? 0;
                  current.expense += entry.hours * memberRate;
              }
              
              if (p.billingType === 'hourly') {
                  current.revenue += entry.hours * (p.defaultRate || 0);
              }
              
              timelineMap.set(key, current);
          });
      });

      let data = Array.from(timelineMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
      
      let cumRev = 0;
      let cumExp = 0;
      data = data.map(d => {
          cumRev += d.revenue;
          cumExp += d.expense;
          return { ...d, revenue: cumRev, expense: cumExp };
      });

      if (p.billingType === 'fixed' && p.fixedPrice) {
          const total = p.fixedPrice;
          data = data.map((d, i) => ({
              ...d,
              revenue: i === 0 ? 0 : (total * (i / (data.length - 1 || 1)))
          }));
      }

      if (data.length < 2) {
          const next = new Date(p.createdAt);
          next.setDate(next.getDate() + 1);
          data.push({ date: next, revenue: 0, expense: 0 });
      }

      const xScale = d3.scaleTime()
          .domain(d3.extent(data, d => d.date) as [Date, Date])
          .range([0, this.chartWidth]);

      const maxVal = Math.max(d3.max(data, d => d.revenue) || 0, d3.max(data, d => d.expense) || 0);
      const yScale = d3.scaleLinear()
          .domain([0, maxVal * 1.1])
          .range([this.chartHeight, 0]);

      const lineRevenue = d3.line<any>()
          .curve(d3.curveMonotoneX)
          .x(d => xScale(d.date))
          .y(d => yScale(d.revenue));

      const lineExpense = d3.line<any>()
          .curve(d3.curveMonotoneX)
          .x(d => xScale(d.date))
          .y(d => yScale(d.expense));

      const areaExpense = d3.area<any>()
          .curve(d3.curveMonotoneX)
          .x(d => xScale(d.date))
          .y0(this.chartHeight)
          .y1(d => yScale(d.expense));

      return {
          revenueD: lineRevenue(data),
          expenseD: lineExpense(data),
          expenseAreaD: areaExpense(data),
          data
      };
  });

  userCostBreakdown = computed(() => {
      const p = this.project();
      if (!p) return [];
      
      const userMap = new Map<number, { member: TeamMember, hours: number, cost: number, revenue: number }>();

      Object.values(p.hours).forEach(week => {
          Object.values(week).forEach((entry: any) => {
              const member = this.allMembers().find(m => m.id === entry.memberId);
              if (member) {
                  const isFounder = member.role === 'Founder' || member.role === 'Admin';
                  const rate = p.memberRates[entry.memberId] ?? member.defaultHourlyRate;
                  const projectClientRate = p.defaultRate || 0; // Assuming project hourly rate

                  const current = userMap.get(member.id) || { member, hours: 0, cost: 0, revenue: 0 };
                  current.hours += entry.hours;
                  
                  if (!isFounder) {
                      current.cost += entry.hours * rate;
                  }
                  
                  // Calculate Revenue (What client is billed for this person's time)
                  // For Fixed projects, this is 0 unless pro-rated, keeping it simple:
                  if (p.billingType === 'hourly') {
                      current.revenue += entry.hours * projectClientRate;
                  }

                  userMap.set(member.id, current);
              }
          });
      });

      return Array.from(userMap.values()).sort((a, b) => b.cost - a.cost);
  });

  recentActivity = computed(() => {
      const p = this.project();
      if (!p) return [];
      const files = (p.files || []).map(f => ({ type: 'file', date: f.uploadedAt, label: `Uploaded ${f.name}` }));
      const tasks = this.projectTasks().map(t => ({ type: 'task', date: t.updatedAt, label: `Updated ${t.title}` }));
      
      return [...files, ...tasks]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 5);
  });

  // --- Chat State ---
  chatInput = signal('');
  chatMessages = signal<ChatMessage[]>([
      { id: '1', senderId: 999, senderName: 'System', senderAvatar: '', text: 'Project channel created.', timestamp: new Date(new Date().setDate(new Date().getDate() - 5)), isMe: false },
      { id: '2', senderId: 2, senderName: 'Jane Smith', senderAvatar: 'https://picsum.photos/seed/JaneSmith/100/100', text: 'Hey team, uploaded the new designs.', timestamp: new Date(new Date().setDate(new Date().getDate() - 2)), isMe: false },
  ]);

  sendMessage() {
      const text = this.chatInput().trim();
      if (!text) return;
      
      const user = this.currentUser();
      const newMessage: ChatMessage = {
          id: crypto.randomUUID(),
          senderId: user?.id || 0,
          senderName: user?.name || 'Me',
          senderAvatar: user?.logoUrl || 'https://picsum.photos/seed/me/100/100',
          text: text,
          timestamp: new Date(),
          isMe: true
      };

      this.chatMessages.update(msgs => [...msgs, newMessage]);
      this.chatInput.set('');
  }

  // --- Task State ---
  projectTasks = computed(() => {
      const p = this.project();
      if (!p) return [];
      
      const assigneeFilter = this.taskFilterAssignee();
      const priorityFilter = this.taskFilterPriority();
      const searchTerm = this.taskSearch().toLowerCase();

      return this.allTasks().filter(t => {
          // Base Project Filter
          if (t.projectId !== p.id || t.status === 'Archived') return false;
          
          // Custom Filters
          if (assigneeFilter !== null && t.assignedMemberId !== assigneeFilter) return false;
          if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
          if (searchTerm && !t.title.toLowerCase().includes(searchTerm)) return false;

          return true;
      }).sort((a,b) => (a.order || 0) - (b.order || 0));
  });

  kanbanColumns = computed(() => [
      { title: 'To Do', tasks: this.projectTasks().filter(t => t.status === 'To Do'), status: 'To Do' },
      { title: 'In Progress', tasks: this.projectTasks().filter(t => t.status === 'In Progress'), status: 'In Progress' },
      { title: 'On Hold', tasks: this.projectTasks().filter(t => t.status === 'On Hold'), status: 'On Hold' },
      { title: 'Completed', tasks: this.projectTasks().filter(t => t.status === 'Completed'), status: 'Completed' }
  ]);

  isTaskModalOpen = signal(false);
  taskToEdit = signal<Task | null>(null);
  taskModalContext = computed(() => {
      const p = this.project();
      if(!p) return null;
      return { 
          clientId: p.clientId, 
          projectId: p.id, 
          boardId: ''
      };
  });

  // --- Wiki State ---
  selectedWikiSectionId = signal<string | null>(null);
  isEditingWiki = signal(false);
  wikiEditTitle = signal('');
  wikiEditContent = signal('');

  currentWikiSection = computed(() => {
      const p = this.project();
      if (!p || !p.wiki || p.wiki.length === 0) return null;
      const id = this.selectedWikiSectionId();
      if (id) {
          return p.wiki.find(s => s.id === id) || p.wiki[0];
      }
      return p.wiki[0];
  });

  addWikiSection() {
      const p = this.project();
      if (!p) return;
      
      const newSection: WikiSection = {
          id: crypto.randomUUID(),
          title: 'New Page',
          content: '# New Page\nStart writing here...',
          lastUpdated: new Date()
      };
      
      this.dataService.updateProject({
          ...p,
          wiki: [...(p.wiki || []), newSection]
      });
      this.selectedWikiSectionId.set(newSection.id);
      this.startEditingWiki(newSection);
  }

  startEditingWiki(section: WikiSection) {
      this.wikiEditTitle.set(section.title);
      this.wikiEditContent.set(section.content);
      this.isEditingWiki.set(true);
  }

  saveWikiSection() {
      const p = this.project();
      const current = this.currentWikiSection();
      if (!p || !current) return;

      const updatedSections = p.wiki.map(s => {
          if (s.id === current.id) {
              return { 
                  ...s, 
                  title: this.wikiEditTitle(), 
                  content: this.wikiEditContent(),
                  lastUpdated: new Date()
              };
          }
          return s;
      });

      this.dataService.updateProject({ ...p, wiki: updatedSections });
      this.isEditingWiki.set(false);
      this.triggerSuccessToast();
  }

  deleteWikiSection() {
      const p = this.project();
      const current = this.currentWikiSection();
      if (!p || !current) return;

      if(confirm('Delete this wiki page?')) {
          const updatedSections = p.wiki.filter(s => s.id !== current.id);
          this.dataService.updateProject({ ...p, wiki: updatedSections });
          this.selectedWikiSectionId.set(null); // Will default to first
          this.isEditingWiki.set(false);
      }
  }

  selectWikiSection(id: string) {
      this.selectedWikiSectionId.set(id);
      this.isEditingWiki.set(false);
  }

  // --- Files State ---
  fileSearch = signal('');
  projectFiles = computed(() => {
      const p = this.project();
      if (!p || !p.files) return [];
      const term = this.fileSearch().toLowerCase();
      return p.files.filter(f => f.name.toLowerCase().includes(term)).sort((a,b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  });
  isUploading = signal(false);

  // --- Team State ---
  showAddMemberModal = signal(false);
  addMemberPage = signal(1);
  addMemberPerPage = signal(5);
  
  projectName = signal('');
  projectDescription = signal('');
  projectStatus = signal<'Active' | 'Completed' | 'Paused' | 'Archived'>('Active');
  allocatedMemberIds = signal<number[]>([]);
  memberRates = signal<{ [id: number]: number }>({});
  memberPaymentTypes = signal<{ [id: number]: 'hourly' | 'fixed' }>({});
  
  // Team Grouping
  founderMembers = computed(() => {
      const p = this.project();
      if (!p) return [];
      return p.allocatedTeamMemberIds
          .map(id => this.allMembers().find(m => m.id === id))
          .filter((m): m is TeamMember => !!m && (m.role === 'Founder' || m.role === 'Admin'));
  });

  regularMembers = computed(() => {
      const p = this.project();
      if (!p) return [];
      return p.allocatedTeamMemberIds
          .map(id => this.allMembers().find(m => m.id === id))
          .filter((m): m is TeamMember => !!m && m.role !== 'Founder' && m.role !== 'Admin');
  });

  // Add Member Temp State
  tempMemberPaymentType = signal<'hourly' | 'fixed'>('hourly');
  tempMemberRate = signal<number>(0);

  showSuccessToast = signal(false);

  constructor() {
    effect(() => {
      const p = this.project();
      if (p) {
        this.projectName.set(p.name);
        this.projectDescription.set(p.description || '');
        this.projectStatus.set(p.status);
        this.allocatedMemberIds.set([...p.allocatedTeamMemberIds]);
        this.memberRates.set({ ...p.memberRates });
        this.memberPaymentTypes.set({ ...p.memberPaymentTypes });
      }
    }, { allowSignalWrites: true });
  }

  // Helpers
  getClient(id: number | null) {
    return this.clients().find(c => c.id === id);
  }

  getMember(id: number) {
    return this.allMembers().find(m => m.id === id);
  }

  getPriorityBadgeClass(priority: string) {
      switch(priority) {
          case 'High': return 'badge-error bg-error/10 text-error';
          case 'Medium': return 'badge-warning bg-warning/10 text-warning';
          case 'Low': return 'badge-info bg-info/10 text-info';
          default: return 'badge-ghost';
      }
  }

  getTaskCardColorClass(status: string) {
      switch(status) {
          case 'To Do': return 'bg-base-100 border-base-300';
          case 'In Progress': return 'bg-info/10 border-info/40 hover:border-info';
          case 'On Hold': return 'bg-warning/10 border-warning/40 hover:border-warning';
          case 'Completed': return 'bg-success/10 border-success/40 hover:border-success';
          default: return 'bg-base-100 border-base-200';
      }
  }

  getColumnFillColor(title: string) {
      switch(title) {
          case 'To Do': return 'bg-base-content';
          case 'In Progress': return 'bg-info';
          case 'On Hold': return 'bg-warning';
          case 'Completed': return 'bg-success';
          default: return 'bg-base-300';
      }
  }

  getColumnPercentage(count: number) {
      const max = 10;
      return Math.min((count / max) * 100, 100);
  }

  // Actions
  togglePin() {
      const p = this.project();
      if (p) {
          this.dataService.toggleProjectPin(p.id);
      }
  }

  openAddTaskModal() {
      this.taskToEdit.set(null);
      this.isTaskModalOpen.set(true);
  }

  openEditTaskModal(task: Task) {
      this.taskToEdit.set(task);
      this.isTaskModalOpen.set(true);
  }

  closeTaskModal() {
      this.isTaskModalOpen.set(false);
      this.taskToEdit.set(null);
  }

  // Team Management
  availableMembersToAdd = computed(() => {
      const all = this.allMembers();
      const currentIds = this.allocatedMemberIds();
      return all.filter(m => !currentIds.includes(m.id));
  });

  paginatedAvailableMembers = computed(() => {
      const members = this.availableMembersToAdd();
      const start = (this.addMemberPage() - 1) * this.addMemberPerPage();
      return members.slice(start, start + this.addMemberPerPage());
  });

  onAddMemberPageChange(page: number) {
      this.addMemberPage.set(page);
  }

  openAddMemberModal() {
      this.showAddMemberModal.set(true);
      // Reset temp values
      this.tempMemberPaymentType.set('hourly');
      this.tempMemberRate.set(0);
  }

  addMemberToProject(member: TeamMember) {
      this.allocatedMemberIds.update(ids => [...ids, member.id]);
      
      // Use values from the modal state
      const rate = this.tempMemberRate() > 0 ? this.tempMemberRate() : member.defaultHourlyRate;
      const type = this.tempMemberPaymentType();

      this.memberRates.update(rates => ({ ...rates, [member.id]: rate }));
      this.memberPaymentTypes.update(types => ({ ...types, [member.id]: type }));
      
      this.saveChanges();
  }

  removeMemberFromProject(memberId: number) {
      if(confirm('Remove this member from the project?')) {
        this.allocatedMemberIds.update(ids => ids.filter(id => id !== memberId));
        
        // Remove from local maps too to be clean
        const newRates = { ...this.memberRates() };
        delete newRates[memberId];
        this.memberRates.set(newRates);

        this.saveChanges();
      }
  }

  updateRate(memberId: number, rate: number) {
    this.memberRates.update(rates => ({ ...rates, [memberId]: rate }));
  }

  saveChanges() {
    const p = this.project();
    if (!p) return;

    const finalRates: { [id: number]: number } = {};
    const finalTypes: { [id: number]: 'hourly' | 'fixed' } = {};
    
    this.allocatedMemberIds().forEach(id => {
        finalRates[id] = this.memberRates()[id] ?? 0;
        finalTypes[id] = this.memberPaymentTypes()[id] || 'hourly';
    });

    const updatedProject: Project = {
        ...p,
        name: this.projectName(),
        description: this.projectDescription(),
        status: this.projectStatus(),
        allocatedTeamMemberIds: this.allocatedMemberIds(),
        memberRates: finalRates,
        memberPaymentTypes: finalTypes
    };

    this.dataService.updateProject(updatedProject);
    this.triggerSuccessToast();
  }

  deleteProject() {
    if (confirm('Are you sure you want to delete this project?')) {
        const p = this.project();
        if (p) {
            this.dataService.deleteProject(p.id);
            this.router.navigate(['/app/projects']);
        }
    }
  }

  openPaymentModal(memberId: number, amount: number) {
      this.payMemberId.set(memberId);
      this.payAmount.set(amount);
      this.isPaymentModalOpen.set(true);
  }

  closePaymentModal() {
      this.isPaymentModalOpen.set(false);
      this.payMemberId.set(null);
      this.payAmount.set(null);
  }

  // Files
  triggerFileUpload(input: HTMLInputElement) {
      input.click();
  }

  onFileSelected(event: Event) {
      const p = this.project();
      const user = this.currentUser();
      const input = event.target as HTMLInputElement;
      
      if (!p || !input.files || input.files.length === 0) return;
      
      const file = input.files[0];
      this.isUploading.set(true);

      setTimeout(() => {
          let type: 'doc' | 'sheet' | 'image' | 'pdf' | 'other' = 'other';
          if(file.name.includes('doc')) type = 'doc';
          if(file.name.includes('xls') || file.name.includes('csv')) type = 'sheet';
          if(file.name.includes('pdf')) type = 'pdf';
          if(file.name.includes('jpg') || file.name.includes('png')) type = 'image';

          this.dataService.addProjectFile(p.id, {
              name: file.name,
              url: '#',
              uploadedBy: user ? user.id : 0,
              type: type,
              size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
          });
          this.isUploading.set(false);
          input.value = '';
          this.activeTab.set('files');
      }, 800);
  }

  onTaskDragStart(event: DragEvent, task: Task) {
      if (event.dataTransfer) {
          event.dataTransfer.setData('text/plain', task.id);
          event.dataTransfer.effectAllowed = 'move';
      }
  }

  onTaskDrop(event: DragEvent, newStatus: Task['status'], targetTask?: Task) {
      event.preventDefault();
      event.stopPropagation();
      
      const taskId = event.dataTransfer?.getData('text/plain');
      if (!taskId) return;

      const allTasks = this.allTasks();
      const draggedTask = allTasks.find(t => t.id === taskId);
      
      if (draggedTask) {
          // Remove from current position first
          let tasksInColumn = allTasks.filter(t => t.projectId === draggedTask.projectId && t.status === newStatus && t.id !== draggedTask.id);
          
          // Sort by order to ensure we insert correctly
          tasksInColumn.sort((a,b) => (a.order || 0) - (b.order || 0));

          let newOrder = 0;

          if (targetTask) {
              // Insert before target task
              const targetIndex = tasksInColumn.findIndex(t => t.id === targetTask.id);
              if (targetIndex !== -1) {
                  const prevTask = tasksInColumn[targetIndex - 1];
                  const nextTask = tasksInColumn[targetIndex];
                  
                  const prevOrder = prevTask ? (prevTask.order || 0) : (nextTask.order || 0) - 1000;
                  const nextOrder = nextTask.order || 0;
                  
                  newOrder = (prevOrder + nextOrder) / 2;
              } else {
                  // Should not happen if targetTask is valid, but fallback to end
                  const lastTask = tasksInColumn[tasksInColumn.length - 1];
                  newOrder = lastTask ? (lastTask.order || 0) + 1000 : 1000;
              }
          } else {
              // Append to end of column
              const lastTask = tasksInColumn[tasksInColumn.length - 1];
              newOrder = lastTask ? (lastTask.order || 0) + 1000 : 1000;
          }

          this.dataService.updateTask({ 
              ...draggedTask, 
              status: newStatus, 
              order: newOrder,
              updatedAt: new Date() 
          });
      }
  }

  onDragOver(event: DragEvent) {
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'move';
  }

  private triggerSuccessToast() {
    this.showSuccessToast.set(true);
    setTimeout(() => this.showSuccessToast.set(false), 3000);
  }
  
  getFileIcon(type: string): string {
      switch(type) {
          case 'doc': return 'bg-blue-500 text-white';
          case 'sheet': return 'bg-green-500 text-white';
          case 'pdf': return 'bg-red-500 text-white';
          case 'image': return 'bg-purple-500 text-white';
          default: return 'bg-gray-500 text-white';
      }
  }
}

declare global {
    interface String {
        hashCode(): number;
    }
}

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; 
  }
  return hash;
};
