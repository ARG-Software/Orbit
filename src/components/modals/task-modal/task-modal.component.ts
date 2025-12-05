
import { Component, ChangeDetectionStrategy, inject, signal, computed, input, output, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MockDataService, Task, TaskComment, TeamMember, Project, Board, Client } from '../../../services/mock-data.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-task-modal',
  templateUrl: './task-modal.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe]
})
export class TaskModalComponent {
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);

  // Inputs/Outputs
  taskToEdit = input<Task | null>(null);
  prefilledContext = input<{ clientId: number, projectId: number, boardId: string } | null>(null);
  close = output<void>();
  saved = output<void>();

  // Data
  clients = this.dataService.getClients();
  allProjects = this.dataService.getProjects();
  allBoards = this.dataService.getBoards();
  allMembers = this.dataService.getTeamMembers();
  currentUser = this.authService.currentUser;

  // Form State
  isEditMode = signal(false);
  editingTaskId = signal<string | null>(null);
  
  taskTitle = signal('');
  taskClientId = signal<number | null>(null);
  taskProjectId = signal<number | null>(null);
  taskBoardId = signal<string | null>(null);
  taskAssignedMemberId = signal<number | null>(null);
  taskStatus = signal<Task['status']>('To Do');
  taskPriority = signal<Task['priority']>('Medium');
  
  // Comments
  currentTaskComments = signal<TaskComment[]>([]);
  newCommentText = signal('');

  // Computed
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

  constructor() {
      effect(() => {
          const task = this.taskToEdit();
          const context = this.prefilledContext();

          if (task) {
              this.isEditMode.set(true);
              this.editingTaskId.set(task.id);
              this.taskTitle.set(task.title);
              this.taskStatus.set(task.status);
              this.taskPriority.set(task.priority);
              this.taskAssignedMemberId.set(task.assignedMemberId);
              this.currentTaskComments.set(task.comments || []);
              
              const project = this.allProjects().find(p => p.id === task.projectId);
              if (project) {
                  this.taskClientId.set(project.clientId);
                  this.taskProjectId.set(task.projectId);
                  this.taskBoardId.set(task.boardId);
              }
          } else {
              this.resetForm();
              // Apply context if creating new task from a specific board
              if (context) {
                  this.taskClientId.set(context.clientId);
                  this.taskProjectId.set(context.projectId);
                  this.taskBoardId.set(context.boardId);
              }
          }
      }, { allowSignalWrites: true });
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
    if (!this.taskTitle() || this.taskAssignedMemberId() === null || this.taskProjectId() === null) {
      return;
    }

    const taskData = {
      projectId: this.taskProjectId()!,
      boardId: this.taskBoardId(), 
      title: this.taskTitle(),
      assignedMemberId: this.taskAssignedMemberId()!,
      status: this.taskStatus(),
      priority: this.taskPriority(),
      isBilled: false,
    };

    if (this.isEditMode() && this.editingTaskId()) {
        const existingTask = this.dataService.getAllTasks()().find(t => t.id === this.editingTaskId());
        this.dataService.updateTask({
            ...taskData,
            id: this.editingTaskId()!,
            boardId: this.taskBoardId(),
            updatedAt: new Date(),
            isBilled: existingTask?.isBilled ?? false,
            comments: existingTask?.comments ?? [],
            createdAt: existingTask?.createdAt ?? new Date()
        });
    } else {
        this.dataService.addTask({
            ...taskData,
            boardId: this.taskBoardId()
        });
    }
    this.saved.emit();
    this.close.emit();
  }

  addComment(): void {
    const taskId = this.editingTaskId();
    const text = this.newCommentText().trim();
    if (!taskId || !text) return;
    const user = this.currentUser();
    const authorId = user ? user.id : 0; 
    this.dataService.addTaskComment(taskId, { authorId, text });
    const updatedTask = this.dataService.getAllTasks()().find(t => t.id === taskId);
    if (updatedTask) {
        this.currentTaskComments.set(updatedTask.comments);
    }
    this.newCommentText.set('');
  }

  archiveTask(): void {
      const id = this.editingTaskId();
      if(id) {
          const task = this.dataService.getAllTasks()().find(t => t.id === id);
          if (task) {
              this.dataService.updateTask({ ...task, status: 'Archived' });
              this.saved.emit();
              this.close.emit();
          }
      }
  }

  getMemberById(id: number) {
      return this.allMembers().find(m => m.id === id);
  }
}
