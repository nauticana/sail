import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BaseAuthService } from '../../service/auth.service';
import { UserProfile } from '../../model/auth';

// Self-service profile editor: name/locale save immediately; email change is
// verify-before-apply (code to the new address). Phone change is gated until
// the backend has an SMS provider.
@Component({
  selector: 'sail-profile-editor',
  templateUrl: './profile_editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
})
export class ProfileEditorComponent implements OnInit {
  private readonly auth = inject(BaseAuthService);
  private readonly fb = inject(FormBuilder);

  // Flip true once the backend wires an SMS provider for phone codes.
  readonly phoneChangeEnabled = false;

  readonly loading = signal(false);
  readonly profileMsg = signal('');
  readonly profileErr = signal('');
  readonly email = signal('');
  readonly phone = signal('');

  readonly profileForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: [''],
    locale: [''],
  });

  readonly emailPhase = signal<'idle' | 'enter' | 'code'>('idle');
  readonly emailMsg = signal('');
  readonly emailErr = signal('');
  readonly newEmail = new FormControl('', [Validators.required, Validators.email]);
  readonly emailCode = new FormControl('', [Validators.required]);

  ngOnInit(): void {
    this.auth.getProfile().subscribe({
      next: (p: UserProfile) => {
        this.profileForm.patchValue({ firstName: p.firstName, lastName: p.lastName, locale: p.language });
        this.email.set(p.email ?? '');
        this.phone.set(p.phoneNumber ?? '');
      },
      error: () => this.profileErr.set('Could not load your profile.'),
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) return;
    const v = this.profileForm.getRawValue();
    this.loading.set(true);
    this.profileMsg.set('');
    this.profileErr.set('');
    this.auth.updateProfile(v.firstName!, v.lastName ?? '', v.locale ?? '').subscribe({
      next: () => { this.loading.set(false); this.profileMsg.set('Profile saved.'); },
      error: (e) => { this.loading.set(false); this.profileErr.set(this.msg(e, 'Could not save profile.')); },
    });
  }

  startEmailChange(): void {
    this.emailPhase.set('enter');
    this.emailMsg.set('');
    this.emailErr.set('');
  }

  cancelEmailChange(): void {
    this.emailPhase.set('idle');
    this.newEmail.reset();
    this.emailCode.reset();
  }

  sendEmailCode(): void {
    if (this.newEmail.invalid) return;
    this.loading.set(true);
    this.emailErr.set('');
    this.auth.requestEmailChange(this.newEmail.value!).subscribe({
      next: () => { this.loading.set(false); this.emailPhase.set('code'); this.emailMsg.set('We sent a code to your new email.'); },
      error: (e) => { this.loading.set(false); this.emailErr.set(this.msg(e, 'Could not send a code.')); },
    });
  }

  confirmEmailChange(): void {
    if (this.emailCode.invalid) return;
    this.loading.set(true);
    this.emailErr.set('');
    this.auth.confirmEmailChange(this.newEmail.value!, Number(this.emailCode.value)).subscribe({
      next: () => { this.loading.set(false); this.email.set(this.newEmail.value!); this.cancelEmailChange(); this.profileMsg.set('Email updated.'); },
      error: (e) => { this.loading.set(false); this.emailErr.set(this.msg(e, 'Invalid or expired code.')); },
    });
  }

  private msg(e: { error?: { detail?: string; message?: string } }, fallback: string): string {
    return e?.error?.detail || e?.error?.message || fallback;
  }
}
