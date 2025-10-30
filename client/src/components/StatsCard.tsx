import React from 'react';
import { Users, Calendar, TrendingUp } from 'lucide-react';
import { Stats } from '../types';

interface StatsCardProps {
  stats: Stats;
  isLoading?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ stats, isLoading = false }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sr-RS', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="card-content">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-200 dark:bg-dark-700 rounded-lg"></div>
                <div className="ml-4 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-20"></div>
                  <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded w-16"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Total Users */}
      <div className="card hover:shadow-lg transition-all duration-200">
        <div className="card-content">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 bg-twitter-100 dark:bg-twitter-900 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-twitter-600 dark:text-twitter-400" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Ukupno blokiranih
            </p>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
              {stats.totalUsers.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="card hover:shadow-lg transition-all duration-200">
        <div className="card-content">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Poslednje ažuriranje
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {formatDate(stats.lastUpdated)}
            </p>
          </div>
        </div>
      </div>

      {/* Growth Indicator */}
      <div className="card hover:shadow-lg transition-all duration-200">
        <div className="card-content">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Status baze
            </p>
            <p className="text-sm font-semibold text-green-600 dark:text-green-400">
              Aktivna
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
