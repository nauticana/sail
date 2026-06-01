import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, inject, signal, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BaseAsync } from '../abstract/base_async';
import { BaseAuthService } from '../../service/auth.service';
import { TrustedDevice } from '../../model/appdata';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'sail-trusted-devices',
  templateUrl: './trusted_devices.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    ReactiveFormsModule,
    RouterLink,
  ],
})
export class TrustedDevicesComponent extends BaseAsync implements OnInit {
  private readonly auth = inject(BaseAuthService);
  private readonly fb = inject(FormBuilder);

  readonly devices = signal<TrustedDevice[]>([]);
  /** When true, show the "single-device mode" banner (single-device session policy). */
  readonly singleDeviceSession = input(false);

  /** Inline form revealed when the user clicks "Sign out of all devices". */
  readonly logoutOpen = signal(false);
  readonly logoutForm = this.fb.group({
    password: ['', Validators.required],
  });

  ngOnInit() {
    this.loadDevices();
  }

  loadDevices() {
    this.run(
      this.auth.getTrustedDevices(),
      (devices) => this.devices.set(devices),
      'Failed to load devices.',
    );
  }

  revokeDevice(device: TrustedDevice) {
    if (!confirm(`Revoke trust for "${device.name}"?`)) return;
    this.run(
      this.auth.revokeTrustedDevice(device.id),
      () => {
        this.successMessage.set(`Device "${device.name}" revoked.`);
        this.loadDevices();
      },
      'Failed to revoke device.',
    );
  }

  /**
   * logout-everywhere requires a re-auth gate, so we reveal a password
   * field instead of relying on confirm() alone.
   */
  signOutEverywhere() {
    if (this.logoutForm.invalid) return;
    const password = this.logoutForm.value.password!;
    this.run(
      this.auth.logoutEverywhere({ password }),
      () => {
        this.successMessage.set('Signed out of all devices.');
        this.logoutForm.reset();
        this.logoutOpen.set(false);
        this.auth.logout();
      },
      'Failed to sign out of all devices.',
    );
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return dateStr.slice(0, 16).replace('T', ' ');
  }
}
