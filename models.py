from app import db
from flask_login import UserMixin
from datetime import datetime

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    address = db.Column(db.String(255), nullable=True)
    password = db.Column(db.String(255), nullable=False)
    orders = db.relationship('Order', backref='customer', lazy=True)

class Service(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    price = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(50), nullable=False)
    active = db.Column(db.Boolean, default=True)

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(20), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('service.id'), nullable=False)
    weight = db.Column(db.Float, nullable=True)
    qty = db.Column(db.Integer, nullable=True)
    total_price = db.Column(db.Float, nullable=False)
    pickup_date = db.Column(db.Date, nullable=False)
    pickup_time = db.Column(db.String(20), nullable=False)
    delivery_date = db.Column(db.Date, nullable=False)
    delivery_time = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(80), default='Received')
    instructions = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    service = db.relationship('Service')

class Driver(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    active = db.Column(db.Boolean, default=True)
    assigned_order = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=True)
