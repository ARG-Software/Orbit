
import { Component, ChangeDetectionStrategy, inject, signal, computed, Signal } from '@angular/core';
import { DecimalPipe, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { MockDataService, Job } from '../../services/mock-data.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { switchMap, map } from 'rxjs';
import { of } from 'rxjs';

export interface SavedFilter {
    name: string;
    keywords: string;
    location: string;
    workModel: 'any' | 'Remote' | 'Hybrid' | 'On-site';
    interest: string;
    salaryMin: number;
}

@Component({
    selector: 'app-job-search',
    templateUrl: './job-search.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DecimalPipe, DatePipe, FormsModule, PaginationComponent, CurrencyPipe],
})
export class JobSearchComponent {
    private dataService = inject(MockDataService);

    // --- State ---
    activeTab = signal<'search' | 'saved'>('search');
    
    // Filters
    filterKeywords = signal('');
    filterLocation = signal('');
    filterWorkModel = signal<'any' | 'Remote' | 'Hybrid' | 'On-site'>('any');
    filterInterest = signal('');
    filterSalaryMin = signal(50000);

    // Saved Filters List
    savedFilters = signal<SavedFilter[]>([]);
    selectedFilterName = signal<string | null>(null);

    // Bookmarks (Mocked in-memory for session)
    bookmarkedJobIds = signal<Set<string>>(new Set());

    // --- Notification State ---
    showSuccessToast = signal(false);
    toastMessage = signal('');

    // --- Modal States ---
    isFilterNameModalOpen = signal(false);
    newFilterName = signal('');

    // --- Job Data ---
    // We mock passing preferences as a catch-all to get all jobs, then filter locally
    private allJobs: Signal<Job[]> = toSignal(
        this.dataService.getJobs({ location: '', workModel: 'any', interests: [], expectedSalary: 0 }),
        { initialValue: [] }
    );

    selectedJob = signal<Job | null>(null);

    // --- Computed Lists ---
    
    filteredJobs = computed(() => {
        const keywords = this.filterKeywords().toLowerCase();
        const location = this.filterLocation().toLowerCase();
        const workModel = this.filterWorkModel();
        const interest = this.filterInterest().toLowerCase();
        const salary = this.filterSalaryMin();

        return this.allJobs().filter(job => {
            const matchesKeywords = !keywords || 
                job.title.toLowerCase().includes(keywords) || 
                job.company.toLowerCase().includes(keywords) ||
                job.tags.some(t => t.toLowerCase().includes(keywords));
            
            const matchesLocation = !location || job.location.toLowerCase().includes(location);
            const matchesModel = workModel === 'any' || job.workModel === workModel;
            const matchesInterest = !interest || job.title.toLowerCase().includes(interest) || job.tags.some(t => t.toLowerCase().includes(interest));
            const matchesSalary = job.salary.max >= salary;

            return matchesKeywords && matchesLocation && matchesModel && matchesInterest && matchesSalary;
        });
    });

    savedJobs = computed(() => {
        const savedIds = this.bookmarkedJobIds();
        return this.allJobs().filter(job => savedIds.has(job.id));
    });

    // --- Pagination ---
    searchPage = signal(1);
    searchPerPage = signal(6);
    
    savedPage = signal(1);
    savedPerPage = signal(6);

    paginatedSearchJobs = computed(() => {
        const jobs = this.filteredJobs();
        const startIndex = (this.searchPage() - 1) * this.searchPerPage();
        return jobs.slice(startIndex, startIndex + this.searchPerPage());
    });

    paginatedSavedJobs = computed(() => {
        const jobs = this.savedJobs();
        const startIndex = (this.savedPage() - 1) * this.savedPerPage();
        return jobs.slice(startIndex, startIndex + this.savedPerPage());
    });
    
    onSearchPageChange(page: number): void {
        this.searchPage.set(page);
    }

    onSavedPageChange(page: number): void {
        this.savedPage.set(page);
    }
    
    // --- Actions ---

    openSaveFilterModal(): void {
        this.newFilterName.set('');
        this.isFilterNameModalOpen.set(true);
    }

    closeSaveFilterModal(): void {
        this.isFilterNameModalOpen.set(false);
    }

    confirmSaveFilter(): void {
        const name = this.newFilterName().trim();
        if (!name) return;

        const newFilter: SavedFilter = {
            name: name,
            keywords: this.filterKeywords(),
            location: this.filterLocation(),
            workModel: this.filterWorkModel(),
            interest: this.filterInterest(),
            salaryMin: this.filterSalaryMin()
        };

        this.savedFilters.update(filters => [...filters, newFilter]);
        this.selectedFilterName.set(name);
        this.triggerToast(`Filter "${name}" saved.`);
        this.closeSaveFilterModal();
    }

    // Called from the dropdown change event
    applySavedFilter(filterName: string): void {
        this.selectedFilterName.set(filterName);
        const filter = this.savedFilters().find(f => f.name === filterName);
        if (filter) {
            this.filterKeywords.set(filter.keywords);
            this.filterLocation.set(filter.location);
            this.filterWorkModel.set(filter.workModel);
            this.filterInterest.set(filter.interest);
            this.filterSalaryMin.set(filter.salaryMin);
            this.searchPage.set(1);
            this.triggerToast(`Filter "${filter.name}" applied.`);
        }
    }

    deleteCurrentFilter(): void {
        const name = this.selectedFilterName();
        if (!name) return;

        if (confirm(`Are you sure you want to delete the filter "${name}"?`)) {
            this.savedFilters.update(filters => filters.filter(f => f.name !== name));
            this.selectedFilterName.set(null);
            this.triggerToast('Filter deleted.');
        }
    }

    resetFilters(): void {
        this.filterKeywords.set('');
        this.filterLocation.set('');
        this.filterInterest.set('');
        this.filterWorkModel.set('any');
        this.filterSalaryMin.set(50000);
        this.selectedFilterName.set(null);
        this.searchPage.set(1);
    }

    toggleBookmark(jobId: string): void {
        this.bookmarkedJobIds.update(ids => {
            const newIds = new Set(ids);
            if (newIds.has(jobId)) {
                newIds.delete(jobId);
                this.triggerToast('Job removed from bookmarks.');
            } else {
                newIds.add(jobId);
                this.triggerToast('Job saved to bookmarks.');
            }
            return newIds;
        });
    }

    isBookmarked(jobId: string): boolean {
        return this.bookmarkedJobIds().has(jobId);
    }
    
    private triggerToast(msg: string) {
        this.toastMessage.set(msg);
        this.showSuccessToast.set(true);
        setTimeout(() => this.showSuccessToast.set(false), 3000);
    }
    
    // --- Modal Logic ---
    viewJobDetails(job: Job): void {
        this.selectedJob.set(job);
    }

    closeJobDetails(): void {
        this.selectedJob.set(null);
    }
    
    timeSince(date: Date): string {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m";
        return Math.floor(seconds) + "s";
    }
}
