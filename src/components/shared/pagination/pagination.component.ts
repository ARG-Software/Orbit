import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-pagination',
  template: `
    @if (totalPages() > 1) {
      <div class="join">
        <button class="join-item btn" (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() === 1">«</button>
        <button class="join-item btn">Page {{ currentPage() }} of {{ totalPages() }}</button>
        <button class="join-item btn" (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() === totalPages()">»</button>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  currentPage = input.required<number>();
  totalItems = input.required<number>();
  itemsPerPage = input.required<number>();

  pageChange = output<number>();

  totalPages = computed(() => {
    return Math.ceil(this.totalItems() / this.itemsPerPage());
  });

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.pageChange.emit(page);
    }
  }
}
