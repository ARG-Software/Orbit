import { Component, ChangeDetectionStrategy, inject, signal, Signal, computed } from '@angular/core';
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

  members = this.dataService.getTeamMembers();
  
  // Pagination (Set to 8 to match Client 2 rows logic, assuming 4 cols)
  currentPage = signal(1);
  itemsPerPage = signal(8); 

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
  showSuccessToast = signal(false);
  toastMessage = signal('');
  
  memberName = signal('');
  memberEmail = signal('');
  memberRole = signal('');
  memberAvatarUrl = signal('');
  memberDefaultRate = signal(0);

  private resetForm(): void {
    this.memberName.set('');
    this.memberEmail.set('');
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

  onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          this.memberAvatarUrl.set(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  inviteMember(): void {
    if (!this.memberName() || !this.memberEmail() || !this.memberRole() || this.memberDefaultRate() <= 0) {
      return;
    }
    
    this.dataService.addTeamMember({
      name: this.memberName(),
      email: this.memberEmail(),
      role: this.memberRole(),
      avatarUrl: this.memberAvatarUrl(),
      defaultHourlyRate: this.memberDefaultRate(),
      status: 'Invited' // Default status
    });

    this.showToast(`Invitation sent to ${this.memberEmail()}!`);
    this.closeModal();
  }
  
  resendInvite(member: TeamMember): void {
    this.showToast(`Invitation link resent to ${member.email}`);
  }

  deleteMember(id: number): void {
    if (confirm('Are you sure you want to delete this team member?')) {
      this.dataService.deleteTeamMember(id);
      this.showToast('Team member deleted.');
    }
  }

  toggleStatus(member: TeamMember): void {
    const newStatus = member.status === 'Active' ? 'Inactive' : 'Active';
    
    // If they were invited, toggling usually sets to Inactive or Active based on admin override
    if (member.status === 'Invited') {
        this.dataService.updateTeamMember({ ...member, status: 'Inactive' });
    } else {
        this.dataService.updateTeamMember({ ...member, status: newStatus });
    }
    this.showToast(`Member status updated.`);
  }

  private showToast(message: string) {
    this.toastMessage.set(message);
    this.showSuccessToast.set(true);
    setTimeout(() => this.showSuccessToast.set(false), 3000);
  }
}