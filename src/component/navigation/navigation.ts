import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, ViewEncapsulation } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterLink, RouterOutlet } from "@angular/router";
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { ApplicationMenu, ApplicationMenuItem } from "../../model/common";
import { BaseAuthService } from "../../service/auth.service";
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from "../../config";

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    RouterOutlet,
    RouterLink,
    MatExpansionModule,
  ],
})
export class Navigation implements OnInit {
  private readonly authService = inject(BaseAuthService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;

  private readonly allMenuItems = signal<ApplicationMenu[]>([]);

  readonly menuItems = computed(() => {
    const menus = this.allMenuItems();
    return menus
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

  ngOnInit() {
    this.authService.loadStoredSession();
    this.authService.getMenus().subscribe((menuItems: ApplicationMenu[]) => { this.allMenuItems.set(menuItems); });
  }

  logout() {
    this.authService.logout();
  }

  getRouterLink(item: ApplicationMenuItem): string {
    return '/' + (item.MenuId ?? '').toLowerCase() + '/' + (item.ItemId ?? '');
  }
}
