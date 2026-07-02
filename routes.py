from flask import render_template, request, redirect, url_for, flash, make_response
from flask_login import login_user, logout_user, login_required, current_user
from app import app, db, login_manager
from models import User, Service, Order, Driver
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import random

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    services = Service.query.filter_by(active=True).all()
    return render_template('index.html', services=services)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        phone = request.form['phone']
        address = request.form['address']
        password = request.form['password']
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'warning')
            return redirect(url_for('register'))
        user = User(name=name, email=email, phone=phone, address=address, password=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()
        flash('Registration successful. Please login.', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('dashboard'))
        flash('Invalid login', 'danger')
    return render_template('login.html')

@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/booking', methods=['GET', 'POST'])
@login_required
def booking():
    services = Service.query.filter_by(active=True).all()
    if request.method == 'POST':
        service_id = int(request.form['service_id'])
        amount = float(request.form.get('weight', '0') or 0)
        pickup_date = datetime.strptime(request.form['pickup_date'], '%Y-%m-%d').date()
        pickup_time = request.form['pickup_time']
        delivery_date = datetime.strptime(request.form['delivery_date'], '%Y-%m-%d').date()
        delivery_time = request.form['delivery_time']
        instructions = request.form.get('instructions', '')
        service = Service.query.get(service_id)
        if service.unit == 'kg':
            weight = amount
            qty = None
            total_price = service.price * weight
        else:
            qty = max(1, int(amount))
            weight = None
            total_price = service.price * qty
        order_number = f"ORD{random.randint(100000,999999)}"
        order = Order(
            order_number=order_number,
            user_id=current_user.id,
            service_id=service_id,
            weight=weight,
            qty=qty,
            total_price=total_price,
            pickup_date=pickup_date,
            pickup_time=pickup_time,
            delivery_date=delivery_date,
            delivery_time=delivery_time,
            instructions=instructions,
            status='Received'
        )
        db.session.add(order)
        db.session.commit()
        flash(f'Booking received. Your order number: {order_number}', 'success')
        return redirect(url_for('order_history'))
    return render_template('booking.html', services=services)

@app.route('/dashboard')
@login_required
def dashboard():
    orders = Order.query.filter_by(user_id=current_user.id).order_by(Order.created_at.desc()).all()
    pending = sum(1 for order in orders if order.status != 'Delivered')
    delivered = sum(1 for order in orders if order.status == 'Delivered')
    total_spent = sum(order.total_price for order in orders)
    return render_template('dashboard.html', orders=orders, pending=pending, delivered=delivered, total_spent=total_spent)

@app.route('/order-history')
@login_required
def order_history():
    orders = Order.query.filter_by(user_id=current_user.id).order_by(Order.created_at.desc()).all()
    return render_template('order_history.html', orders=orders)

@app.route('/receipt/<int:order_id>')
@login_required
def receipt(order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != current_user.id and current_user.email != 'admin@example.com':
        flash('Unauthorized access to receipt', 'danger')
        return redirect(url_for('order_history'))
    return render_template('receipt.html', order=order)

@app.route('/receipt/download/<int:order_id>')
@login_required
def download_receipt(order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != current_user.id and current_user.email != 'admin@example.com':
        flash('Unauthorized access to receipt', 'danger')
        return redirect(url_for('order_history'))
    html = render_template('receipt.html', order=order)
    response = make_response(html)
    response.headers['Content-Disposition'] = f'attachment; filename=receipt_{order.order_number}.html'
    return response

@app.route('/track', methods=['GET', 'POST'])
def track():
    order = None
    if request.method == 'POST':
        order_number = request.form['order_number']
        order = Order.query.filter_by(order_number=order_number).first()
        if not order:
            flash('Order number not found', 'warning')
    return render_template('tracking.html', order=order)

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        current_user.name = request.form['name']
        current_user.phone = request.form['phone']
        current_user.address = request.form['address']
        db.session.commit()
        flash('Profile updated', 'success')
    return render_template('profile.html')

@app.route('/admin')
@login_required
def admin():
    if current_user.email != 'admin@example.com':
        flash('Admin access only', 'danger')
        return redirect(url_for('index'))
    orders = Order.query.order_by(Order.created_at.desc()).all()
    services = Service.query.all()
    customers = User.query.all()
    drivers = Driver.query.all()
    return render_template('admin.html', orders=orders, services=services, customers=customers, drivers=drivers)

@app.route('/admin/update-status/<int:order_id>', methods=['POST'])
@login_required
def update_status(order_id):
    if current_user.email != 'admin@example.com':
        return redirect(url_for('index'))
    order = Order.query.get(order_id)
    if order:
        order.status = request.form['status']
        db.session.commit()
        flash('Order status updated', 'success')
    return redirect(url_for('admin'))

@app.route('/admin/add-service', methods=['POST'])
@login_required
def add_service():
    if current_user.email != 'admin@example.com':
        return redirect(url_for('index'))
    name = request.form['name']
    price = float(request.form['price'])
    unit = request.form['unit']
    service = Service(name=name, price=price, unit=unit, active=True)
    db.session.add(service)
    db.session.commit()
    flash('Service added', 'success')
    return redirect(url_for('admin'))
