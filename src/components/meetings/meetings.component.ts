
import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MockDataService, Meeting } from '../../services/mock-data.service';
import { AuthService } from '../../services/auth.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-meetings',
  templateUrl: './meetings.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DatePipe, PaginationComponent, RouterLink],
})
export class MeetingsComponent {
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);
  private route: ActivatedRoute = inject(ActivatedRoute);
  public translationService = inject(TranslationService);

  // Data
  meetings = this.dataService.getMeetings();
  clients = this.dataService.getClients();
  currentUser = this.authService.currentUser;

  // Tab State
  activeTab = signal<'upcoming' | 'history'>('upcoming');

  // History Filters
  filterHistoryDate = signal<string>('');
  filterHistoryPlatform = signal<'All' | 'Google Meet' | 'Zoom' | 'Phone' | 'In-Person'>('All');
  filterHistoryClientId = signal<number | null>(null);

  // Modal State
  isModalOpen = signal(false);
  
  // Expanded Notes State
  expandedNotes = signal<Set<string>>(new Set());
  
  // Form State
  meetTitle = signal('');
  attendeeType = signal<'client' | 'guest'>('client');
  meetClientId = signal<number | null>(null);
  meetGuestName = signal('');
  meetGuestEmail = signal('');
  meetDate = signal<string>(''); // YYYY-MM-DDTHH:mm
  meetPlatform = signal<'Google Meet' | 'Zoom' | 'Phone' | 'In-Person'>('Google Meet');
  meetDescription = signal('');

  constructor() {
    // Deep link support for tabs
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        const tab = params['tab'];
        if (['upcoming', 'history'].includes(tab)) {
          this.activeTab.set(tab as 'upcoming' | 'history');
        }
      }
    });
  }

  // Computations
  
  // Upcoming: Only future meetings, simple platform filter removed in favor of clean view
  upcomingMeetings = computed(() => {
      const now = new Date();
      // Sort: Sooner first
      return this.meetings()
        .filter(m => m.endTime > now)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  });
  
  // Pagination for Upcoming
  upcomingPage = signal(1);
  upcomingPerPage = signal(10);
  paginatedUpcoming = computed(() => {
      const upcoming = this.upcomingMeetings();
      const start = (this.upcomingPage() - 1) * this.upcomingPerPage();
      return upcoming.slice(start, start + this.upcomingPerPage());
  });
  
  // History: Past meetings with comprehensive filters
  historyMeetings = computed(() => {
      const now = new Date();
      let filtered = this.meetings().filter(m => m.endTime <= now);
      
      const dateFilter = this.filterHistoryDate();
      const platformFilter = this.filterHistoryPlatform();
      const clientFilter = this.filterHistoryClientId();

      if (dateFilter) {
          const filterDay = new Date(dateFilter).toDateString();
          filtered = filtered.filter(m => new Date(m.startTime).toDateString() === filterDay);
      }

      if (platformFilter !== 'All') {
          filtered = filtered.filter(m => m.platform === platformFilter);
      }

      if (clientFilter) {
          filtered = filtered.filter(m => m.clientId === clientFilter);
      }

      // Sort: Most recent past first
      return filtered.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  });

  // Pagination for History
  historyPage = signal(1);
  historyPerPage = signal(10);
  paginatedHistory = computed(() => {
      const past = this.historyMeetings();
      const start = (this.historyPage() - 1) * this.historyPerPage();
      return past.slice(start, start + this.historyPerPage());
  });

  // Actions
  openScheduleModal() {
      // Set default time to next hour
      const now = new Date();
      now.setHours(now.getHours() + 1, 0, 0, 0);
      const iso = now.toISOString().slice(0, 16); // For datetime-local input

      this.meetTitle.set('New Meeting');
      this.attendeeType.set('client');
      this.meetClientId.set(null);
      this.meetGuestName.set('');
      this.meetGuestEmail.set('');
      this.meetDate.set(iso);
      this.meetPlatform.set('Google Meet');
      this.meetDescription.set('');
      this.isModalOpen.set(true);
  }

  closeModal() {
      this.isModalOpen.set(false);
  }

  saveMeeting() {
      const dateStr = this.meetDate();
      const title = this.meetTitle();
      const isClient = this.attendeeType() === 'client';
      
      if (!dateStr || !title) return;
      
      // Validation
      if (isClient && !this.meetClientId()) return;
      if (!isClient && (!this.meetGuestName() || !this.meetGuestEmail())) return;

      let clientName = '';
      let clientId = null;
      let guestEmail = '';
      
      if (isClient) {
        const client = this.clients().find(c => c.id === this.meetClientId());
        clientName = client?.name || 'Unknown';
        clientId = client?.id || null;
        guestEmail = client?.contact || '';
      } else {
        clientName = this.meetGuestName();
        guestEmail = this.meetGuestEmail();
      }

      const startDate = new Date(dateStr);
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1); // Default 1 hour duration

      // MOCK LINK GENERATION
      let link = '';
      const platform = this.meetPlatform();
      
      if (platform === 'Google Meet') {
          const user = this.currentUser();
          if (user && !user.googleMeetConnected) {
              if (!confirm("You haven't connected Google Meet in Settings. Proceed with a mock link?")) return;
          }
          link = `https://meet.google.com/${this.generateRandomString(3)}-${this.generateRandomString(4)}-${this.generateRandomString(3)}`;
      } else if (platform === 'Zoom') {
           const user = this.currentUser();
           if (user && !user.zoomConnected) {
              if (!confirm("You haven't connected Zoom in Settings. Proceed with a mock link?")) return;
           }
          link = `https://zoom.us/j/${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      }

      this.dataService.addMeeting({
          title: title,
          clientId: clientId,
          clientName: clientName,
          guestEmail: guestEmail,
          startTime: startDate,
          endTime: endDate,
          platform: platform,
          description: this.meetDescription(),
          link: link
      });
      
      this.closeModal();
  }

  deleteMeeting(id: string) {
      if(confirm('Cancel this meeting?')) {
          this.dataService.deleteMeeting(id);
      }
  }

  toggleNote(id: string) {
      this.expandedNotes.update(notes => {
          const newSet = new Set(notes);
          if (newSet.has(id)) {
              newSet.delete(id);
          } else {
              newSet.add(id);
          }
          return newSet;
      });
  }

  isNoteExpanded(id: string): boolean {
      return this.expandedNotes().has(id);
  }

  // Helpers
  onUpcomingPageChange(page: number) {
      this.upcomingPage.set(page);
  }

  onHistoryPageChange(page: number) {
      this.historyPage.set(page);
  }
  
  resetHistoryFilters() {
      this.filterHistoryDate.set('');
      this.filterHistoryPlatform.set('All');
      this.filterHistoryClientId.set(null);
      this.historyPage.set(1);
  }

  private generateRandomString(length: number): string {
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      let result = '';
      for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
  }
}
