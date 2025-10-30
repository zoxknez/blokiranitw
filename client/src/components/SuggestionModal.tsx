import React, { useState } from 'react';
import { X, FileText, Send } from 'lucide-react';
import { suggestionService } from '../services/api';

interface SuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SuggestionModal: React.FC<SuggestionModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [bulkText, setBulkText] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBulkText(e.target.value);
    if (errors.bulk) {
      setErrors(prev => ({ ...prev, bulk: '' }));
    }
  };

  const parseBulk = () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    const items = lines.map(line => {
      const [left, right] = line.split(/\s*[:|,;]\s*/); // support separators : | , ;
      return { username: (left || '').replace(/^@/, ''), profile_url: (right || '') };
    });
    return items.filter(it => it.username && it.profile_url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const items = parseBulk();
    if (items.length === 0) {
      setErrors({ bulk: 'Unesite bar jedan red u formatu korisnik:link' });
      return;
    }
    if (items.length > 50) {
      setErrors({ bulk: 'Maksimalno 50 unosa po predlogu' });
      return;
    }

    setIsLoading(true);
    try {
      await suggestionService.submitSuggestions(items);
      
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Suggestion error:', error);
      setErrors({ 
        general: error.response?.data?.error || 'Greška pri slanju predloga' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setBulkText('');
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        ></div>

        {/* Modal */}
        <div className="inline-block align-bottom bg-white dark:bg-dark-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-white dark:bg-dark-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                  Predloži korisnike za blokiranje
                </h3>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  disabled={isLoading}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Predlog će biti prosleđen administratoru na pregled.
              </p>
            </div>

            {/* Body */}
            <div className="bg-white dark:bg-dark-800 px-4 pb-4 sm:p-6">
              {errors.general && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Unesite do 50 linija u formatu
                </label>
                <div className="rounded-md bg-gray-50 dark:bg-dark-700 p-3 border border-gray-200 dark:border-dark-600 text-xs text-gray-600 dark:text-gray-300">
{`korisnicko_ime:https://x.com/korisnicko_ime`}
                </div>
                <textarea
                  name="bulk"
                  value={bulkText}
                  onChange={handleChange}
                  placeholder={"primer1:https://x.com/primer1\nprimer2:https://x.com/primer2"}
                  rows={10}
                  className="textarea resize-y"
                  disabled={isLoading}
                />
                {errors.bulk && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.bulk}
                  </p>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Maksimalno 50 unosa po slanju.
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
                    Šaljem...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Send className="h-4 w-4 mr-2" />
                    Pošalji predlog
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
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

export default SuggestionModal;
