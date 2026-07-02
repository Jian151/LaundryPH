from app import app, db
from models import User, Service, Driver

with app.app_context():
    db.create_all()
    if not User.query.filter_by(email='admin@example.com').first():
        admin = User(name='Admin', email='admin@example.com', phone='09171234567', address='Office', password='admin')
        db.session.add(admin)
    if not Service.query.first():
        services = [
            Service(name='Wash', price=60.0, unit='kg', active=True),
            Service(name='Wash & Dry', price=90.0, unit='kg', active=True),
            Service(name='Wash, Dry & Fold', price=120.0, unit='kg', active=True),
            Service(name='Dry Cleaning', price=180.0, unit='item', active=True),
        ]
        db.session.add_all(services)
    db.session.commit()
    print('Database initialized.')
