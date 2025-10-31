import React, { useState } from 'react';
import { X, User, Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { authService } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!isLogin) {
      if (!formData.username.trim()) {
        newErrors.username = 'Korisničko ime je obavezno';
      }
      if (!formData.email.trim()) {
        newErrors.email = 'Email je obavezan';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Email nije validan';
      }
    } else {
      // Login: koristi username, ne email
      if (!formData.username.trim()) {
        newErrors.username = 'Korisničko ime je obavezno';
      }
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Lozinka je obavezna';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Lozinka mora imati najmanje 6 karaktera';
    }

    if (!isLogin) {
      if (!formData.confirmPassword.trim()) {
        newErrors.confirmPassword = 'Potvrda lozinke je obavezna';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Lozinke se ne poklapaju';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        // Login koristi username (backend API očekuje username)
        const response = await authService.login(formData.username, formData.password);
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        onSuccess();
        onClose();
      } else {
        // Register koristi username, email i password
        const response = await authService.register(formData.username, formData.email, formData.password);
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      setErrors({ 
        general: error.response?.data?.error || 'Greška pri autentifikaciji' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    setErrors({});
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="inline-block align-bottom bg-white dark:bg-dark-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-white dark:bg-dark-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                  {isLogin ? 'Prijavite se' : 'Registrujte se'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  disabled={isLoading}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="bg-white dark:bg-dark-800 px-4 pb-4 sm:p-6">
              {errors.general && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Username (for login) or Username + Email (for register) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <User className="inline h-4 w-4 mr-1" />
                    {isLogin ? 'Korisničko ime' : 'Korisničko ime'}
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder={isLogin ? "Unesite korisničko ime" : "Unesite korisničko ime"}
                    className={`input w-full ${errors.username ? 'border-red-500 focus:ring-red-500' : ''}`}
                    disabled={isLoading}
                  />
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.username}
                    </p>
                  )}
                </div>

                {/* Email (only for register) */}
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Mail className="inline h-4 w-4 mr-1" />
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Unesite email adresu"
                      className={`input w-full ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                      disabled={isLoading}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.email}
                      </p>
                    )}
                  </div>
                )}

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Lock className="inline h-4 w-4 mr-1" />
                    Lozinka
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Unesite lozinku"
                    className={`input w-full ${errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                    disabled={isLoading}
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Confirm Password (only for register) */}
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Lock className="inline h-4 w-4 mr-1" />
                      Potvrdite lozinku
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Potvrdite lozinku"
                      className={`input w-full ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                      disabled={isLoading}
                    />
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-dark-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full sm:w-auto sm:ml-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="loading-dots mr-2">
                      <div></div>
                      <div></div>
                      <div></div>
                      <div></div>
                    </div>
                    {isLogin ? 'Prijavljujem...' : 'Registrujem...'}
                  </div>
                ) : (
                  <div className="flex items-center">
                    {isLogin ? <LogIn className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                    {isLogin ? 'Prijavite se' : 'Registrujte se'}
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={toggleMode}
                disabled={isLoading}
                className="btn btn-secondary w-full sm:w-auto mt-3 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLogin ? 'Nemate nalog? Registrujte se' : 'Već imate nalog? Prijavite se'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
