import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar, 
  MessageSquare,
  RefreshCw,
  Shield,
  BarChart3,
  FileText,
  Trash2,
  Edit,
  Users,
  Activity,
  X
} from 'lucide-react';
import { UserSuggestion, BlockedUser, Stats } from '../types';
import { suggestionService, userService, adminService } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'suggestions' | 'stats' | 'users' | 'audit';

interface AuditLog {
  id: number;
  action: string;
  actor: string;
  target: string;
  details: string;
  created_at: string;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('suggestions');
  
  // Suggestions state
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [suggestionsPagination, setSuggestionsPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Stats state
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Users state
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [usersPagination, setUsersPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPagination, setAuditPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Load suggestions
  const loadSuggestions = useCallback(async (page = 1, newStatus = status) => {
    setIsLoadingSuggestions(true);
    try {
      const response = await suggestionService.getSuggestions(newStatus, page, 20);
      setSuggestions(response.suggestions);
      setSuggestionsPagination(response.pagination);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [status]);

  // Load stats
  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const statsData = await userService.getStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Load users
  const loadUsers = useCallback(async (page = 1) => {
    setIsLoadingUsers(true);
    try {
      const response = await userService.getUsers({ page, limit: 20 });
      setUsers(response.users);
      setUsersPagination(response.pagination);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Load audit logs
  const loadAuditLogs = useCallback(async (page = 1) => {
    setIsLoadingAudit(true);
    try {
      const data = await adminService.getAuditLogs(page, 20);
      setAuditLogs(data.logs || []);
      setAuditPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setIsLoadingAudit(false);
    }
  }, []);

  // Load data based on active tab
  useEffect(() => {
    if (isOpen) {
      switch (activeTab) {
        case 'suggestions':
          loadSuggestions();
          break;
        case 'stats':
          loadStats();
          break;
        case 'users':
          loadUsers();
          break;
        case 'audit':
          loadAuditLogs();
          break;
      }
    }
  }, [isOpen, activeTab, loadSuggestions, loadStats, loadUsers, loadAuditLogs]);

  // Handlers
  const handleStatusChange = (newStatus: 'pending' | 'approved' | 'rejected') => {
    setStatus(newStatus);
    loadSuggestions(1, newStatus);
  };

  const handleApprove = async (suggestion: UserSuggestion) => {
    try {
      await suggestionService.approveSuggestion(suggestion.id);
      await loadSuggestions(suggestionsPagination.page, status);
    } catch (error) {
      console.error('Error approving suggestion:', error);
      alert('Greška pri odobravanju predloga');
    }
  };

  const handleReject = async (suggestion: UserSuggestion) => {
    try {
      await suggestionService.rejectSuggestion(suggestion.id);
      await loadSuggestions(suggestionsPagination.page, status);
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      alert('Greška pri odbijanju predloga');
    }
  };

  const handleDeleteUser = async (user: BlockedUser) => {
    if (window.confirm(`Da li ste sigurni da želite da obrišete korisnika @${user.username}?`)) {
      try {
        await userService.deleteUser(user.id);
        await loadUsers(usersPagination.page);
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Greška pri brisanju korisnika');
      }
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

  const tabs = [
    { id: 'suggestions' as TabType, label: 'Predlozi', icon: MessageSquare },
    { id: 'stats' as TabType, label: 'Statistike', icon: BarChart3 },
    { id: 'users' as TabType, label: 'Korisnici', icon: Users },
    { id: 'audit' as TabType, label: 'Audit Log', icon: FileText },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="inline-block align-bottom bg-white dark:bg-dark-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-7xl sm:w-full">
          <div className="bg-white dark:bg-dark-800">
            {/* Header */}
            <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Shield className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                    Admin Panel
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex space-x-2 border-b border-gray-200 dark:border-dark-700 -mx-4 sm:-mx-6 px-4 sm:px-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 px-4 py-2 border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-twitter-600 text-twitter-600 dark:text-twitter-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              {/* Suggestions Tab */}
              {activeTab === 'suggestions' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
                      Predlozi korisnika
                    </h4>
                    <button
                      onClick={() => loadSuggestions(suggestionsPagination.page, status)}
                      disabled={isLoadingSuggestions}
                      className="btn btn-outline p-2"
                      title="Osveži"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoadingSuggestions ? 'animate-spin' : ''}`} />
                    </button>
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

                  {/* Suggestions List */}
                  {isLoadingSuggestions ? (
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
                    <>
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

                      {/* Pagination */}
                      {suggestionsPagination.pages > 1 && (
                        <div className="mt-6 flex items-center justify-between">
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            Strana {suggestionsPagination.page} od {suggestionsPagination.pages} ({suggestionsPagination.total} ukupno)
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => loadSuggestions(suggestionsPagination.page - 1, status)}
                              disabled={suggestionsPagination.page === 1 || isLoadingSuggestions}
                              className="btn btn-outline"
                            >
                              Prethodna
                            </button>
                            <button
                              onClick={() => loadSuggestions(suggestionsPagination.page + 1, status)}
                              disabled={suggestionsPagination.page === suggestionsPagination.pages || isLoadingSuggestions}
                              className="btn btn-outline"
                            >
                              Sledeća
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Stats Tab */}
              {activeTab === 'stats' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
                      Statistike
                    </h4>
                    <button
                      onClick={loadStats}
                      disabled={isLoadingStats}
                      className="btn btn-outline p-2"
                      title="Osveži"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoadingStats ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {isLoadingStats ? (
                    <div className="flex items-center justify-center py-12">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : stats ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="card p-6">
                        <div className="flex items-center space-x-3">
                          <Users className="h-8 w-8 text-twitter-600 dark:text-twitter-400" />
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Ukupno korisnika</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                              {stats.totalUsers}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="card p-6">
                        <div className="flex items-center space-x-3">
                          <Calendar className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Poslednje ažuriranje</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatDate(stats.lastUpdated)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-500 dark:text-gray-400">Nema podataka</p>
                    </div>
                  )}
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 'users' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
                      Upravljanje korisnicima
                    </h4>
                    <button
                      onClick={() => loadUsers(usersPagination.page)}
                      disabled={isLoadingUsers}
                      className="btn btn-outline p-2"
                      title="Osveži"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center py-12">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        Nema korisnika
                      </h3>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {users.map((user) => (
                          <div key={user.id} className="card p-4 flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                  @{user.username}
                                </h4>
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                <a
                                  href={user.profile_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-twitter-600 dark:text-twitter-400 hover:underline"
                                >
                                  {user.profile_url}
                                </a>
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                Dodato: {formatDate(user.created_at)}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="btn btn-secondary p-2"
                                title="Obriši"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {usersPagination.pages > 1 && (
                        <div className="mt-6 flex items-center justify-between">
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            Strana {usersPagination.page} od {usersPagination.pages} ({usersPagination.total} ukupno)
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => loadUsers(usersPagination.page - 1)}
                              disabled={usersPagination.page === 1 || isLoadingUsers}
                              className="btn btn-outline"
                            >
                              Prethodna
                            </button>
                            <button
                              onClick={() => loadUsers(usersPagination.page + 1)}
                              disabled={usersPagination.page === usersPagination.pages || isLoadingUsers}
                              className="btn btn-outline"
                            >
                              Sledeća
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Audit Log Tab */}
              {activeTab === 'audit' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
                      Audit Log
                    </h4>
                    <button
                      onClick={() => loadAuditLogs(auditPagination.page)}
                      disabled={isLoadingAudit}
                      className="btn btn-outline p-2"
                      title="Osveži"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {isLoadingAudit ? (
                    <div className="flex items-center justify-center py-12">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        Nema audit logova
                      </h3>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="card p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {log.action}
                                  </span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    od {log.actor}
                                  </span>
                                </div>
                                {log.target && (
                                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                    Target: {log.target}
                                  </div>
                                )}
                                {log.details && (
                                  <div className="text-xs text-gray-500 dark:text-gray-500">
                                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                  </div>
                                )}
                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                  {formatDate(log.created_at)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {auditPagination.pages > 1 && (
                        <div className="mt-6 flex items-center justify-between">
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            Strana {auditPagination.page} od {auditPagination.pages} ({auditPagination.total} ukupno)
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => loadAuditLogs(auditPagination.page - 1)}
                              disabled={auditPagination.page === 1 || isLoadingAudit}
                              className="btn btn-outline"
                            >
                              Prethodna
                            </button>
                            <button
                              onClick={() => loadAuditLogs(auditPagination.page + 1)}
                              disabled={auditPagination.page === auditPagination.pages || isLoadingAudit}
                              className="btn btn-outline"
                            >
                              Sledeća
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
