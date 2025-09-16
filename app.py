from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import math

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def calculate_heart_rate(height, weight, age, gender, body_size):
    """
    Simple heart rate prediction algorithm based on anthropometric data.
    This is a placeholder implementation - in a real application, you would use
    a trained machine learning model.
    """
    
    # Calculate BMI
    height_m = height / 100  # Convert cm to meters
    bmi = weight / (height_m ** 2)
    
    # Base heart rate calculations (simplified algorithm)
    # Normal resting heart rate: 60-100 bpm
    base_hr = 72  # Average resting heart rate
    
    # Age factor (heart rate generally increases slightly with age)
    age_factor = age * 0.1
    
    # Gender factor (males typically have slightly lower resting HR)
    gender_factor = -2 if gender.lower() == 'male' else 2
    
    # BMI factor
    if bmi < 18.5:  # Underweight
        bmi_factor = 5
    elif bmi > 30:  # Obese
        bmi_factor = 8
    elif bmi > 25:  # Overweight
        bmi_factor = 4
    else:  # Normal weight
        bmi_factor = 0
    
    # Body size factor
    size_factors = {
        'small': -3,
        'medium': 0,
        'large': 3
    }
    body_size_factor = size_factors.get(body_size.lower(), 0)
    
    # Calculate predicted heart rate
    predicted_hr = base_hr + age_factor + gender_factor + bmi_factor + body_size_factor
    
    # Add some realistic variation (±5 bpm)
    variation = random.uniform(-5, 5)
    predicted_hr += variation
    
    # Ensure heart rate is within reasonable bounds (50-120 bpm)
    predicted_hr = max(50, min(120, predicted_hr))
    
    return round(predicted_hr)

@app.route('/api/predict-heart-rate', methods=['POST'])
def predict_heart_rate():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['height', 'weight', 'age', 'gender', 'bodySize']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Extract and validate data
        height = float(data['height'])
        weight = float(data['weight'])
        age = int(data['age'])
        gender = data['gender']
        body_size = data['bodySize']
        
        # Validate ranges
        if not (100 <= height <= 250):
            return jsonify({'error': 'Height must be between 100 and 250 cm'}), 400
        
        if not (30 <= weight <= 200):
            return jsonify({'error': 'Weight must be between 30 and 200 kg'}), 400
        
        if not (1 <= age <= 120):
            return jsonify({'error': 'Age must be between 1 and 120 years'}), 400
        
        if gender.lower() not in ['male', 'female']:
            return jsonify({'error': 'Gender must be either male or female'}), 400
        
        if body_size.lower() not in ['small', 'medium', 'large']:
            return jsonify({'error': 'Body size must be small, medium, or large'}), 400
        
        # Calculate heart rate
        heart_rate = calculate_heart_rate(height, weight, age, gender, body_size)
        
        return jsonify({
            'heartRate': heart_rate,
            'message': 'Heart rate predicted successfully',
            'metadata': {
                'bmi': round(weight / ((height/100) ** 2), 1),
                'category': 'resting_heart_rate'
            }
        })
        
    except ValueError as e:
        return jsonify({'error': 'Invalid data format'}), 400
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Heart Rate Monitor API is running',
        'version': '1.0.0'
    })

@app.route('/', methods=['GET'])
def home():
    """Root endpoint"""
    return jsonify({
        'message': 'Heart Rate Monitor API',
        'endpoints': {
            'predict': '/api/predict-heart-rate (POST)',
            'health': '/api/health (GET)'
        }
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
