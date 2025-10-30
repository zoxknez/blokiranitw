import React from 'react';
import { ExternalLink, User, Calendar, Edit, Trash2 } from 'lucide-react';
import { BlockedUser } from '../types';

interface UserCardProps {
  user: BlockedUser;
  onEdit?: (user: BlockedUser) => void;
  onDelete?: (user: BlockedUser) => void;
  showActions?: boolean;
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  onEdit,
  onDelete,
  showActions = false
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sr-RS', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleProfileClick = () => {
    window.open(user.profile_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="card hover:shadow-lg transition-all duration-200 group">
      <div className="card-content">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-twitter-100 dark:bg-twitter-900 rounded-full flex items-center justify-center mb-3">
            <User className="h-7 w-7 text-twitter-600 dark:text-twitter-400" />
          </div>

          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              @{user.username}
            </h3>
            <button
              onClick={handleProfileClick}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-twitter-600 dark:hover:text-twitter-400 transition-colors"
              title="Otvori profil"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center justify-center">
              <Calendar className="h-4 w-4 mr-1" />
              <span>Dodato: {formatDate(user.created_at)}</span>
            </div>
            {user.updated_at !== user.created_at && (
              <div className="flex items-center justify-center">
                <Calendar className="h-4 w-4 mr-1" />
                <span>Ažurirano: {formatDate(user.updated_at)}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 w-full border-t border-gray-200 dark:border-gray-700">
            <a
              href={user.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-twitter-600 dark:text-twitter-400 hover:text-twitter-700 dark:hover:text-twitter-300 text-sm font-medium transition-colors break-words"
            >
              {user.profile_url}
            </a>
          </div>

          {showActions && (onEdit || onDelete) && (
            <div className="flex items-center space-x-2 mt-3">
              {onEdit && (
                <button
                  onClick={() => onEdit(user)}
                  className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Izmeni korisnika"
                >
                  <Edit className="h-4 w-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(user)}
                  className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Obriši korisnika"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserCard;
