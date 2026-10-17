import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, viewChild, ViewEncapsulation } from "@angular/core";
import { NgOptimizedImage } from "@angular/common";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterLink, RouterOutlet } from "@angular/router";
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { filter, map, pairwise } from 'rxjs/operators';
import { ApplicationMenu, ApplicationMenuItem } from "../../model/common";
import { BaseAuthService } from "../../service/auth.service";
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from "../../config";

@Component({
  selector: 'sail-navigation',
  templateUrl: './navigation.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    NgOptimizedImage,
    RouterOutlet,
    RouterLink,
    MatExpansionModule,
  ],
})
export class Navigation {
  private readonly authService = inject(BaseAuthService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  private readonly sidenav = viewChild.required(MatSidenav);

  // Restore the stored JWT before the menu stream fires so `canAccess()` checks
  // resolve against the right user. Done at field-init time (runs in injection
  // context) rather than ngOnInit, so the toSignal below can read from it.
  private readonly _sessionLoaded = (this.authService.loadStoredSession(), true);

  private readonly allMenuItems = toSignal(this.authService.getMenus(), { initialValue: [] as ApplicationMenu[] });

  readonly menuItems = computed(() => {
    return this.allMenuItems()
      .map(menu => ({
        ...menu,
        ApplicationMenuItems: (menu.ApplicationMenuItems ?? [])
          .filter(item => item.ItemId && this.authService.canAccess(item.ItemId)),
      }))
      .filter(menu => menu.ApplicationMenuItems.length > 0);
  });

  readonly isHandset = toSignal(
    this.breakpointObserver.observe(Breakpoints.Handset).pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  readonly isLoggedIn = this.authService.isLoggedIn;
  protected readonly accountLink = this.guiConfig.accountLink;

  constructor() {
    // Focus the page after a path change; the initial load and query-only updates keep focus,
    // as does an open handset menu.
    inject(Router).events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0]),
      pairwise(),
      filter(([before, after]) => before !== after && !(this.isHandset() && this.sidenav().opened)),
      takeUntilDestroyed(),
    ).subscribe(() => this.main().nativeElement.focus());
  }

  focusMain(event: Event) {
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  logout() {
    this.authService.logout();
  }

  getRouterLink(item: ApplicationMenuItem): string {
    return '/' + (item.MenuId ?? '').toLowerCase() + '/' + (item.ItemId ?? '');
  }
}
