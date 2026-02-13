import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Login.css';

export default function Login() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    // Check if the user is already logged in and redirect to the dashboard
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Session checks:", session);
      if (session) {
        navigate('/dashboard');
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior

    setError("");  // Clear any previous errors
    setLoading(true);  // Set loading state to true

    try {
      // Ensure phone number contains only digits
      const cleanedPhoneNumber = phoneNumber.trim().replace(/\D/g, "");

      console.log("Cleaned Phone Number:", cleanedPhoneNumber); // Log the cleaned phone number for verification
      console.log("Password:", password ? "Provided" : "Not Provided"); // Log if password is provided

      // Validate that the phone number and password are provided
      if (!cleanedPhoneNumber) throw new Error("Enter phone number");
      if (!password) throw new Error("Enter password");

      // Construct email using phone number for Supabase auth
      const emailFromPhone = `${cleanedPhoneNumber}@asjewellers.app`;

      console.log("Constructed email:", emailFromPhone); // Log the email for verification

      // Try logging in using the phone number-based email
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailFromPhone,  // Using phone number as email
        password,
      });

      if (signInError) {
        console.error("Sign-in error:", signInError); // Log the error message
        throw signInError;
      }

      // Log session data for debugging
      console.log("Session Data:", data?.session);

      // Check if the session is valid and the user is logged in
      if (!data?.session?.user) {
        if (data?.user) {
          setLoading(false);
          setError("Please confirm the account (check email) before signing in.");
          return;
        }
        throw new Error("Login failed");
      }

      // If the user is logged in, redirect to the main app tabs (or dashboard)
      navigate("/dashboard");

    } catch (e: any) {
      // Handle any unexpected errors and display the message
      setError(e?.message ?? "Unknown error");
    } finally {
      // Turn off the loading state
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h1>AS Jewellers</h1>
          <p>Admin Panel</p>
        </div>

        {/* Bind handleLogin to the onSubmit event */}
        <form className="login-form" onSubmit={handleLogin}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter your phone number"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p>Admin access only</p>
        </div>
      </div>
    </div>
  );
}
