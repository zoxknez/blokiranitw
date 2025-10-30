import React, { useState, useEffect } from 'react';
import { Search, X, Filter } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onSortChange: (sort: 'username' | 'created_at' | 'updated_at') => void;
  onOrderChange: (order: 'ASC' | 'DESC') => void;
  onDateRangeChange: (range: 'all' | 'today' | '7d' | '30d') => void;
  currentSort: 'username' | 'created_at' | 'updated_at';
  currentOrder: 'ASC' | 'DESC';
  currentDateRange: 'all' | 'today' | '7d' | '30d';
  isLoading?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onSortChange,
  onOrderChange,
  onDateRangeChange,
  currentSort,
  currentOrder,
  currentDateRange,
  isLoading = false
}) => {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, onSearch]);

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className="w-full space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Pretraži blokirane korisnike..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-10 pr-10 w-full"
          disabled={isLoading}
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 dark:hover:text-gray-300"
            disabled={isLoading}
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="btn btn-outline flex items-center space-x-2"
          disabled={isLoading}
        >
          <Filter className="h-4 w-4" />
          <span>Filteri</span>
        </button>

        {isLoading && (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <div className="loading-dots">
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
            <span>Pretražujem...</span>
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-4 space-y-4 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sortiraj po
              </label>
              <select
                value={currentSort}
                onChange={(e) => onSortChange(e.target.value as 'username' | 'created_at' | 'updated_at')}
                className="input w-full"
                disabled={isLoading}
              >
                <option value="username">Korisničko ime</option>
                <option value="created_at">Datum dodavanja</option>
                <option value="updated_at">Datum ažuriranja</option>
              </select>
            </div>

            {/* Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Redosled
              </label>
              <select
                value={currentOrder}
                onChange={(e) => onOrderChange(e.target.value as 'ASC' | 'DESC')}
                className="input w-full"
                disabled={isLoading}
              >
                <option value="ASC">Rastući (A-Z)</option>
                <option value="DESC">Opadajući (Z-A)</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Period
              </label>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { key: 'all', label: 'Sve' },
                  { key: 'today', label: 'Danas' },
                  { key: '7d', label: '7 dana' },
                  { key: '30d', label: '30 dana' }
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onDateRangeChange(key)}
                    disabled={isLoading}
                    className={`btn text-sm ${currentDateRange === key ? 'btn-primary' : 'btn-outline'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
