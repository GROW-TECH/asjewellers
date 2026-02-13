import { useState } from 'react';
import axios, { AxiosError } from 'axios';  // Import AxiosError type
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with your Supabase project URL and service role key
const supabase = createClient(
  'https://bulzbgazeiesqambflto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1bHpiZ2F6ZWllc3FhbWJmbHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDM4OTcsImV4cCI6MjA3ODQxOTg5N30.fdk0BeMt7OCcIIrtHqTFQFvuWTWpo75QqiRkqH5X_0k'
);

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Function to create an admin user and insert their profile
  const createAdminUser = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError('Error creating user: ' + signUpError.message);
        setLoading(false);
        return;
      }

      const user = data?.user; // Access the user object from the data

      if (!user) {
        setError('No user data returned');
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase.from('profiles').upsert([
        {
          id: user.id, // Use the user ID from Supabase auth
          full_name: 'Admin', // Set the user's full name
          phone: '1234567890', // Set the user's phone number (replace with actual data)
          referral_code: 'REF123', // Set a referral code (optional)
          aadhar_number: '123456789012', // Set Aadhar number (optional)
          is_admin: true, // Set the user as an admin
        },
      ]);

      if (profileError) {
        setError('Error inserting profile: ' + profileError.message);
        setLoading(false);
        return;
      }

      setMessage('Admin user created successfully!');
    } catch (err) {
      setError('An unexpected error occurred: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAdminUser(email, password);
  };

  // Handle delete all users request
  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // Sending a GET request to your backend API to delete all users
      const response = await axios.get('http://localhost:3000/deleteUser');

      // Handling the successful response
      console.log('Delete response:', response.data); // Logging the response
      setMessage('All users deleted successfully');
    } catch (error) {
      // Handle errors here
      // Type the error as AxiosError to access response data
      if (axios.isAxiosError(error)) {
        console.error('Axios error:', error.response?.data);
        setError('Error deleting users: ' + (error.response?.data?.error || error.message));
      } else {
        // If it's not an AxiosError, handle it generically
        console.error('Unexpected error:', error);
        setError('An unexpected error occurred: ' + error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Create Admin User</h2>

      {error && <div style={{ color: 'red' }}>{error}</div>}
      {message && <div style={{ color: 'green' }}>{message}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: '8px', width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: '8px', width: '100%' }}
          />
        </div>

        <button type="submit" disabled={loading} style={{ padding: '10px 20px' }}>
          {loading ? 'Creating User...' : 'Create Admin User'}
        </button>

        <button onClick={handleDelete} type="button" style={{ padding: '10px 20px', marginTop: '10px' }}>
          Delete All Users
        </button>
      </form>
    </div>
  );
};

export default Signup;
