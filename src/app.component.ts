
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
        <span data-theme="pastel" class="loading loading-ring loading-lg text-secondary scale-150"></span>
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
  private router: Router = inject(Router);

  constructor() {
    // Theme Effect
    effect(() => {
      const isDark = this.themeService.isDarkMode();
      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dim');
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'cupcake');
        document.documentElement.classList.remove('dark');
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