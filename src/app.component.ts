import { Component, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  template: `<router-outlet></router-outlet>`,
  styles: [':host { display: block; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
})
export class AppComponent {
  private themeService = inject(ThemeService);

  constructor() {
    effect(() => {
      if (this.themeService.isDarkMode()) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    });
  }
}