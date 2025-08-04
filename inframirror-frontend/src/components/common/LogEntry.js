import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

const LogEntry = ({ log }) => {
  const typeStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-orange-50 border-orange-200 text-orange-800',
    error: 'bg-red-50 border-red-200 text-red-800'
  };

  const icons = {
    info: AlertCircle,
    success: CheckCircle,
    warning: AlertCircle,
    error: AlertCircle
  };

  const Icon = icons[log.type];

  return (
    <div className={`border rounded-lg p-3 ${typeStyles[log.type]}`}>
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{log.timestamp}</span>
          </div>
          <p className="text-sm mt-1">{log.message}</p>
        </div>
      </div>
    </div>
  );
};

export default LogEntry;