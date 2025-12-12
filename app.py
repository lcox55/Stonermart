from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import os
from dotenv import load_dotenv
import requests
import json
from datetime import datetime, timedelta

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
CORS(app)

# Database Models
class Website(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(255), nullable=False, unique=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_audit = db.Column(db.DateTime)
    is_verified = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'url': self.url,
            'name': self.name,
            'created_at': self.created_at.isoformat(),
            'last_audit': self.last_audit.isoformat() if self.last_audit else None,
            'is_verified': self.is_verified
        }

class SEOMetrics(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    website_id = db.Column(db.Integer, db.ForeignKey('website.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    clicks = db.Column(db.Integer, default=0)
    impressions = db.Column(db.Integer, default=0)
    ctr = db.Column(db.Float, default=0.0)
    position = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AuditResults(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    website_id = db.Column(db.Integer, db.ForeignKey('website.id'), nullable=False)
    performance_score = db.Column(db.Integer)
    accessibility_score = db.Column(db.Integer)
    best_practices_score = db.Column(db.Integer)
    seo_score = db.Column(db.Integer)
    speed_index = db.Column(db.Float)
    first_contentful_paint = db.Column(db.Float)
    largest_contentful_paint = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/websites', methods=['GET'])
def get_websites():
    websites = Website.query.all()
    return jsonify([website.to_dict() for website in websites])

@app.route('/api/websites', methods=['POST'])
def add_website():
    data = request.get_json()
    
    if not data.get('url') or not data.get('name'):
        return jsonify({'error': 'URL and name are required'}), 400
    
    # Check if website already exists
    existing = Website.query.filter_by(url=data['url']).first()
    if existing:
        return jsonify({'error': 'Website already exists'}), 400
    
    website = Website(
        url=data['url'],
        name=data['name']
    )
    
    db.session.add(website)
    db.session.commit()
    
    return jsonify(website.to_dict()), 201

@app.route('/api/websites/<int:website_id>', methods=['DELETE'])
def delete_website(website_id):
    website = Website.query.get_or_404(website_id)
    
    # Delete related metrics and audit results
    SEOMetrics.query.filter_by(website_id=website_id).delete()
    AuditResults.query.filter_by(website_id=website_id).delete()
    
    db.session.delete(website)
    db.session.commit()
    
    return jsonify({'message': 'Website deleted successfully'})

@app.route('/api/websites/<int:website_id>/metrics', methods=['GET'])
def get_website_metrics(website_id):
    website = Website.query.get_or_404(website_id)
    
    # Get date range from query params
    days = request.args.get('days', 30, type=int)
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days)
    
    metrics = SEOMetrics.query.filter(
        SEOMetrics.website_id == website_id,
        SEOMetrics.date >= start_date,
        SEOMetrics.date <= end_date
    ).order_by(SEOMetrics.date).all()
    
    return jsonify([{
        'date': metric.date.isoformat(),
        'clicks': metric.clicks,
        'impressions': metric.impressions,
        'ctr': metric.ctr,
        'position': metric.position
    } for metric in metrics])

@app.route('/api/websites/<int:website_id>/audit', methods=['POST'])
def audit_website(website_id):
    website = Website.query.get_or_404(website_id)
    
    try:
        # Run PageSpeed Insights audit
        audit_results = run_pagespeed_audit(website.url)
        
        # Save audit results
        audit = AuditResults(
            website_id=website_id,
            performance_score=audit_results.get('performance_score'),
            accessibility_score=audit_results.get('accessibility_score'),
            best_practices_score=audit_results.get('best_practices_score'),
            seo_score=audit_results.get('seo_score'),
            speed_index=audit_results.get('speed_index'),
            first_contentful_paint=audit_results.get('first_contentful_paint'),
            largest_contentful_paint=audit_results.get('largest_contentful_paint')
        )
        
        db.session.add(audit)
        website.last_audit = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Audit completed successfully',
            'results': audit_results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def run_pagespeed_audit(url):
    """Run PageSpeed Insights audit"""
    api_key = os.getenv('PAGESPEED_API_KEY')  # You'll need to get this from Google
    api_url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    
    params = {
        'url': url,
        'key': api_key,
        'category': ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO']
    }
    
    response = requests.get(api_url, params=params)
    data = response.json()
    
    if response.status_code != 200:
        raise Exception(f"PageSpeed API error: {data.get('error', {}).get('message', 'Unknown error')}")
    
    lighthouse_result = data['lighthouseResult']
    categories = lighthouse_result['categories']
    audits = lighthouse_result['audits']
    
    return {
        'performance_score': int(categories['performance']['score'] * 100),
        'accessibility_score': int(categories['accessibility']['score'] * 100),
        'best_practices_score': int(categories['best-practices']['score'] * 100),
        'seo_score': int(categories['seo']['score'] * 100),
        'speed_index': audits['speed-index']['numericValue'],
        'first_contentful_paint': audits['first-contentful-paint']['numericValue'],
        'largest_contentful_paint': audits['largest-contentful-paint']['numericValue']
    }

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
