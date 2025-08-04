import React from 'react';
import { RefreshCw } from 'lucide-react';

const LoadingButton = ({ loading, onClick, children, variant = 'primary', disabled = false, className = '' }) => {
  const baseClasses = "px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors disabled:opacity-50";
  const variantClasses = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    success: "bg-green-600 hover:bg-green-700 text-white",
    warning: "bg-orange-600 hover:bg-orange-700 text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white"
  };
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      onClick={onClick}
      disabled={loading || disabled}
    >
      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
      {children}
    </button>
  );
};

export default LoadingButton;