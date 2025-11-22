
import { Component, ChangeDetectionStrategy, inject, signal, computed, Signal, effect } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { AuthService, JobPreferences } from '../../services/auth.service';
import { MockDataService, Job } from '../../services/mock-data.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { switchMap } from 'rxjs';
import { of } from 'rxjs';

@Component({
    selector: 'app-job-search',
    templateUrl: './job-search.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DecimalPipe, DatePipe, FormsModule, PaginationComponent],
})
export class JobSearchComponent {
    private authService = inject(AuthService);
    private dataService = inject(MockDataService);

    // --- Preferences State ---
    userPreferences = computed(() => this.authService.currentUser()?.jobPreferences);
    hasPreferences = computed(() => !!this.userPreferences());

    // --- Preferences Form Signals ---
    prefLocation = signal('');
    prefWorkModel = signal<JobPreferences['workModel']>('any');
    prefInterests = signal('');
    prefExpectedSalary = signal(80000);

    // --- Notification State ---
    showSuccessToast = signal(false);

    // --- Job Board State ---
    private allJobs: Signal<Job[]> = toSignal(
        toObservable(this.userPreferences).pipe(
            switchMap(prefs => {
                if (!prefs) {
                    return of([]);
                }
                return this.dataService.getJobs(prefs);
            })
        ), 
        { initialValue: [] }
    );
    searchTerm = signal('');
    selectedJob = signal<Job | null>(null);

    constructor() {
        effect(() => {
            const prefs = this.userPreferences();
            if (prefs) {
                this.prefLocation.set(prefs.location);
                this.prefWorkModel.set(prefs.workModel);
                this.prefInterests.set(prefs.interests.join(', '));
                this.prefExpectedSalary.set(prefs.expectedSalary);
            }
        }, { allowSignalWrites: true });
    }

    savePreferences(): void {
        const preferences: JobPreferences = {
            location: this.prefLocation(),
            workModel: this.prefWorkModel(),
            interests: this.prefInterests().split(',').map(i => i.trim()).filter(Boolean),
            expectedSalary: this.prefExpectedSalary(),
        };
        this.authService.updateJobPreferences(preferences);
        this.triggerSuccessToast();
    }

    editPreferences(): void {
         this.authService.updateJobPreferences(undefined!);
    }
    
    private triggerSuccessToast() {
        this.showSuccessToast.set(true);
        setTimeout(() => this.showSuccessToast.set(false), 3000);
    }
    
    // --- Job Filtering & Pagination ---
    filteredJobs = computed(() => {
        const term = this.searchTerm().toLowerCase();
        const jobs = this.allJobs();
        if (!term) return jobs;

        return jobs.filter(job =>
            job.title.toLowerCase().includes(term) ||
            job.company.toLowerCase().includes(term) ||
            job.tags.some(tag => tag.toLowerCase().includes(term))
        );
    });

    currentPage = signal(1);
    itemsPerPage = signal(6);

    paginatedJobs = computed(() => {
        const jobs = this.filteredJobs();
        const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
        return jobs.slice(startIndex, startIndex + this.itemsPerPage());
    });
    
    onPageChange(page: number): void {
        this.currentPage.set(page);
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
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }
}
