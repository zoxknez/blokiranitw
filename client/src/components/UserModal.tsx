import React, { useState, useEffect } from 'react';
import { X, Save, User, Link } from 'lucide-react';
import { BlockedUser } from '../types';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Omit<BlockedUser, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  user?: BlockedUser | null;
  isLoading?: boolean;
}

const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  onSave,
  user,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    username: '',
    profile_url: ''
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        profile_url: user.profile_url
      });
    } else {
      setFormData({
        username: '',
        profile_url: ''
      });
    }
    setErrors({});
  }, [user, isOpen]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Korisničko ime je obavezno';
    } else if (formData.username.includes('@')) {
      newErrors.username = 'Korisničko ime ne sme sadržavati @';
    }

    if (!formData.profile_url.trim()) {
      newErrors.profile_url = 'URL profila je obavezan';
    } else if (!formData.profile_url.includes('x.com') && !formData.profile_url.includes('twitter.com')) {
      newErrors.profile_url = 'URL mora biti validan Twitter/X link';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

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
        <div className="inline-block align-bottom bg-white dark:bg-dark-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-white dark:bg-dark-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                  {user ? 'Izmeni korisnika' : 'Dodaj novog korisnika'}
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
              <div className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <User className="inline h-4 w-4 mr-1" />
                    Korisničko ime
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="korisnicko_ime"
                    className={`input w-full ${errors.username ? 'border-red-500 focus:ring-red-500' : ''}`}
                    disabled={isLoading}
                  />
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.username}
                    </p>
                  )}
                </div>

                {/* Profile URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Link className="inline h-4 w-4 mr-1" />
                    URL profila
                  </label>
                  <input
                    type="url"
                    name="profile_url"
                    value={formData.profile_url}
                    onChange={handleChange}
                    placeholder="https://x.com/korisnicko_ime"
                    className={`input w-full ${errors.profile_url ? 'border-red-500 focus:ring-red-500' : ''}`}
                    disabled={isLoading}
                  />
                  {errors.profile_url && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.profile_url}
                    </p>
                  )}
                </div>
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
                    Čuvam...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Save className="h-4 w-4 mr-2" />
                    {user ? 'Sačuvaj izmene' : 'Dodaj korisnika'}
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="btn btn-secondary w-full sm:w-auto mt-3 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Otkaži
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserModal;
