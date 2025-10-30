import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Plus, 
  Upload, 
  Moon, 
  Sun, 
  Users, 
  Settings,
  RefreshCw,
  LogOut,
  Shield,
  MessageSquare
} from 'lucide-react';
import { BlockedUser, SearchParams, Stats, User } from './types';
import { userService, authService, suggestionService } from './services/api';
import SearchBar from './components/SearchBar';
import UserCard from './components/UserCard';
import Pagination from './components/Pagination';
import StatsCard from './components/StatsCard';
import UserModal from './components/UserModal';
import ImportModal from './components/ImportModal';
import AuthModal from './components/AuthModal';
import SuggestionModal from './components/SuggestionModal';
import AdminPanel from './components/AdminPanel';
import LoadingSpinner from './components/LoadingSpinner';

const App: React.FC = () => {
  // State
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchParams, setSearchParams] = useState<SearchParams>({
    page: 1,
    limit: 20,
    search: '',
    sort: 'username',
    order: 'ASC',
    dateRange: 'all'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Modal states
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<BlockedUser | null>(null);

  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load users
  const loadUsers = useCallback(async (params = searchParams) => {
    setIsLoading(true);
    try {
      const response = await userService.getUsers(params);
      setUsers(response.users);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const statsData = await userService.getStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadStats();
    
    // Check authentication
    const user = authService.getCurrentUser();
    const authenticated = authService.isAuthenticated();
    setCurrentUser(user);
    setIsAuthenticated(authenticated);
  }, [loadStats]);

  // Load users when searchParams change
  useEffect(() => {
    loadUsers(searchParams);
  }, [searchParams, loadUsers]);

  // Dark mode toggle
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    setIsDarkMode(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Search handlers
  const handleSearch = useCallback((search: string) => {
    setSearchParams(prev => ({
      ...prev,
      search,
      page: 1
    }));
  }, []);

  const handleSortChange = useCallback((sort: 'username' | 'created_at' | 'updated_at') => {
    setSearchParams(prev => ({
      ...prev,
      sort,
      page: 1
    }));
  }, []);

  const handleOrderChange = useCallback((order: 'ASC' | 'DESC') => {
    setSearchParams(prev => ({
      ...prev,
      order,
      page: 1
    }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setSearchParams(prev => ({
      ...prev,
      page
    }));
  }, []);

  const handleDateRangeChange = useCallback((range: 'all' | 'today' | '7d' | '30d') => {
    setSearchParams(prev => ({
      ...prev,
      dateRange: range,
      page: 1
    }));
  }, []);

  // User management
  const handleAddUser = () => {
    setEditingUser(null);
    setIsUserModalOpen(true);
  };

  const handleEditUser = (user: BlockedUser) => {
    setEditingUser(user);
    setIsUserModalOpen(true);
  };

  const handleDeleteUser = async (user: BlockedUser) => {
    if (window.confirm(`Da li ste sigurni da želite da obrišete korisnika @${user.username}?`)) {
      try {
        await userService.deleteUser(user.id);
        await loadUsers(searchParams);
        await loadStats();
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Greška pri brisanju korisnika');
      }
    }
  };

  const handleSaveUser = async (userData: Omit<BlockedUser, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (editingUser) {
        await userService.updateUser(editingUser.id, userData.username, userData.profile_url);
      } else {
        await userService.addUser(userData.username, userData.profile_url);
      }
      await loadUsers(searchParams);
      await loadStats();
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  };

  const handleImport = async (file: File) => {
    try {
      const result = await userService.importUsers(file);
      await loadUsers(searchParams);
      await loadStats();
      return result;
    } catch (error) {
      console.error('Error importing users:', error);
      throw error;
    }
  };

  const handleRefresh = () => {
    loadUsers(searchParams);
    loadStats();
  };

  // Auth handlers
  const handleAuthSuccess = () => {
    const user = authService.getCurrentUser();
    const authenticated = authService.isAuthenticated();
    setCurrentUser(user);
    setIsAuthenticated(authenticated);
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const handleSuggestionSuccess = () => {
    // Show success message or notification
    alert('Predlog je uspešno poslat! Administrator će ga pregledati.');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-dark-800 shadow-sm border-b border-gray-200 dark:border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-twitter-600 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Twitter Blokirani Korisnici
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="btn btn-outline p-2"
                title="Osveži"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={toggleDarkMode}
                className="btn btn-outline p-2"
                title={isDarkMode ? 'Svetli režim' : 'Tamni režim'}
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* Public suggestion button */}
              <button
                onClick={() => (isAuthenticated ? setIsSuggestionModalOpen(true) : setIsAuthModalOpen(true))}
                className="btn btn-secondary"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Predloži
              </button>

              {/* Admin buttons */}
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="btn btn-secondary"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </button>

                  <button
                    onClick={handleAddUser}
                    className="btn btn-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj
                  </button>

                  <button
                    onClick={() => setIsAdminPanelOpen(true)}
                    className="btn btn-outline"
                    title="Admin Panel"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Admin
                  </button>

                  <div className="flex items-center space-x-2 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {currentUser?.username}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="btn btn-outline p-2"
                      title="Odjavi se"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="btn btn-primary"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Prijavi se
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <StatsCard stats={stats || { totalUsers: 0, lastUpdated: new Date().toISOString() }} isLoading={!stats} />

        {/* Search and Filters */}
        <div className="mb-8">
          <SearchBar
            onSearch={handleSearch}
            onSortChange={handleSortChange}
            onOrderChange={handleOrderChange}
            onDateRangeChange={handleDateRangeChange}
            currentSort={searchParams.sort || 'username'}
            currentOrder={searchParams.order || 'ASC'}
            currentDateRange={searchParams.dateRange || 'all'}
            isLoading={isLoading}
          />
        </div>

        {/* Results */}
        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Rezultati pretrage
              </h2>
              {!isLoading && (
                <span className="badge badge-secondary">
                  {pagination.total} korisnika
                </span>
              )}
            </div>

            {searchParams.search && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Pretraga za: <span className="font-medium">"{searchParams.search}"</span>
              </div>
            )}
          </div>

          {/* Loading State */}
          {isLoading && users.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <LoadingSpinner size="lg" className="mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Učitavam korisnike...</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && users.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Nema rezultata
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchParams.search 
                  ? 'Nijedan korisnik ne odgovara vašoj pretrazi.'
                  : 'Nema blokiranih korisnika u bazi podataka.'
                }
              </p>
              {!searchParams.search && (
                <button
                  onClick={handleAddUser}
                  className="btn btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj prvog korisnika
                </button>
              )}
            </div>
          )}

          {/* Users Grid */}
          {!isLoading && users.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onEdit={isAuthenticated ? handleEditUser : undefined}
                  onDelete={isAuthenticated ? handleDeleteUser : undefined}
                  showActions={isAuthenticated}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && users.length > 0 && pagination.pages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={handlePageChange}
              isLoading={isLoading}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        user={editingUser}
        isLoading={isLoading}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      <SuggestionModal
        isOpen={isSuggestionModalOpen}
        onClose={() => setIsSuggestionModalOpen(false)}
        onSuccess={handleSuggestionSuccess}
      />

      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
      />
    </div>
  );
};

export default App;
