import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { ProfileEditorComponent } from './profile_editor';

// "My Account" hub: the profile editor plus links to the existing self-service
// flows (password, 2FA, trusted devices, account deletion) at their
// conventional sail routes.
@Component({
  selector: 'sail-my-account',
  templateUrl: './my_account.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, ProfileEditorComponent],
})
export class MyAccountComponent {}
