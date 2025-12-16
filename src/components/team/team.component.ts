
import { Component, ChangeDetectionStrategy, inject, signal, Signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MockDataService, TeamMember, Project, Task } from '../../services/mock-data.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-team',
  templateUrl: './team.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PaginationComponent, RouterLink, DecimalPipe],
})
export class TeamComponent {
  private dataService = inject(MockDataService);
  public translationService = inject(TranslationService);

  members = this.dataService.getTeamMembers();
  projects = this.dataService.getProjects();
  tasks = this.dataService.getAllTasks();
  
  // Filters
  searchTerm = signal('');
  filterStatus = signal<'All' | 'Active' | 'Inactive'>('All');
  sortBy = signal<'Name' | 'Earnings' | 'Hours'>('Name');
  minEarnings = signal<number | null>(null);

  // Pagination (Increased density allows for more items)
  currentPage = signal(1);
  itemsPerPage = signal(12); 

  filteredMembers = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const status = this.filterStatus();
    const sort = this.sortBy();
    const minEarn = this.minEarnings();
    const projects = this.projects();

    // Helper to calculate total earnings
    const getTotalEarnings = (memberId: number): number => {
        let earnings = 0;
        projects.forEach(p => {
            Object.entries(p.hours).forEach(([weekId, days]) => {
                Object.values(days).forEach((entry: any) => {
                    if (entry.memberId === memberId) {
                        const rate = p.memberRates[memberId] ?? p.defaultRate ?? 0;
                        earnings += entry.hours * rate;
                    }
                });
            });
        });
        return earnings;
    };

    // 1. Filter
    let result = this.members().filter(m => {
        const matchesSearch = 
            m.name.toLowerCase().includes(term) ||
            m.email.toLowerCase().includes(term) ||
            m.role.toLowerCase().includes(term);
        
        const matchesStatus = status === 'All' || m.status === status || (status === 'Inactive' && m.status === 'Invited');
        
        let matchesEarnings = true;
        if (minEarn !== null) {
            matchesEarnings = getTotalEarnings(m.id) >= minEarn;
        }

        return matchesSearch && matchesStatus && matchesEarnings;
    });

    // 2. Sort
    if (sort === 'Name') {
        result.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        // Calculation Helper for sorting
        const getMetrics = (memberId: number) => {
            let totalHours = 0;
            let totalEarnings = 0;
            projects.forEach(p => {
                Object.entries(p.hours).forEach(([weekId, days]) => {
                    Object.values(days).forEach((entry: any) => {
                        if (entry.memberId === memberId) {
                            totalHours += entry.hours;
                            const rate = p.memberRates[memberId] ?? p.defaultRate ?? 0;
                            totalEarnings += entry.hours * rate;
                        }
                    });
                });
            });
            return { totalHours, totalEarnings };
        };

        result.sort((a, b) => {
            const statsA = getMetrics(a.id);
            const statsB = getMetrics(b.id);
            if (sort === 'Earnings') return statsB.totalEarnings - statsA.totalEarnings;
            if (sort === 'Hours') return statsB.totalHours - statsA.totalHours;
            return 0;
        });
    }

    return result;
  });

  paginatedMembers = computed(() => {
    const members = this.filteredMembers();
    const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return members.slice(startIndex, startIndex + this.itemsPerPage());
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  onFilterChange(): void {
    this.currentPage.set(1);
  }

  // --- Metrics Calculation ---
  getMemberStats(memberId: number) {
      const memberTasks = this.tasks().filter(t => t.assignedMemberId === memberId && t.status !== 'Completed');
      const activeProjects = this.projects().filter(p => p.allocatedTeamMemberIds.includes(memberId) && p.status === 'Active');
      
      // Calculate hours for current month
      let hoursThisMonth = 0;
      
      this.projects().forEach(project => {
          Object.entries(project.hours).forEach(([weekId, days]) => {
              Object.values(days).forEach((entry: any) => {
                  if (entry.memberId === memberId) {
                      hoursThisMonth += entry.hours;
                  }
              });
          });
      });

      return {
          activeTasks: memberTasks.length,
          projectCount: activeProjects.length,
          hoursLogged: hoursThisMonth
      };
  }

  // --- Modal State ---
  isModalOpen = signal(false);
  showSuccessToast = signal(false);
  toastMessage = signal('');
  
  memberName = signal('');
  memberEmail = signal('');
  memberRole = signal('');
  memberAvatarUrl = signal('');
  memberDefaultRate = signal(0);

  // --- Email Modal State ---
  isEmailModalOpen = signal(false);
  selectedMemberForEmail = signal<TeamMember | null>(null);
  emailSubject = signal('');
  emailBody = signal('');

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

  addMember(): void {
    if (!this.memberName() || !this.memberEmail() || !this.memberRole() || this.memberDefaultRate() <= 0) {
      return;
    }
    
    this.dataService.addTeamMember({
      name: this.memberName(),
      email: this.memberEmail(),
      role: this.memberRole(),
      avatarUrl: this.memberAvatarUrl(),
      defaultHourlyRate: this.memberDefaultRate(),
      status: 'Active' 
    });

    this.showToast(`Member ${this.memberName()} added successfully!`);
    this.closeModal();
  }

  deleteMember(id: number): void {
    if (confirm('Are you sure you want to delete this team member?')) {
      this.dataService.deleteTeamMember(id);
      this.showToast('Team member deleted.');
    }
  }

  toggleStatus(member: TeamMember): void {
    const newStatus = member.status === 'Active' ? 'Inactive' : 'Active';
    if (member.status === 'Invited') {
        this.dataService.updateTeamMember({ ...member, status: 'Inactive' });
    } else {
        this.dataService.updateTeamMember({ ...member, status: newStatus });
    }
    this.showToast(`Member status updated.`);
  }

  // --- Email Logic ---

  openEmailModal(member: TeamMember): void {
    this.selectedMemberForEmail.set(member);
    this.emailSubject.set('');
    this.emailBody.set('');
    this.isEmailModalOpen.set(true);
  }

  closeEmailModal(): void {
    this.isEmailModalOpen.set(false);
    this.selectedMemberForEmail.set(null);
  }

  sendEmail(): void {
    const member = this.selectedMemberForEmail();
    if (!member || !this.emailSubject() || !this.emailBody()) return;

    // Simulation of sending email
    console.log(`Sending email to ${member.email}`, {
      subject: this.emailSubject(),
      body: this.emailBody()
    });

    this.closeEmailModal();
    this.showToast('Email sent successfully!');
  }

  private showToast(message: string) {
    this.toastMessage.set(message);
    this.showSuccessToast.set(true);
    setTimeout(() => this.showSuccessToast.set(false), 3000);
  }
}
