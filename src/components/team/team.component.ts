import { Component, ChangeDetectionStrategy, inject, signal, Signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MockDataService, TeamMember } from '../../services/mock-data.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-team',
  templateUrl: './team.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PaginationComponent, RouterLink],
})
export class TeamComponent {
  private dataService = inject(MockDataService);
  members: Signal<TeamMember[]> = toSignal(this.dataService.getTeamMembers(), { initialValue: [] });
  
  // Pagination
  currentPage = signal(1);
  itemsPerPage = signal(4);

  paginatedMembers = computed(() => {
    const members = this.members();
    const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return members.slice(startIndex, endIndex);
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  isModalOpen = signal(false);
  
  memberName = signal('');
  memberRole = signal('');
  memberAvatarUrl = signal('');
  memberDefaultRate = signal(0);

  private resetForm(): void {
    this.memberName.set('');
    this.memberRole.set('');
    this.memberAvatarUrl.set('');
    this.memberDefaultRate.set(0);
  }

  openModal(): void {
    this.resetForm();
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  addMember(): void {
    if (!this.memberName() || !this.memberRole() || this.memberDefaultRate() <= 0) {
      return;
    }
    this.dataService.addTeamMember({
      name: this.memberName(),
      role: this.memberRole(),
      avatarUrl: this.memberAvatarUrl(),
      defaultHourlyRate: this.memberDefaultRate(),
    });
    this.closeModal();
  }
}