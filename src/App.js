import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Grid,
  Paper
} from '@mui/material';
import axios from 'axios';
import './App.css';

function App() {
  const [formData, setFormData] = useState({
    height: '',
    weight: '',
    age: '',
    gender: 'male',
    bodySize: 'medium'
  });
  
  const [heartRate, setHeartRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('http://localhost:5000/api/predict-heart-rate', formData);
      setHeartRate(response.data.heartRate);
    } catch (err) {
      setError('Failed to predict heart rate. Please try again.');
      console.error('Error:', err);
    }
    
    setLoading(false);
  };
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box textAlign="center" mb={4}>
        <Typography variant="h3" component="h1" gutterBottom>
          Heart Rate Monitor
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Enter your anthropometric data to predict your heart rate
        </Typography>
      </Box>
      
      <Paper elevation={3} sx={{ p: 4 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Height (cm)"
                name="height"
                type="number"
                value={formData.height}
                onChange={handleInputChange}
                required
                inputProps={{ min: 100, max: 250 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Weight (kg)"
                name="weight"
                type="number"
                value={formData.weight}
                onChange={handleInputChange}
                required
                inputProps={{ min: 30, max: 200 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Age"
                name="age"
                type="number"
                value={formData.age}
                onChange={handleInputChange}
                required
                inputProps={{ min: 1, max: 120 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                SelectProps={{ native: true }}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </TextField>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Body Size"
                name="bodySize"
                value={formData.bodySize}
                onChange={handleInputChange}
                SelectProps={{ native: true }}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </TextField>
            </Grid>
            
            <Grid item xs={12}>
              <Box textAlign="center">
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{ px: 4, py: 1.5 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Predict Heart Rate'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
        
        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}
        
        {heartRate && (
          <Card sx={{ mt: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
            <CardContent>
              <Box textAlign="center">
                <Typography variant="h4" gutterBottom>
                  Predicted Heart Rate
                </Typography>
                <Typography variant="h2" fontWeight="bold">
                  {heartRate} BPM
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  Based on your anthropometric data
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}
      </Paper>
    </Container>
  );
}

export default App;
