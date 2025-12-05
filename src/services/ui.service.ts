
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiService {
  isLoading = signal<boolean>(false);

  showLoading() {
    this.isLoading.set(true);
  }

  hideLoading() {
    this.isLoading.set(false);
  }
}
