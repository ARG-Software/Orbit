
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  Signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MockDataService,
  Client,
  Project,
  TeamMember,
  Task,
  Board,
} from '../../services/mock-data.service';
import { AuthService } from '../../services/auth.service';
import { RouterLink } from '@angular/router';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { DatePipe } from '@angular/common';
import { TaskModalComponent } from '../modals/task-modal/task-modal.component';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.css',
  imports: [FormsModule, RouterLink, PaginationComponent, DatePipe, TaskModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksComponent {
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);

  // --- Tabs State ---
  activeTab = signal<'list' | 'board' | 'archive'>('list');

  // --- Master Data Signals ---
  clients = this.dataService.getClients();
  allProjects = this.dataService.getProjects();
  allBoards = this.dataService.getBoards();
  allMembers = this.dataService.getTeamMembers();
  allTasks = this.dataService.getAllTasks();
  currentUser = this.authService.currentUser;

  // ==========================================
  // TAB 1: TASK LIST (Active Global)
  // ==========================================
  
  listFilterClientId = signal<number | null>(null);
  listFilterProjectId = signal<number | null>(null);
  listFilterBoardId = signal<string | null>(null);
  listFilterStatus = signal<string>('All');
  listFilterPriority = signal<string>('All');
  listFilterMemberId = signal<number | null>(null);
  
  listPage = signal(1);
  listPerPage = signal(10);

  // Derived options for List filters
  projectsForListFilter = computed(() => {
    const clientId = this.listFilterClientId();
    if (!clientId) return this.allProjects();
    return this.allProjects().filter(p => p.clientId === clientId);
  });

  boardsForListFilter = computed(() => {
      const projectId = this.listFilterProjectId();
      if (projectId) return this.allBoards().filter(b => b.projectId === projectId);
      const clientId = this.listFilterClientId();
      if (clientId) {
          const pIds = this.allProjects().filter(p => p.clientId === clientId).map(p => p.id);
          return this.allBoards().filter(b => pIds.includes(b.projectId));
      }
      return this.allBoards();
  });

  filteredTaskList = computed(() => {
    let tasks = this.allTasks().filter(t => t.status !== 'Archived');
    
    const clientId = this.listFilterClientId();
    const projectId = this.listFilterProjectId();
    const boardId = this.listFilterBoardId();
    const status = this.listFilterStatus();
    const priority = this.listFilterPriority();
    const memberId = this.listFilterMemberId();

    if (clientId) {
        const clientProjectIds = this.allProjects().filter(p => p.clientId === clientId).map(p => p.id);
        tasks = tasks.filter(t => clientProjectIds.includes(t.projectId));
    }
    if (projectId) {
        tasks = tasks.filter(t => t.projectId === projectId);
    }
    if (boardId) {
        tasks = tasks.filter(t => t.boardId === boardId);
    }
    if (status !== 'All') {
        tasks = tasks.filter(t => t.status === status);
    }
    if (priority !== 'All') {
        tasks = tasks.filter(t => t.priority === priority);
    }
    if (memberId) {
        tasks = tasks.filter(t => t.assignedMemberId === memberId);
    }

    // Sort: Newest modified first
    return [...tasks].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  });

  paginatedListTasks = computed(() => {
    const tasks = this.filteredTaskList();
    const startIndex = (this.listPage() - 1) * this.listPerPage();
    return tasks.slice(startIndex, startIndex + this.listPerPage());
  });

  onListPageChange(page: number) {
    this.listPage.set(page);
  }
  
  resetListFilters() {
      this.listFilterClientId.set(null);
      this.listFilterProjectId.set(null);
      this.listFilterBoardId.set(null);
      this.listFilterStatus.set('All');
      this.listFilterPriority.set('All');
      this.listFilterMemberId.set(null);
      this.listPage.set(1);
  }

  // ==========================================
  // TAB 2: BOARDS & TASKS (Kanban)
  // ==========================================

  // Navigation State
  selectedBoardId: WritableSignal<string | null> = signal(null);
  
  // Context for the currently selected board
  selectedClientId: WritableSignal<number | null> = signal(null);
  selectedProjectId: WritableSignal<number | null> = signal(null);
  
  // Board List Filtering
  boardFilterClientId = signal<number | null>(null);
  boardFilterProjectId = signal<number | null>(null);
  boardListPage = signal(1);
  boardListPerPage = signal(9); 

  // Board Detail Filtering
  boardFilterMemberId = signal<number | null>(null);

  availableProjectsForBoardFilter = computed(() => {
    const cId = this.boardFilterClientId();
    if (!cId) return [];
    return this.allProjects().filter(p => p.clientId === cId);
  });

  projectMembersForBoardFilter = computed(() => {
    const pId = this.selectedProjectId();
    if (!pId) return [];
    const project = this.allProjects().find(p => p.id === pId);
    return project ? this.allMembers().filter(m => project.allocatedTeamMemberIds.includes(m.id)) : [];
  });
  
  boardsList = computed(() => {
    const boards = this.allBoards();
    const projects = this.allProjects();
    const clients = this.clients();
    const tasks = this.allTasks();

    return boards.map(board => {
        const project = projects.find(p => p.id === board.projectId);
        const client = clients.find(c => c.id === project?.clientId);
        const taskCount = tasks.filter(t => t.boardId === board.id && t.status !== 'Archived').length;
        return {
            ...board,
            projectName: project?.name || 'Unknown Project',
            projectId: project?.id,
            clientName: client?.name || 'Unknown Client',
            clientId: client?.id,
            clientColor: client?.color || '#e2e8f0',
            taskCount
        };
    });
  });
  
  filteredBoards = computed(() => {
      let list = this.boardsList();
      if (this.boardFilterClientId()) {
          list = list.filter(b => b.clientId === this.boardFilterClientId());
      }
      if (this.boardFilterProjectId()) {
          list = list.filter(b => b.projectId === this.boardFilterProjectId());
      }
      return list;
  });

  paginatedBoardsList = computed(() => {
      const boards = this.filteredBoards();
      const startIndex = (this.boardListPage() - 1) * this.boardListPerPage();
      return boards.slice(startIndex, startIndex + this.boardListPerPage());
  });

  onBoardListPageChange(page: number) {
      this.boardListPage.set(page);
  }

  resetBoardFilters() {
      this.boardFilterClientId.set(null);
      this.boardFilterProjectId.set(null);
      this.boardListPage.set(1);
  }

  viewBoard(boardId: string) {
      const board = this.allBoards().find(b => b.id === boardId);
      if (board) {
          const project = this.allProjects().find(p => p.id === board.projectId);
          if (project) {
              this.selectedClientId.set(project.clientId);
              this.selectedProjectId.set(project.id);
          }
          this.selectedBoardId.set(boardId);
          this.boardFilterMemberId.set(null);
          this.boardPage.set(1);
      }
  }

  backToBoards() {
      this.selectedBoardId.set(null);
      this.selectedProjectId.set(null);
      this.selectedClientId.set(null);
  }

  // Board Actions
  isBoardModalOpen = signal(false);
  isBoardEditMode = signal(false);
  editingBoardId = signal<string | null>(null);
  boardModalClientId = signal<number | null>(null);
  boardModalProjectId = signal<number | null>(null);
  boardModalName = signal('');

  boardModalProjects = computed(() => {
      const cId = this.boardModalClientId();
      if (cId) return this.allProjects().filter(p => p.clientId === cId);
      return [];
  });

  openBoardModal(board?: Board) {
      this.isBoardEditMode.set(!!board);
      if (board) {
          this.editingBoardId.set(board.id);
          const project = this.allProjects().find(p => p.id === board.projectId);
          if (project) {
              this.boardModalClientId.set(project.clientId);
          }
          this.boardModalProjectId.set(board.projectId);
          this.boardModalName.set(board.name);
      } else {
          this.editingBoardId.set(null);
          this.boardModalClientId.set(null);
          this.boardModalProjectId.set(null);
          this.boardModalName.set('');
      }
      this.isBoardModalOpen.set(true);
  }
  
  closeBoardModal() {
      this.isBoardModalOpen.set(false);
      this.isBoardEditMode.set(false);
      this.editingBoardId.set(null);
  }
  
  saveBoard() {
      if (this.boardModalProjectId() && this.boardModalName()) {
          if (this.isBoardEditMode() && this.editingBoardId()) {
              this.dataService.updateBoard({
                  id: this.editingBoardId()!,
                  projectId: this.boardModalProjectId()!,
                  name: this.boardModalName()
              });
          } else {
              this.dataService.addBoard({
                  projectId: this.boardModalProjectId()!,
                  name: this.boardModalName(),
              });
          }
          this.closeBoardModal();
      }
  }

  deleteBoard(boardId: string) {
      if(confirm('Are you sure you want to delete this board? All associated tasks will also be removed.')) {
          this.dataService.deleteBoard(boardId);
      }
  }

  // Board Detail View
  workViewMode = signal<'kanban' | 'list'>('kanban');

  filteredBoardTasks = computed(() => {
    let tasks = this.allTasks().filter(t => t.status !== 'Archived'); // Filter out archived
    const boardId = this.selectedBoardId();
    const memberId = this.boardFilterMemberId();

    if (boardId) {
        tasks = tasks.filter(t => t.boardId === boardId);
    } else {
        return [];
    }

    if (memberId) {
        tasks = tasks.filter(t => t.assignedMemberId === memberId);
    }

    return [...tasks].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  });
  
  totalBoardTasks = computed(() => this.filteredBoardTasks().length);

  currentBoardName = computed(() => {
      return this.allBoards().find(b => b.id === this.selectedBoardId())?.name || 'Board';
  });

  boardPage = signal(1);
  boardPerPage = signal(10);

  paginatedBoardTasks = computed(() => {
      const tasks = this.filteredBoardTasks();
      const startIndex = (this.boardPage() - 1) * this.boardPerPage();
      return tasks.slice(startIndex, startIndex + this.boardPerPage());
  });
  
  onBoardPageChange(page: number) {
      this.boardPage.set(page);
  }

  tasksToDo = computed(() => this.filteredBoardTasks().filter((t) => t.status === 'To Do'));
  tasksInProgress = computed(() => this.filteredBoardTasks().filter((t) => t.status === 'In Progress'));
  tasksOnHold = computed(() => this.filteredBoardTasks().filter((t) => t.status === 'On Hold'));
  tasksCompleted = computed(() => this.filteredBoardTasks().filter((t) => t.status === 'Completed'));

  // ==========================================
  // TAB 3: ARCHIVE
  // ==========================================
  
  archiveFilterClientId = signal<number | null>(null);
  archiveFilterProjectId = signal<number | null>(null);
  archiveFilterBoardId = signal<string | null>(null);
  archiveFilterMemberId = signal<number | null>(null);
  
  archivePage = signal(1);
  archivePerPage = signal(10);

  // Derived options for Archive filters
  boardsForArchiveFilter = computed(() => {
      const projectId = this.archiveFilterProjectId();
      if (projectId) return this.allBoards().filter(b => b.projectId === projectId);
      return this.allBoards();
  });

  filteredArchiveTasks = computed(() => {
    // Base source is ONLY archived tasks
    let tasks = this.allTasks().filter(t => t.status === 'Archived');
    
    const clientId = this.archiveFilterClientId();
    const projectId = this.archiveFilterProjectId();
    const boardId = this.archiveFilterBoardId();
    const memberId = this.archiveFilterMemberId();

    if (clientId) {
        const clientProjectIds = this.allProjects().filter(p => p.clientId === clientId).map(p => p.id);
        tasks = tasks.filter(t => clientProjectIds.includes(t.projectId));
    }
    if (projectId) {
        tasks = tasks.filter(t => t.projectId === projectId);
    }
    if (boardId) {
        tasks = tasks.filter(t => t.boardId === boardId);
    }
    if (memberId) {
        tasks = tasks.filter(t => t.assignedMemberId === memberId);
    }

    return [...tasks].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  });

  paginatedArchiveTasks = computed(() => {
    const tasks = this.filteredArchiveTasks();
    const startIndex = (this.archivePage() - 1) * this.archivePerPage();
    return tasks.slice(startIndex, startIndex + this.archivePerPage());
  });

  onArchivePageChange(page: number) {
    this.archivePage.set(page);
  }
  
  resetArchiveFilters() {
      this.archiveFilterClientId.set(null);
      this.archiveFilterProjectId.set(null);
      this.archiveFilterBoardId.set(null);
      this.archiveFilterMemberId.set(null);
      this.archivePage.set(1);
  }

  // ==========================================
  // SHARED TASK ACTIONS (Create, Edit, Delete, Archive)
  // ==========================================
  
  isModalOpen = signal(false);
  taskToEdit = signal<Task | null>(null);
  taskModalContext = signal<{ clientId: number, projectId: number, boardId: string } | null>(null);

  openAddTaskModal(): void {
    this.taskToEdit.set(null);
    // If in board view, lock context
    if (this.activeTab() === 'board' && this.selectedBoardId()) {
        this.taskModalContext.set({
            clientId: this.selectedClientId()!,
            projectId: this.selectedProjectId()!,
            boardId: this.selectedBoardId()!
        });
    } else {
        this.taskModalContext.set(null);
    }
    this.isModalOpen.set(true);
  }

  openEditTaskModal(task: Task): void {
    this.taskToEdit.set(task);
    this.taskModalContext.set(null);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.taskToEdit.set(null);
    this.taskModalContext.set(null);
  }

  deleteTask(taskId: string): void {
    if (confirm('Are you sure you want to delete this task permanently? This cannot be undone.')) {
      this.dataService.deleteTask(taskId);
    }
  }

  archiveTask(taskId: string): void {
      const task = this.allTasks().find(t => t.id === taskId);
      if (task) {
          this.dataService.updateTask({ ...task, status: 'Archived' });
      }
  }

  restoreTask(taskId: string): void {
      const task = this.allTasks().find(t => t.id === taskId);
      if (task) {
          this.dataService.updateTask({ ...task, status: 'To Do' });
      }
  }

  updateTaskStatus(task: Task, newStatus: Task['status']): void {
    if (task.status === newStatus) return;
    this.dataService.updateTask({ ...task, status: newStatus });
  }

  // Drag and Drop
  draggedTask: Task | null = null;

  onDragStart(event: DragEvent, task: Task) {
    this.draggedTask = task;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', task.id);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault(); 
    event.dataTransfer!.dropEffect = 'move';
    const target = event.currentTarget as HTMLElement;
    target.classList.add('drag-over');
  }

  onDragLeave(event: DragEvent) {
    const target = event.currentTarget as HTMLElement;
    target.classList.remove('drag-over');
  }

  onDrop(event: DragEvent, newStatus: Task['status']) {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.classList.remove('drag-over');
    if (this.draggedTask && this.draggedTask.status !== newStatus) {
      this.updateTaskStatus(this.draggedTask, newStatus);
    }
    this.draggedTask = null;
  }
  
  // Shared Helpers
  getMemberById(id: number): TeamMember | undefined {
    return this.allMembers().find((m) => m.id === id);
  }

  getProjectById(id: number): Project | undefined {
      return this.allProjects().find(p => p.id === id);
  }
  
  getBoardById(id: string | null): Board | undefined {
      if (!id) return undefined;
      return this.allBoards().find(b => b.id === id);
  }
  
  getClientById(id: number): Client | undefined {
      return this.clients().find(c => c.id === id);
  }

  getPriorityClass(priority: Task['priority']): string {
    return {
      'High': 'border-error',
      'Medium': 'border-warning',
      'Low': 'border-info'
    }[priority] || 'border-transparent';
  }

  getPriorityBadgeClass(priority: Task['priority']): string {
    return {
      'High': 'badge-error',
      'Medium': 'badge-warning',
      'Low': 'badge-info'
    }[priority] || 'badge-ghost';
  }

  getStatusBorderClass(status: string): string {
    switch (status) {
      case 'To Do': return 'border-l-base-300'; // Changed to grey/neutral
      case 'In Progress': return 'border-l-primary';
      case 'On Hold': return 'border-l-warning'; 
      case 'Completed': return 'border-l-success';
      case 'Archived': return 'border-l-neutral';
      default: return 'border-l-base-200';
    }
  }

  // Calculate percentage of tasks for this column vs total on board
  getColumnPercentage(count: number): number {
    const total = this.totalBoardTasks();
    return total === 0 ? 0 : (count / total) * 100;
  }

  getColumnFillClass(status: string): string {
    switch (status) {
      case 'To Do': return 'bg-neutral';
      case 'In Progress': return 'bg-primary';
      case 'On Hold': return 'bg-warning';
      case 'Completed': return 'bg-success';
      default: return 'bg-base-200';
    }
  }

  getColumnContainerClass(status: string, count: number): string {
      // Base styling for the container (pill shape, flex layout, border)
      const baseClasses = 'w-14 rounded-full flex flex-col items-center py-4 gap-4 h-full shrink-0 relative overflow-hidden transition-all duration-300 border-2 ';
      
      // Determine border color based on status
      let borderColor = '';
      switch(status) {
          case 'To Do': borderColor = 'border-base-300'; break;
          case 'In Progress': borderColor = 'border-primary/50'; break;
          case 'On Hold': borderColor = 'border-warning/50'; break;
          case 'Completed': borderColor = 'border-success/50'; break;
          default: borderColor = 'border-base-200';
      }

      // If empty, dashed line as outline. If has tasks, solid.
      const borderStyle = count === 0 ? 'border-dashed bg-transparent' : 'border-solid bg-base-100/30';

      return baseClasses + borderColor + ' ' + borderStyle;
  }
}
