
import { Component, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { RouterOutlet, Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { UiService } from './services/ui.service';

@Component({
  selector: 'app-root',
  template: `
    <!-- Global Loading Overlay -->
    @if(uiService.isLoading()){
      <div class="fixed inset-0 z-[9999] bg-base-100/50 backdrop-blur-sm flex items-center justify-center">
        <span class="loading loading-infinity loading-lg text-primary scale-150"></span>
      </div>
    }
    <router-outlet></router-outlet>
  `,
  styles: [':host { display: block; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
})
export class AppComponent {
  private themeService = inject(ThemeService);
  public uiService = inject(UiService);
  private router = inject(Router);

  constructor() {
    // Theme Effect
    effect(() => {
      if (this.themeService.isDarkMode()) {
        document.documentElement.setAttribute('data-theme', 'dim');
      } else {
        document.documentElement.setAttribute('data-theme', 'pastel');
      }
    });

    // Router Events for Loading Simulation
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.uiService.showLoading();
      } else if (
        event instanceof NavigationEnd || 
        event instanceof NavigationCancel || 
        event instanceof NavigationError
      ) {
        // Small delay to prevent flickering on fast transitions
        setTimeout(() => {
          this.uiService.hideLoading();
        }, 500);
      }
    });
  }
}
