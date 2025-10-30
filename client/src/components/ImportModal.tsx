import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<{ imported: number; errors: number; total: number }>;
}

const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/json') {
        setFile(selectedFile);
        setResult(null);
      } else {
        alert('Molimo izaberite JSON fajl');
      }
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    try {
      const importResult = await onImport(file);
      setResult(importResult);
    } catch (error) {
      console.error('Import error:', error);
      alert('Greška pri importovanju fajla');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          <div className="bg-white dark:bg-dark-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                Import blokiranih korisnika
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={isLoading}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {!result ? (
                <>
                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Izaberite JSON fajl
                    </label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-dark-600 border-dashed rounded-md hover:border-twitter-500 transition-colors">
                      <div className="space-y-1 text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600 dark:text-gray-400">
                          <label
                            htmlFor="file-upload"
                            className="relative cursor-pointer bg-white dark:bg-dark-800 rounded-md font-medium text-twitter-600 hover:text-twitter-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-twitter-500"
                          >
                            <span>Izaberite fajl</span>
                            <input
                              ref={fileInputRef}
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              accept=".json"
                              className="sr-only"
                              onChange={handleFileSelect}
                              disabled={isLoading}
                            />
                          </label>
                          <p className="pl-1">ili prevucite ovde</p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          JSON format sa username i profile_url poljima
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Selected File */}
                  {file && (
                    <div className="flex items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                      <FileText className="h-5 w-5 text-gray-400 mr-3" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {file.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex">
                      <AlertCircle className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-medium mb-1">Format JSON fajla:</p>
                        <pre className="text-xs bg-blue-100 dark:bg-blue-800 p-2 rounded mt-1 overflow-x-auto">
{`[
  {
    "username": "korisnik1",
    "profile_url": "https://x.com/korisnik1"
  },
  {
    "username": "korisnik2", 
    "profile_url": "https://x.com/korisnik2"
  }
]`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Import Result */
                <div className="text-center space-y-4">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Import završen!
                    </h3>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <p>Ukupno obrađeno: <span className="font-semibold">{result.total}</span></p>
                      <p>Uspešno importovano: <span className="font-semibold text-green-600 dark:text-green-400">{result.imported}</span></p>
                      {result.errors > 0 && (
                        <p>Greške: <span className="font-semibold text-red-600 dark:text-red-400">{result.errors}</span></p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-dark-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            {!result ? (
              <>
                <button
                  onClick={handleImport}
                  disabled={!file || isLoading}
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
                      Importujem...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Upload className="h-4 w-4 mr-2" />
                      Importuj
                    </div>
                  )}
                </button>
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="btn btn-secondary w-full sm:w-auto mt-3 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Otkaži
                </button>
              </>
            ) : (
              <button
                onClick={handleReset}
                className="btn btn-primary w-full sm:w-auto"
              >
                Importuj još fajlova
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
