import { ChangeDetectionStrategy, Component, inject, effect, DestroyRef, signal, ViewEncapsulation, OnInit } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BaseAuthService } from '../../service/auth.service';
import { BillingService } from '../../service/billing.service';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom, map, merge } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { PartnerRegistration, PublicPlan } from '../../model/appdata';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';
import { fromPriceLabel } from '../../util/money';

@Component({
  selector: 'sail-register',
  templateUrl: './register_component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatSelectModule,
  ],
})
export class RegisterComponent implements OnInit {
  private auth = inject(BaseAuthService);
  private billing = inject(BillingService);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;

  readonly registerError = signal('');
  readonly plans = signal<PublicPlan[]>([]);

  readonly registerForm = this.fb.group({
    FirstName: ['', Validators.required],
    LastName: ['', Validators.required],
    UserName: ['', Validators.required],
    Email: ['', Validators.required],
    Password: ['', Validators.required],
    PartnerCaption: ['', Validators.required],
    Address: ['', Validators.required],
    City: ['', Validators.required],
    State: ['', Validators.required],
    Zipcode: ['', Validators.required],
    Country: ['', Validators.required],
    Phone: ['', Validators.required],
    DomainURL: ['', Validators.required],
    PlanID: ['FREE', Validators.required],
    Latitude: [null as number | null],
    Longitude: [null as number | null],
    consentLocation: [false, Validators.requiredTrue],
  });

  readonly geocodeStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  readonly geocodeError = signal('');

  private consentLocation = toSignal(
    this.registerForm.controls.consentLocation.valueChanges,
    { initialValue: false }
  );

  private destroyRef = inject(DestroyRef);

  private addressFields = ['Address', 'City', 'State', 'Zipcode', 'Country'] as const;

  protected getGoogleMapsApiKey(): string {
    return this.guiConfig.googleMapsApiKey ?? '';
  }

  /** Indicative "from" price for a plan option, derived from its offers ('' = free/none). */
  protected priceHint(plan: PublicPlan): string {
    return fromPriceLabel(plan.prices);
  }

  ngOnInit() {
    this.billing.listPlans().subscribe({
      next: (list) => this.plans.set(list ?? []),
      error: () => this.plans.set([]),
    });
  }

  constructor() {
    effect(() => {
      const consent = this.consentLocation();
      if (consent) {
        this.tryGeocode();
      } else {
        this.registerForm.patchValue({ Latitude: null, Longitude: null });
        this.geocodeStatus.set('idle');
        this.geocodeError.set('');
      }
    });

    merge(
      ...this.addressFields.map((f) => this.registerForm.controls[f].valueChanges),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.registerForm.patchValue({ Latitude: null, Longitude: null });
        if (this.consentLocation()) {
          this.tryGeocode();
        }
      });
  }

  private async tryGeocode() {
    const { Address, City, State, Zipcode, Country } = this.registerForm.getRawValue();
    if (!Address || !City || !State || !Zipcode || !Country) {
      this.geocodeStatus.set('idle');
      this.geocodeError.set('');
      return;
    }
    this.geocodeStatus.set('loading');
    this.geocodeError.set('');
    try {
      const coords = await this.getCoordinates(`${Address}, ${City}, ${State} ${Zipcode}, ${Country}`);
      this.registerForm.patchValue({ Latitude: coords.lat, Longitude: coords.lng });
      this.geocodeStatus.set('success');
    } catch {
      this.registerForm.patchValue({ Latitude: null, Longitude: null });
      this.geocodeStatus.set('error');
      this.geocodeError.set('Could not verify this address. Please check and try again.');
    }
  }

  register() {
    if (this.registerForm.valid) {
      this.registerError.set('');
      const formValue = this.registerForm.getRawValue();
      const partnerReg: PartnerRegistration = {
        FirstName: formValue.FirstName!,
        LastName: formValue.LastName!,
        UserName: formValue.UserName!,
        Email: formValue.Email!,
        Password: formValue.Password!,
        PartnerCaption: formValue.PartnerCaption!,
        Address: formValue.Address!,
        City: formValue.City!,
        State: formValue.State!,
        Zipcode: formValue.Zipcode!,
        Country: formValue.Country!,
        Phone: formValue.Phone!,
        DomainURL: formValue.DomainURL!,
        Latitude: formValue.Latitude!,
        Longitude: formValue.Longitude!,
        PlanID: formValue.PlanID!,
      };
      this.auth.register(partnerReg).subscribe({
        next: () => this.router.navigate(['/confirm/register']),
        error: (err) => this.registerError.set(err?.error?.message ?? 'Registration failed. Please try again.'),
      });
    }
  }

  private async getCoordinates(address: string): Promise<{ lat: number; lng: number }> {
    const apiKey = this.getGoogleMapsApiKey();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

    interface GeocodingResponse {
      results: { geometry: { location: { lat: number; lng: number } } }[];
      status: string;
    }
    try {
      const response = await firstValueFrom(
        this.http.get<GeocodingResponse>(url).pipe(
          map((data) => {
            if (data.status === 'OK' && data.results.length > 0) {
              return data.results[0].geometry.location;
            } else {
              throw new Error(`Geocoding failed: ${data.status}`);
            }
          }),
        ),
      );
      return response;
    } catch (error) {
      throw new Error(`Geocoding failed: ${error}`);
    }
  }
}
