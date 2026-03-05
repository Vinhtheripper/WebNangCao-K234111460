import { Routes } from '@angular/router';
import { About } from './about/about';
import { Contact } from './contact/contact';
import { PaymentComponent } from './payment/payment.component';
import { PaymentResultComponent } from './payment-result/payment-result.component';
import { Ex61Login } from './ex61/login';
import { Ex61LoginResult } from './ex61/login-result';
import { Ex63Component } from './ex63/63';

export const routes: Routes = [
  { path: '', redirectTo: 'about', pathMatch: 'full' },
  { path: 'about', component: About },
  { path: 'contact', component: Contact },
  { path: 'payment', component: PaymentComponent },
  { path: 'payment-result', component: PaymentResultComponent },
  { path: 'ex61/login', component: Ex61Login },
  { path: 'ex61/login-result', component: Ex61LoginResult },
  { path: 'ex63', component: Ex63Component }
];
