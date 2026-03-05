import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:3002';

@Component({
    selector: 'app-ex63',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './63.html',
    styleUrl: './63.css'
})
export class Ex63Component implements OnInit {
    products: any[] = [];
    cart: any[] = [];
    view: string = 'products'; // 'products' or 'cart'
    message: string = '';
    removeIds: string[] = [];

    constructor(private http: HttpClient) { }

    ngOnInit(): void {
        this.loadProducts();
        this.loadCart();
    }

    loadProducts(): void {
        this.http.get<any[]>(`${API}/products`, { withCredentials: true })
            .subscribe({
                next: (data) => { this.products = data; },
                error: (err) => { console.error(err); }
            });
    }

    loadCart(): void {
        this.http.get<any[]>(`${API}/cart`, { withCredentials: true })
            .subscribe({
                next: (data) => { this.cart = data; },
                error: (err) => { console.error(err); }
            });
    }

    addToCart(id: string): void {
        this.http.get<any>(`${API}/add-to-cart/${id}`, { withCredentials: true })
            .subscribe({
                next: (data) => {
                    this.message = '✅ Added to cart! Cart has ' + data.cartCount + ' item(s).';
                    this.loadCart();
                    setTimeout(() => this.message = '', 2000);
                },
                error: (err) => { console.error(err); }
            });
    }

    toggleRemove(id: string, checked: boolean): void {
        if (checked) {
            this.removeIds.push(id);
        } else {
            this.removeIds = this.removeIds.filter(i => i !== id);
        }
    }

    updateCart(): void {
        const quantities: any = {};
        this.cart.forEach(item => {
            quantities[item._id] = item.qty;
        });
        this.http.post<any>(`${API}/update-cart`,
            { removeIds: this.removeIds, quantities },
            { withCredentials: true }
        ).subscribe({
            next: (data) => {
                this.cart = data.cart;
                this.removeIds = [];
                this.message = '✅ Shopping cart updated.';
                setTimeout(() => this.message = '', 2000);
            },
            error: (err) => { console.error(err); }
        });
    }

    getTotal(): number {
        return this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    }

    showCart(): void {
        this.loadCart();
        this.view = 'cart';
    }

    showProducts(): void {
        this.view = 'products';
    }
}
