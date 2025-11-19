
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
import { toSignal } from '@angular/core/rxjs-interop';
import {
  MockDataService,
  Client,
  Project,
  TeamMember,
  Task,
  Board,
  TaskComment
} from '../../services/mock-data.service';
import { AuthService } from '../../services/auth.service';
import { RouterLink } from '@angular/router';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.css',
  imports: [FormsModule, RouterLink, PaginationComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksComponent {
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);

  // --- Tabs State ---
  activeTab = signal<'board' | 'history'>('board');

  // --- Master Data Signals ---
  clients: Signal<Client[]> = toSignal(this.dataService.getClients(), { initialValue: [] });
  allProjects: Signal<Project[]> = toSignal(this.dataService.getProjects(), { initialValue: [] });
  allBoards: Signal<Board[]> = toSignal(this.dataService.getBoards(), { initialValue: [] });
  allMembers: Signal<TeamMember[]> = toSignal(this.dataService.getTeamMembers(), { initialValue: [] });
  allTasks: Signal<Task[]> = toSignal(this.dataService.getAllTasks(), { initialValue: [] });
  currentUser = this.authService.currentUser;

  // ==========================================
  // TAB 1: BOARDS & TASKS
  // ==========================================

  // Navigation State
  // If selectedBoardId is null, we show the Board List.
  // If selectedBoardId is set, we show the Task View (Kanban/List).
  selectedBoardId: WritableSignal<string | null> = signal(null);
  
  // Context for the currently selected board (derived for convenience in Task Add Modal)
  selectedClientId: WritableSignal<number | null> = signal(null);
  selectedProjectId: WritableSignal<number | null> = signal(null);
  
  // --- Board List View & Filtering ---
  boardFilterClientId = signal<number | null>(null);
  boardFilterProjectId = signal<number | null>(null);
  boardListPage = signal(1);
  boardListPerPage = signal(6);

  availableProjectsForBoardFilter = computed(() => {
    const cId = this.boardFilterClientId();
    if (!cId) return [];
    return this.allProjects().filter(p => p.clientId === cId);
  });
  
  // Process Boards with extra metadata (client name, project name, task count, COLOR)
  boardsList = computed(() => {
    const boards = this.allBoards();
    const projects = this.allProjects();
    const clients = this.clients();
    const tasks = this.allTasks();

    return boards.map(board => {
        const project = projects.find(p => p.id === board.projectId);
        const client = clients.find(c => c.id === project?.clientId);
        const taskCount = tasks.filter(t => t.boardId === board.id).length;
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
      
      // Filter by Client
      if (this.boardFilterClientId()) {
          list = list.filter(b => b.clientId === this.boardFilterClientId());
      }

      // Filter by Project
      if (this.boardFilterProjectId()) {
          list = list.filter(b => b.projectId === this.boardFilterProjectId());
      }

      return list;
  });

  // Paginated Board List
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

  // Board Navigation
  viewBoard(boardId: string) {
      const board = this.allBoards().find(b => b.id === boardId);
      if (board) {
          const project = this.allProjects().find(p => p.id === board.projectId);
          if (project) {
              this.selectedClientId.set(project.clientId);
              this.selectedProjectId.set(project.id);
          }
          this.selectedBoardId.set(boardId);
          this.boardPage.set(1);
      }
  }

  backToBoards() {
      this.selectedBoardId.set(null);
      this.selectedProjectId.set(null);
      this.selectedClientId.set(null);
  }

  // Board CRUD State
  isBoardModalOpen = signal(false);
  isBoardEditMode = signal(false);
  editingBoardId = signal<string | null>(null);
  boardModalClientId = signal<number | null>(null);
  boardModalProjectId = signal<number | null>(null);
  boardModalName = signal('');

  // Computed for Board Modal
  boardModalProjects = computed(() => {
      const cId = this.boardModalClientId();
      if (cId) return this.allProjects().filter(p => p.clientId === cId);
      return [];
  });

  openBoardModal(board?: Board) {
      this.isBoardEditMode.set(!!board);
      
      if (board) {
          // Edit Mode
          this.editingBoardId.set(board.id);
          const project = this.allProjects().find(p => p.id === board.projectId);
          if (project) {
              this.boardModalClientId.set(project.clientId);
          }
          this.boardModalProjectId.set(board.projectId);
          this.boardModalName.set(board.name);
      } else {
          // Create Mode
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

  // --- Task View (Kanban/List) ---
  
  workViewMode = signal<'kanban' | 'list'>('kanban');

  // Filtered tasks for the *selected board*
  filteredBoardTasks = computed(() => {
    let tasks = this.allTasks();
    const boardId = this.selectedBoardId();

    if (boardId) {
        tasks = tasks.filter(t => t.boardId === boardId);
    } else {
        // Should not happen in detail view, but fallback
        return [];
    }

    // Sort by updatedAt descending (Newest first)
    return [...tasks].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  });
  
  currentBoardName = computed(() => {
      return this.allBoards().find(b => b.id === this.selectedBoardId())?.name || 'Board';
  });

  // Pagination (List View)
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

  // Columns for Kanban
  tasksToDo = computed(() => this.filteredBoardTasks().filter((t) => t.status === 'To Do'));
  tasksInProgress = computed(() => this.filteredBoardTasks().filter((t) => t.status === 'In Progress'));
  tasksOnHold = computed(() => this.filteredBoardTasks().filter((t) => t.status === 'On Hold'));
  tasksCompleted = computed(() => this.filteredBoardTasks().filter((t) => t.status === 'Completed'));

  // --- Task Actions State ---
  isModalOpen = signal(false);
  isEditMode = signal(false);
  editingTaskId = signal<string | null>(null);
  
  // Task Form State
  taskTitle = signal('');
  taskClientId = signal<number | null>(null);
  taskProjectId = signal<number | null>(null);
  taskBoardId = signal<string | null>(null);
  taskAssignedMemberId = signal<number | null>(null);
  taskStatus = signal<Task['status']>('To Do');
  taskPriority = signal<Task['priority']>('Medium');
  
  // Comments State
  currentTaskComments = signal<TaskComment[]>([]);
  newCommentText = signal('');

  // Computed for Add Task Modal Dropdowns
  taskModalProjects = computed(() => {
      const cId = this.taskClientId();
      if (cId) return this.allProjects().filter(p => p.clientId === cId);
      return [];
  });

  taskModalBoards = computed(() => {
      const pId = this.taskProjectId();
      if (pId) return this.allBoards().filter(b => b.projectId === pId);
      return [];
  });

  // --- Task CRUD ---
  openAddTaskModal(): void {
    this.resetForm();
    this.isEditMode.set(false);
    this.currentTaskComments.set([]);
    
    // Pre-fill based on current board context
    if (this.selectedClientId()) {
        this.taskClientId.set(this.selectedClientId());
    }
    if (this.selectedProjectId()) {
        this.taskProjectId.set(this.selectedProjectId());
    }
    if (this.selectedBoardId()) {
        this.taskBoardId.set(this.selectedBoardId());
    }
    
    this.isModalOpen.set(true);
  }

  openEditTaskModal(task: Task): void {
    this.resetForm();
    this.isEditMode.set(true);
    this.editingTaskId.set(task.id);

    // Populate form with task details
    this.taskTitle.set(task.title);
    this.taskStatus.set(task.status);
    this.taskPriority.set(task.priority);
    this.taskAssignedMemberId.set(task.assignedMemberId);
    this.currentTaskComments.set(task.comments || []);
    
    // Resolve hierarchy for dropdowns
    const project = this.getProjectById(task.projectId);
    if (project) {
        this.taskClientId.set(project.clientId);
        this.taskProjectId.set(task.projectId);
        this.taskBoardId.set(task.boardId);
    }

    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.resetForm();
  }

  private resetForm(): void {
    this.isEditMode.set(false);
    this.editingTaskId.set(null);
    this.taskTitle.set('');
    this.taskClientId.set(null);
    this.taskProjectId.set(null);
    this.taskBoardId.set(null);
    this.taskAssignedMemberId.set(null);
    this.taskStatus.set('To Do');
    this.taskPriority.set('Medium');
    this.newCommentText.set('');
    this.currentTaskComments.set([]);
  }

  saveTask(): void {
    if (!this.taskTitle() || this.taskAssignedMemberId() === null || this.taskProjectId() === null || this.taskBoardId() === null) {
      return;
    }

    const taskData = {
      projectId: this.taskProjectId()!,
      boardId: this.taskBoardId()!,
      title: this.taskTitle(),
      assignedMemberId: this.taskAssignedMemberId()!,
      status: this.taskStatus(),
      priority: this.taskPriority(),
      isBilled: false,
    };

    if (this.isEditMode() && this.editingTaskId()) {
        // Update existing task
        const existingTask = this.allTasks().find(t => t.id === this.editingTaskId());
        this.dataService.updateTask({
            ...taskData,
            id: this.editingTaskId()!,
            updatedAt: new Date(),
            isBilled: existingTask?.isBilled ?? false,
            comments: existingTask?.comments ?? [],
            createdAt: existingTask?.createdAt ?? new Date()
        });
    } else {
        // Create new task
        this.dataService.addTask(taskData);
    }
    
    this.closeModal();
  }

  deleteTask(taskId: string): void {
    if (confirm('Are you sure you want to delete this task? This cannot be undone.')) {
      this.dataService.deleteTask(taskId);
      if (this.isModalOpen() && this.editingTaskId() === taskId) {
          this.closeModal();
      }
    }
  }

  updateTaskStatus(task: Task, newStatus: Task['status']): void {
    if (task.status === newStatus) return;
    const updatedTask = { ...task, status: newStatus };
    this.dataService.updateTask(updatedTask);
  }

  addComment(): void {
    const taskId = this.editingTaskId();
    const text = this.newCommentText().trim();
    
    if (!taskId || !text) return;
    
    // Assuming current user is a team member or we map it. 
    const user = this.currentUser();
    const authorId = user ? user.id : 0; 

    this.dataService.addTaskComment(taskId, {
        authorId,
        text,
    });

    // Update local view immediately
    const updatedTask = this.allTasks().find(t => t.id === taskId);
    if (updatedTask) {
        this.currentTaskComments.set(updatedTask.comments);
    }
    
    this.newCommentText.set('');
  }

  // --- Drag and Drop ---
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
  
  // ==========================================
  // TAB 2: HISTORY (Global)
  // ==========================================
  
  historyFilterClientId = signal<number | null>(null);
  historyFilterProjectId = signal<number | null>(null);
  historyFilterStatus = signal<string>('All');
  
  historyPage = signal(1);
  historyPerPage = signal(10);

  projectsForHistoryFilter = computed(() => {
    const clientId = this.historyFilterClientId();
    if (!clientId) return [];
    return this.allProjects().filter(p => p.clientId === clientId);
  });

  filteredHistoryTasks = computed(() => {
    let tasks = this.allTasks();
    const clientId = this.historyFilterClientId();
    const projectId = this.historyFilterProjectId();
    const status = this.historyFilterStatus();

    if (clientId) {
        const clientProjectIds = this.allProjects().filter(p => p.clientId === clientId).map(p => p.id);
        tasks = tasks.filter(t => clientProjectIds.includes(t.projectId));
    }
    if (projectId) {
        tasks = tasks.filter(t => t.projectId === projectId);
    }
    if (status !== 'All') {
        tasks = tasks.filter(t => t.status === status);
    }
    // Consistent sorting: Newest modified first
    return [...tasks].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  });

  paginatedHistoryTasks = computed(() => {
    const tasks = this.filteredHistoryTasks();
    const startIndex = (this.historyPage() - 1) * this.historyPerPage();
    return tasks.slice(startIndex, startIndex + this.historyPerPage());
  });

  onHistoryPageChange(page: number) {
    this.historyPage.set(page);
  }
  
  resetHistoryFilters() {
      this.historyFilterClientId.set(null);
      this.historyFilterProjectId.set(null);
      this.historyFilterStatus.set('All');
      this.historyPage.set(1);
  }

  // --- Shared Helpers ---
  getMemberById(id: number): TeamMember | undefined {
    return this.allMembers().find((m) => m.id === id);
  }

  getProjectById(id: number): Project | undefined {
      return this.allProjects().find(p => p.id === id);
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
}
