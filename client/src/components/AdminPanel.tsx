import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar, 
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import { UserSuggestion } from '../types';
import { suggestionService } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [isLoading, setIsLoading] = useState(false);

  const loadSuggestions = useCallback(async (page = 1, newStatus = status) => {
    setIsLoading(true);
    try {
      const response = await suggestionService.getSuggestions(newStatus, page, 20);
      setSuggestions(response.suggestions);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (isOpen) {
      loadSuggestions();
    }
  }, [isOpen, loadSuggestions]);

  const handleStatusChange = (newStatus: 'pending' | 'approved' | 'rejected') => {
    setStatus(newStatus);
    loadSuggestions(1, newStatus);
  };

  const handleApprove = async (suggestion: UserSuggestion) => {
    try {
      await suggestionService.approveSuggestion(suggestion.id);
      await loadSuggestions(pagination.page, status);
    } catch (error) {
      console.error('Error approving suggestion:', error);
    }
  };

  const handleReject = async (suggestion: UserSuggestion) => {
    try {
      await suggestionService.rejectSuggestion(suggestion.id);
      await loadSuggestions(pagination.page, status);
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sr-RS', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Na čekanju';
      case 'approved':
        return 'Odobreno';
      case 'rejected':
        return 'Odbijeno';
      default:
        return status;
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
        <div className="inline-block align-bottom bg-white dark:bg-dark-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          <div className="bg-white dark:bg-dark-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                Admin Panel - Predlozi korisnika
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => loadSuggestions(pagination.page, status)}
                  disabled={isLoading}
                  className="btn btn-outline p-2"
                  title="Osveži"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex space-x-2 mb-6">
              {(['pending', 'approved', 'rejected'] as const).map((statusOption) => (
                <button
                  key={statusOption}
                  onClick={() => handleStatusChange(statusOption)}
                  className={`btn ${
                    status === statusOption ? 'btn-primary' : 'btn-outline'
                  }`}
                >
                  {getStatusIcon(statusOption)}
                  <span className="ml-2">{getStatusText(statusOption)}</span>
                </button>
              ))}
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Nema predloga
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Nema predloga sa statusom "{getStatusText(status)}".
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            @{suggestion.username}
                          </h4>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(suggestion.status)}
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {getStatusText(suggestion.status)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1" />
                            <span>Predložio: {suggestion.suggested_by || 'Anonimno'}</span>
                          </div>
                          
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>Datum: {formatDate(suggestion.created_at)}</span>
                          </div>
                          
                          {suggestion.reason && (
                            <div className="flex items-start">
                              <MessageSquare className="h-4 w-4 mr-1 mt-0.5" />
                              <span>Razlog: {suggestion.reason}</span>
                            </div>
                          )}
                          
                          <div>
                            <a
                              href={suggestion.profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-twitter-600 dark:text-twitter-400 hover:underline"
                            >
                              {suggestion.profile_url}
                            </a>
                          </div>
                        </div>
                      </div>

                      {suggestion.status === 'pending' && (
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleApprove(suggestion)}
                            className="btn btn-primary text-sm"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Odobri
                          </button>
                          <button
                            onClick={() => handleReject(suggestion)}
                            className="btn btn-secondary text-sm"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Odbij
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Strana {pagination.page} od {pagination.pages} ({pagination.total} ukupno)
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => loadSuggestions(pagination.page - 1, status)}
                    disabled={pagination.page === 1 || isLoading}
                    className="btn btn-outline"
                  >
                    Prethodna
                  </button>
                  <button
                    onClick={() => loadSuggestions(pagination.page + 1, status)}
                    disabled={pagination.page === pagination.pages || isLoading}
                    className="btn btn-outline"
                  >
                    Sledeća
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
